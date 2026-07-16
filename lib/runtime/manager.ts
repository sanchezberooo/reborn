// Runtime Manager — organizmanın kablolama ve erişim noktası. Tüm runtime
// bileşenleri (bus → agent/department runtime → dispatcher → worker →
// live-state) BURADA bir kez kurulur ve process boyunca yaşar; API route'ları
// ve tool executor'ı yalnız getRuntime() üzerinden dokunur.
//
// SINGLETON globalThis'te tutulur: Next dev'de HMR modül durumunu sıfırlar,
// globalThis yaşar — worker ve durum defteri her kod değişikliğinde
// kaybolmaz. (declare global + var: strict altında cast'siz tek yol.)
//
// Worker OTOMATİK BAŞLAMAZ (worker.ts dosya başı notu) — start/stop insan
// kararıdır (/api/runtime/worker). Manager worker olmadan da yaşar: event
// bus + live state, Sanchez'in delegate_task'ı gibi worker-dışı olayları
// worker kapalıyken de toplar.

import 'server-only'
import { listOpenTasks, getTask, transitionTask } from '../tasks/repository'
import type { AgentTask, TaskStatus } from '../tasks/types'
import { AgentRuntimeRegistry } from './agent-runtime'
import { DepartmentRuntime } from './department-runtime'
import { TaskDispatcher } from './dispatcher'
import { RuntimeEventBus } from './event-bus'
import { AgentRunExecutor } from './executor'
import { LiveStateStore } from './live-state'
import { Worker } from './worker'
import type { RuntimeSnapshot, WorkerConfig, WorkerInfo } from './types'

/** Tek kullanıcılı faz: runtime'ın çalıştığı kullanıcı profil tablosundaki
 *  tek satırdır (lib/sanchez/core.ts observe deseni). */
async function resolveRuntimeUserId(): Promise<string> {
  const { getSupabaseAdmin } = await import('../supabase-admin')
  const { data } = await getSupabaseAdmin().from('profiles').select('id').limit(1).single()
  const userId = (data?.id as string | undefined) ?? ''
  if (!userId) throw new Error('RuntimeManager: profil satırı yok — runtime kullanıcı olmadan çalışamaz.')
  return userId
}

export class RuntimeManager {
  readonly bus = new RuntimeEventBus()
  readonly agentRuntime = new AgentRuntimeRegistry(this.bus)
  readonly departmentRuntime = new DepartmentRuntime(this.bus, this.agentRuntime)
  readonly dispatcher = new TaskDispatcher(this.agentRuntime, this.departmentRuntime)
  readonly liveState = new LiveStateStore(this.bus)
  private worker: Worker | null = null

  async startWorker(config?: Partial<WorkerConfig>): Promise<WorkerInfo> {
    if (this.worker && this.worker.info().status !== 'stopped') {
      return this.worker.info() // tek worker — ikinci start no-op (v1 kararı)
    }
    const userId = await resolveRuntimeUserId()
    this.worker = new Worker({
      userId,
      bus: this.bus,
      agentRuntime: this.agentRuntime,
      departmentRuntime: this.departmentRuntime,
      dispatcher: this.dispatcher,
      executors: [new AgentRunExecutor()],
      config,
    })
    await this.worker.start()
    return this.worker.info()
  }

  async stopWorker(): Promise<WorkerInfo | null> {
    if (!this.worker) return null
    await this.worker.stop()
    return this.worker.info()
  }

  /** Worker başlatmadan tek deterministik adım — API 'tick' aksiyonu.
   *  Kapalı worker'la kuyruğu elle ilerletmenin resmi yolu. */
  async tickOnce(config?: Partial<WorkerConfig>) {
    if (!this.worker) {
      const userId = await resolveRuntimeUserId()
      this.worker = new Worker({
        userId,
        bus: this.bus,
        agentRuntime: this.agentRuntime,
        departmentRuntime: this.departmentRuntime,
        dispatcher: this.dispatcher,
        executors: [new AgentRunExecutor()],
        config,
      })
    }
    return this.worker.runTick()
  }

  workerInfo(): WorkerInfo | null {
    return this.worker?.info() ?? null
  }

  /** İnsan/orkestratör iptali — durum makinesi hangi durumlardan cancelled'a
   *  izin veriyorsa oradan (terminal görevde fırlatır) + task_cancelled izi. */
  async cancelTask(taskId: string, reason?: string): Promise<AgentTask> {
    const task = await getTask(taskId)
    if (!task) throw new Error(`cancelTask: task bulunamadı (${taskId}).`)
    const cancelled = await transitionTask(taskId, 'cancelled', {
      detail: { reason: reason ?? 'insan iptali' },
    })
    await this.bus.publish({
      type: 'task_cancelled',
      taskId,
      agentName: task.ownerAgent ?? undefined,
      department: task.department ?? undefined,
      userId: task.userId,
      detail: { reason: reason ?? 'insan iptali' },
    })
    return cancelled
  }

  /** Canlı durum fotoğrafı: process-içi runtime durumu + DB'den kuyruk
   *  derinlikleri. Office ekranının (Sprint 4+) veri sözleşmesi budur. */
  async snapshot(): Promise<RuntimeSnapshot> {
    const userId = await resolveRuntimeUserId()
    const open = await listOpenTasks(userId)

    const queues = new Map<string, Partial<Record<TaskStatus, number>>>()
    for (const task of open) {
      if (!task.department) continue
      const queue = queues.get(task.department) ?? {}
      queue[task.status] = (queue[task.status] ?? 0) + 1
      queues.set(task.department, queue)
    }

    const departments: RuntimeSnapshot['departments'] = {}
    for (const [id, info] of Object.entries(this.departmentRuntime.snapshot())) {
      departments[id] = { ...info, queue: queues.get(id) ?? {} }
    }

    return {
      worker: this.workerInfo(),
      agents: this.agentRuntime.snapshot(),
      departments,
      counters: this.liveState.countersSnapshot(),
      recentEvents: this.liveState.recentEvents(25),
      generatedAt: new Date().toISOString(),
    }
  }
}

declare global {
  var __rebornRuntimeManager: RuntimeManager | undefined
}

/** Process başına tek runtime — HMR'a dayanıklı erişim noktası. */
export function getRuntime(): RuntimeManager {
  if (!globalThis.__rebornRuntimeManager) {
    globalThis.__rebornRuntimeManager = new RuntimeManager()
  }
  return globalThis.__rebornRuntimeManager
}
