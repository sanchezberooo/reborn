// Worker Engine — organizmanın kalbi (Sprint 3, madde 1). Tek worker
// yeterlidir; mimari çok-worker gününe göre kurulmuştur:
//  * Görev seçimi/claim'i yalnız repository üzerinden — atomik claim gerektiği
//    gün listRunnableTasks+transitionTask ikilisi tek bir SKIP LOCKED RPC'ye
//    taşınır, worker sözleşmesi değişmez (repository dosya başı notu).
//  * Her worker'ın benzersiz id'si vardır ve her olaya işlenir — iki worker'ın
//    izleri ayrıştırılabilir.
//  * Süreç-yerel durum (agent-runtime) tek noktadan enjekte edilir — paylaşımlı
//    store gerektiğinde yalnız o sınıf değişir.
//
// ÇALIŞMA MODELİ: setTimeout zinciri (setInterval DEĞİL — tick'ler asla üst
// üste binmez), tick içinde SIRALI yürütme. Tick akışı:
//  1. Timeout sweep — takılan 'running' görevler failed'a düşer, retry
//     engine'e devredilir.
//  2. Dispatch döngüsü — listRunnableTasks adayları; dispatcher karar verir:
//     permanent ret → görev failed (retry YOK — kalıcı hata), transient ret →
//     kuyrukta kalır; kabul → claim + yürütme + sonuç işleme.
//  3. Settle — geçici ajan durumları (completed/failed) açık işlere göre
//     derived duruma oturur (idle/waiting/blocked/paused), boşalan
//     departmanlar deaktive edilir.
//
// Worker'ı KİMSE otomatik başlatmaz (bilinçli): LLM çalıştırmaları maliyetlidir
// ve kontrol kullanıcıdadır (değişmez filtre 4) — başlatma /api/runtime/worker
// üzerinden açık insan kararıdır.

import 'server-only'
import { randomUUID } from 'node:crypto'
import type { AgentTask } from '../tasks/types'
import { assignTask, listOpenTasks, listRunnableTasks, transitionTask } from '../tasks/repository'
import type { AgentRuntimeRegistry } from './agent-runtime'
import type { DepartmentRuntime } from './department-runtime'
import type { TaskDispatcher } from './dispatcher'
import type { RuntimeEventBus } from './event-bus'
import { scheduleRetryIfEligible } from './retry'
import { sweepTimedOutTasks } from './timeout'
import type { TaskExecutor, TickSummary, WorkerConfig, WorkerInfo, WorkerStatus } from './types'
import { DEFAULT_WORKER_CONFIG } from './types'

export interface WorkerDeps {
  userId: string
  bus: RuntimeEventBus
  agentRuntime: AgentRuntimeRegistry
  departmentRuntime: DepartmentRuntime
  dispatcher: TaskDispatcher
  executors: TaskExecutor[]
  config?: Partial<WorkerConfig>
}

export class Worker {
  readonly id: string
  readonly config: WorkerConfig
  private status: WorkerStatus = 'stopped'
  private startedAt: string | null = null
  private lastTickAt: string | null = null
  private tickCount = 0
  private ticking = false
  private timer: ReturnType<typeof setTimeout> | null = null

  private readonly userId: string
  private readonly bus: RuntimeEventBus
  private readonly agentRuntime: AgentRuntimeRegistry
  private readonly departmentRuntime: DepartmentRuntime
  private readonly dispatcher: TaskDispatcher
  private readonly executors: TaskExecutor[]

  constructor(deps: WorkerDeps) {
    this.id = `worker-${process.pid}-${randomUUID().slice(0, 8)}`
    this.userId = deps.userId
    this.bus = deps.bus
    this.agentRuntime = deps.agentRuntime
    this.departmentRuntime = deps.departmentRuntime
    this.dispatcher = deps.dispatcher
    this.executors = deps.executors
    this.config = { ...DEFAULT_WORKER_CONFIG, ...deps.config }
    if (this.executors.length === 0) {
      throw new Error('Worker: en az bir TaskExecutor gerekir.')
    }
  }

  info(): WorkerInfo {
    return {
      id: this.id,
      status: this.status,
      startedAt: this.startedAt,
      lastTickAt: this.lastTickAt,
      tickCount: this.tickCount,
      config: this.config,
    }
  }

  async start(): Promise<void> {
    if (this.status === 'running') return
    this.status = 'running'
    this.startedAt = new Date().toISOString()
    await this.bus.publish({
      type: 'worker_started',
      workerId: this.id,
      userId: this.userId,
      detail: { pollIntervalMs: this.config.pollIntervalMs, taskTimeoutMs: this.config.taskTimeoutMs },
    })
    this.scheduleNextTick(0)
  }

  /** Nazik durdurma: uçuştaki tick biter, yenisi başlamaz. */
  async stop(): Promise<void> {
    if (this.status === 'stopped') return
    this.status = this.ticking ? 'stopping' : 'stopped'
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.bus.publish({
      type: 'worker_stopped',
      workerId: this.id,
      userId: this.userId,
      detail: { ticks: this.tickCount },
    })
  }

  private scheduleNextTick(delayMs: number): void {
    if (this.status !== 'running') return
    this.timer = setTimeout(() => {
      void this.runTick()
        .catch((err) => {
          // Tick hatası worker'ı ÖLDÜRMEZ — organizma tek kötü tick'le durmaz;
          // hata ize düşer, sonraki tick normal koşar.
          console.error(`[Reborn Runtime] ${this.id} tick hatası:`, err)
        })
        .finally(() => this.scheduleNextTick(this.config.pollIntervalMs))
    }, delayMs)
  }

  /**
   * Tek tick — public: testler ve /api/runtime/worker 'tick' aksiyonu
   * deterministik tek adım koşturabilir (worker start edilmeden de çalışır).
   * Re-entry guard'lıdır: uçuşta tick varken ikinci çağrı no-op özet döner.
   */
  async runTick(): Promise<TickSummary> {
    const summary: TickSummary = {
      tick: this.tickCount + 1, claimed: 0, completed: 0, failed: 0, timedOut: 0, skipped: 0,
    }
    if (this.ticking) return { ...summary, tick: this.tickCount }
    this.ticking = true
    try {
      this.tickCount++
      this.lastTickAt = new Date().toISOString()

      // 1. Timeout sweep + süpürülenlerin retry kararı.
      const timedOut = await sweepTimedOutTasks(this.userId, this.config.taskTimeoutMs, {
        bus: this.bus, agentRuntime: this.agentRuntime, workerId: this.id,
      })
      summary.timedOut = timedOut.length
      for (const task of timedOut) {
        await scheduleRetryIfEligible(task, this.bus, { policy: this.config.retryPolicy, workerId: this.id })
      }

      // 2. Dispatch döngüsü.
      while (summary.claimed < this.config.maxTasksPerTick && this.status !== 'stopping') {
        const dispatched = await this.dispatchNext(summary)
        if (!dispatched) break
      }

      // 3. Settle — geçici durumlar oturur, boş departmanlar kapanır.
      await this.settle()
    } finally {
      this.ticking = false
      if (this.status === 'stopping') this.status = 'stopped'
    }
    return summary
  }

  /** Kuyruktan bir sonraki dağıtılabilir görevi bulur ve yürütür.
   *  false: bu tick'te yapılacak iş kalmadı. */
  private async dispatchNext(summary: TickSummary): Promise<boolean> {
    const candidates = await listRunnableTasks(this.userId)
    for (const candidate of candidates) {
      const resolution = this.dispatcher.resolve(candidate)

      if (!resolution.ok) {
        if (resolution.permanent) {
          // Kalıcı yönlendirme hatası: retry çözmez — failed + iz, retry YOK.
          const failed = await this.failWithoutRun(candidate, `Dispatch hatası: ${resolution.reason}`)
          if (failed) summary.failed++
          continue
        }
        summary.skipped++
        continue // ajan dolu/paused — görev kuyrukta bekler
      }

      await this.executeTask(candidate, resolution.agent.name, summary)
      return true
    }
    return false
  }

  private async executeTask(task: AgentTask, agentName: string, summary: TickSummary): Promise<void> {
    // Claim: pending|queued → running. Yarışta (başka worker kaptı /
    // bağımlılık belirdi) fırlatır — görev atlanır, tick devam eder.
    let claimed: AgentTask
    try {
      claimed = await transitionTask(task.id, 'running', {
        detail: { workerId: this.id, agent: agentName },
      })
    } catch (err) {
      console.warn(`[Reborn Runtime] ${this.id} claim kaçtı (${task.id}):`, err instanceof Error ? err.message : err)
      summary.skipped++
      return
    }
    summary.claimed++

    await this.agentRuntime.transition(agentName, 'thinking', { taskId: claimed.id, userId: this.userId })
    if (claimed.department) await this.departmentRuntime.markActive(claimed.department, this.userId)

    await this.bus.publish({
      type: 'task_started',
      taskId: claimed.id,
      agentName,
      department: claimed.department ?? undefined,
      workerId: this.id,
      userId: this.userId,
      detail: { title: claimed.title, attempt: claimed.retryCount + 1 },
    })
    await this.bus.publish({
      type: 'agent_started', agentName, taskId: claimed.id, workerId: this.id, userId: this.userId,
    })

    // Atama izi: owner boşsa dispatcher'ın seçimi göreve işlenir (departman
    // devralma kuralı repository'dedir). Departman aktivasyonu atamadan sonra
    // tekrar denenir — departmansız görev ajanın departmanını devralmış olabilir.
    if (!claimed.ownerAgent) {
      claimed = await assignTask(claimed.id, agentName)
      if (claimed.department) await this.departmentRuntime.markActive(claimed.department, this.userId)
    }

    await this.agentRuntime.transition(agentName, 'working', { taskId: claimed.id, userId: this.userId })

    const ctx = { task: claimed, agentName, userId: this.userId, workerId: this.id }
    const executor = this.executors.find((e) => e.canExecute(ctx))

    let outcome
    if (!executor) {
      outcome = { ok: false as const, error: `Bu görevi yürütebilecek TaskExecutor yok (kayıtlı: ${this.executors.map((e) => e.id).join(', ')}).` }
    } else {
      try {
        outcome = await executor.execute(ctx)
      } catch (err) {
        outcome = { ok: false as const, error: err instanceof Error ? err.message : String(err) }
      }
    }

    if (outcome.ok) {
      await transitionTask(claimed.id, 'done', {
        output: outcome.output,
        runId: outcome.runId,
        detail: { workerId: this.id, executor: executor?.id },
      })
      await this.agentRuntime.transition(agentName, 'completed', { taskId: claimed.id, userId: this.userId })
      await this.bus.publish({
        type: 'task_completed',
        taskId: claimed.id,
        agentName,
        department: claimed.department ?? undefined,
        workerId: this.id,
        userId: this.userId,
        detail: { runId: outcome.runId },
      })
      summary.completed++
    } else {
      const failed = await transitionTask(claimed.id, 'failed', {
        error: outcome.error,
        detail: { workerId: this.id, executor: executor?.id },
      })
      await this.agentRuntime.transition(agentName, 'failed', {
        taskId: claimed.id, error: outcome.error, userId: this.userId,
      })
      await this.bus.publish({
        type: 'task_failed',
        taskId: claimed.id,
        agentName,
        department: claimed.department ?? undefined,
        workerId: this.id,
        userId: this.userId,
        detail: { error: outcome.error, attempt: failed.retryCount + 1, maxRetries: failed.maxRetries },
      })
      summary.failed++
      await scheduleRetryIfEligible(failed, this.bus, { policy: this.config.retryPolicy, workerId: this.id })
    }

    await this.bus.publish({
      type: 'agent_stopped', agentName, taskId: claimed.id, workerId: this.id, userId: this.userId,
      detail: { ok: outcome.ok },
    })
  }

  /** Yürütmesiz kalıcı hata: görev hangi durumdaysa oradan failed'a taşınır.
   *  pending/queued'dan failed'a doğrudan geçiş yoktur (durum makinesi) —
   *  running üzerinden geçirilir ki iz dürüst kalsın: claim edildi, yürütme
   *  başlamadan düştü. */
  private async failWithoutRun(task: AgentTask, error: string): Promise<boolean> {
    try {
      await transitionTask(task.id, 'running', { detail: { workerId: this.id, reason: 'dispatch-kontrolü' } })
      await transitionTask(task.id, 'failed', { error, detail: { workerId: this.id, permanent: true } })
      await this.bus.publish({
        type: 'task_failed',
        taskId: task.id,
        agentName: task.ownerAgent ?? undefined,
        department: task.department ?? undefined,
        workerId: this.id,
        userId: this.userId,
        detail: { error, permanent: true },
      })
      return true
    } catch (err) {
      console.warn(`[Reborn Runtime] ${this.id} failWithoutRun kaçtı (${task.id}):`, err instanceof Error ? err.message : err)
      return false
    }
  }

  /**
   * Settle: geçici ajan durumları (completed/failed) ve boşta görünen ajanlar
   * açık işlere göre derived duruma oturtulur; açık işi kalmayan aktif
   * departmanlar deaktive edilir. Derived kurallar:
   *  * pauseRequested → paused
   *  * zamanı gelmemiş (scheduled_for gelecekte) atanmış işi var → waiting
   *  * atanmış işlerinin tamamı blocked → blocked
   *  * aksi halde → idle
   */
  private async settle(): Promise<void> {
    const open = await listOpenTasks(this.userId)
    const now = Date.now()

    const byAgent = new Map<string, AgentTask[]>()
    const departmentsWithOpenWork = new Set<string>()
    for (const task of open) {
      if (task.ownerAgent) {
        const list = byAgent.get(task.ownerAgent) ?? []
        list.push(task)
        byAgent.set(task.ownerAgent, list)
      }
      if (task.department && task.status !== 'failed') departmentsWithOpenWork.add(task.department)
    }

    for (const [agentName, info] of Object.entries(this.agentRuntime.snapshot())) {
      if (info.state === 'thinking' || info.state === 'working') continue

      if (info.pauseRequested && info.state !== 'paused') {
        await this.agentRuntime.transition(agentName, 'paused', { userId: this.userId })
        continue
      }
      if (info.state === 'paused') continue

      const tasks = byAgent.get(agentName) ?? []
      const hasScheduledAhead = tasks.some(
        (t) => (t.status === 'queued' || t.status === 'pending')
          && t.scheduledFor !== null && Date.parse(t.scheduledFor) > now,
      )
      const hasRunnableSoon = tasks.some(
        (t) => (t.status === 'queued' || t.status === 'pending')
          && (t.scheduledFor === null || Date.parse(t.scheduledFor) <= now),
      )
      const hasBlocked = tasks.some((t) => t.status === 'blocked')

      let derived: 'idle' | 'waiting' | 'blocked' = 'idle'
      if (hasScheduledAhead && !hasRunnableSoon) derived = 'waiting'
      else if (hasBlocked && !hasRunnableSoon && !hasScheduledAhead) derived = 'blocked'

      if (info.state !== derived) {
        await this.agentRuntime.transition(agentName, derived, { userId: this.userId })
      }
    }

    for (const [departmentId, info] of Object.entries(this.departmentRuntime.snapshot())) {
      if (info.active && !departmentsWithOpenWork.has(departmentId)) {
        await this.departmentRuntime.markDrained(departmentId, this.userId)
      }
    }
  }
}
