import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Agent Runtime Engine testi (Sprint 3). İki katman (tasks.test.ts deseni):
// 1. Saf sözleşme testleri (env'siz her yerde koşar): ajan durum makinesi
//    tablosunun bütünlüğü, olay sözlüğü, backoff matematiği, dispatcher kararı.
// 2. Canlı Supabase testleri (env yoksa skip, AI_PROVIDER=mock): worker
//    tick'inin uçtan uca yaşam döngüsü — claim → çalıştırma → done + iz;
//    delegasyon; timeout sweep + retry; pause davranışı.

// getAIProvider ilk çağrıda cache'ler — runAgent'tan önce mock'a sabitle
// (roster.test.ts deseni).
process.env.AI_PROVIDER = 'mock'

import {
  ACTIVE_AGENT_STATES,
  AGENT_RUNTIME_STATES,
  AGENT_STATE_TRANSITIONS,
  DEFAULT_RETRY_POLICY,
  RUNTIME_EVENT_TYPES,
} from './types'
import { computeBackoffMs } from './retry'
import { RuntimeEventBus } from './event-bus'
import { AgentRuntimeRegistry } from './agent-runtime'
import { DepartmentRuntime } from './department-runtime'
import { TaskDispatcher } from './dispatcher'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi sentinel — diğer setlerle (…000b-…0010) çakışmaz. */
const RUNTIME_USER_ID = '00000000-0000-4000-a000-000000000011'

describe('ajan durum makinesi — tablo bütünlüğü', () => {
  it('her durumun geçiş listesi yalnız tanımlı durumlara işaret eder, kendine dönmez', () => {
    for (const state of AGENT_RUNTIME_STATES) {
      for (const target of AGENT_STATE_TRANSITIONS[state]) {
        expect(AGENT_RUNTIME_STATES).toContain(target)
        expect(target).not.toBe(state)
      }
    }
  })

  it('paused yalnız idle\'a döner; uçuş durumları (thinking/working) paused\'a doğrudan geçemez', () => {
    expect(AGENT_STATE_TRANSITIONS.paused).toEqual(['idle'])
    for (const state of ACTIVE_AGENT_STATES) {
      expect(AGENT_STATE_TRANSITIONS[state]).not.toContain('paused')
    }
  })

  it('olay sözlüğü benzersizdir ve sprint olaylarını kapsar', () => {
    expect(new Set(RUNTIME_EVENT_TYPES).size).toBe(RUNTIME_EVENT_TYPES.length)
    for (const required of [
      'task_created', 'task_started', 'task_completed', 'task_failed',
      'task_delegated', 'task_cancelled', 'department_activated',
      'agent_started', 'agent_stopped', 'brain_updated',
    ]) {
      expect(RUNTIME_EVENT_TYPES).toContain(required)
    }
  })
})

describe('retry engine — backoff matematiği', () => {
  it('üsteldir, tavana kırpılır, 1. deneme base\'dir', () => {
    expect(computeBackoffMs(1)).toBe(DEFAULT_RETRY_POLICY.baseMs)
    expect(computeBackoffMs(2)).toBe(DEFAULT_RETRY_POLICY.baseMs * DEFAULT_RETRY_POLICY.factor)
    expect(computeBackoffMs(3)).toBeGreaterThan(computeBackoffMs(2))
    expect(computeBackoffMs(99)).toBe(DEFAULT_RETRY_POLICY.maxMs)
  })

  it('geçersiz deneme sayısına savunmalıdır (0/negatif → 1. deneme)', () => {
    expect(computeBackoffMs(0)).toBe(DEFAULT_RETRY_POLICY.baseMs)
    expect(computeBackoffMs(-3)).toBe(DEFAULT_RETRY_POLICY.baseMs)
  })
})

describe('agent runtime — geçiş yaptırımı ve pause (in-memory, DB izi console\'a düşebilir)', () => {
  function freshRuntime() {
    const bus = new RuntimeEventBus()
    return { bus, agents: new AgentRuntimeRegistry(bus) }
  }

  it('izinli zincir çalışır, izinsiz geçiş fırlatır', async () => {
    const { agents } = freshRuntime()
    await agents.transition('test-agent', 'thinking', { taskId: 't1' })
    await agents.transition('test-agent', 'working')
    await agents.transition('test-agent', 'completed')
    await agents.transition('test-agent', 'idle')
    await expect(agents.transition('test-agent', 'working')).rejects.toThrow(/izinli değil/)
  })

  it('pause boşta anında oturur, uçuşta bayraklanır; resume geri açar', async () => {
    const { agents } = freshRuntime()
    await agents.requestPause('test-agent')
    expect(agents.get('test-agent').state).toBe('paused')
    expect(agents.isAvailable('test-agent')).toBe(false)

    await agents.resume('test-agent')
    expect(agents.get('test-agent').state).toBe('idle')

    await agents.transition('test-agent', 'thinking')
    await agents.requestPause('test-agent')
    expect(agents.get('test-agent').state).toBe('thinking') // uçuşta — kesilmez
    expect(agents.get('test-agent').pauseRequested).toBe(true)
    expect(agents.isAvailable('test-agent')).toBe(false)
  })
})

describe('dispatcher — yönlendirme kararları (yan etkisiz)', () => {
  function freshDispatcher() {
    const bus = new RuntimeEventBus()
    const agents = new AgentRuntimeRegistry(bus)
    const departments = new DepartmentRuntime(bus, agents)
    return { agents, dispatcher: new TaskDispatcher(agents, departments) }
  }

  const baseTask = {
    id: '00000000-0000-4000-a000-0000000000aa',
    userId: RUNTIME_USER_ID,
    title: 'test', description: null,
    status: 'queued' as const, priority: 'normal' as const,
    ownerAgent: null, department: null,
    input: null, output: null, error: null,
    retryCount: 0, maxRetries: 0,
    scheduledFor: null, startedAt: null, finishedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }

  it('owner_agent doluysa o ajanı seçer; deprecated/tanımsız ajan kalıcı hatadır', () => {
    const { dispatcher } = freshDispatcher()
    const ok = dispatcher.resolve({ ...baseTask, ownerAgent: 'growth-agent' })
    expect(ok).toEqual({ ok: true, agent: expect.objectContaining({ name: 'growth-agent' }) })

    const dead = dispatcher.resolve({ ...baseTask, ownerAgent: 'essay-critic' })
    expect(dead).toMatchObject({ ok: false, permanent: true })

    const missing = dispatcher.resolve({ ...baseTask, ownerAgent: 'olmayan-ajan' })
    expect(missing).toMatchObject({ ok: false, permanent: true })
  })

  it('yalnız department doluysa departmanın ajanını seçer; legacy ve yönsüz görev kalıcı hatadır', () => {
    const { dispatcher } = freshDispatcher()
    const viaDept = dispatcher.resolve({ ...baseTask, department: 'creative' })
    expect(viaDept).toEqual({ ok: true, agent: expect.objectContaining({ name: 'creative-agent' }) })

    expect(dispatcher.resolve({ ...baseTask, department: 'legacy' })).toMatchObject({ ok: false, permanent: true })
    expect(dispatcher.resolve({ ...baseTask })).toMatchObject({ ok: false, permanent: true })
  })

  it('paused ajan geçici (transient) rettir — görev kuyrukta bekler', async () => {
    const { agents, dispatcher } = freshDispatcher()
    await agents.requestPause('builder-agent')
    const res = dispatcher.resolve({ ...baseTask, department: 'builder' })
    expect(res).toMatchObject({ ok: false, permanent: false })
  })
})

describe.skipIf(!hasEnv)('worker uçtan uca (MockProvider + canlı Supabase)', () => {
  async function adminApi() {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    return getSupabaseAdmin()
  }

  async function cleanup() {
    const supabase = await adminApi()
    await supabase.from('runtime_events').delete().eq('user_id', RUNTIME_USER_ID)
    // agent_tasks silinince deps/events FK cascade ile düşer.
    await supabase.from('agent_tasks').delete().eq('user_id', RUNTIME_USER_ID)
    await supabase.from('agent_runs').delete().eq('user_id', RUNTIME_USER_ID)
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  async function buildWorker() {
    const { Worker } = await import('./worker')
    const { AgentRunExecutor } = await import('./executor')
    const bus = new RuntimeEventBus()
    const agents = new AgentRuntimeRegistry(bus)
    const departments = new DepartmentRuntime(bus, agents)
    const dispatcher = new TaskDispatcher(agents, departments)
    const worker = new Worker({
      userId: RUNTIME_USER_ID,
      bus, agentRuntime: agents, departmentRuntime: departments, dispatcher,
      executors: [new AgentRunExecutor()],
    })
    return { worker, bus, agents, departments }
  }

  it('tick: kuyruktaki görevi claim eder, ajanı çalıştırır, done yapar; iz iki günlüğe de düşer', async () => {
    const { createTask, getTask, getTaskEvents } = await import('../tasks/repository')
    const { worker, agents, departments } = await buildWorker()

    const task = await createTask(RUNTIME_USER_ID, {
      title: 'Runtime uçtan uca görevi',
      department: 'operations',
      ownerAgent: 'test-agent',
      input: { probe: 'sprint-3' },
    })

    const summary = await worker.runTick()
    expect(summary.claimed).toBe(1)
    expect(summary.completed).toBe(1)
    expect(summary.failed).toBe(0)

    const finished = await getTask(task.id)
    expect(finished?.status).toBe('done')
    expect(finished?.output).toMatchObject({ mock: true })

    // Görev günlüğü: created → running → done + run_linked.
    const events = await getTaskEvents(task.id)
    const kinds = events.map((e) => e.event)
    expect(kinds).toContain('run_linked')
    expect(events.filter((e) => e.event === 'status_changed').map((e) => e.toStatus))
      .toEqual(['running', 'done'])

    // Organizma günlüğü: task_started/task_completed runtime_events'te.
    const supabase = await adminApi()
    const { data: organism } = await supabase
      .from('runtime_events')
      .select('event, agent_name, task_id')
      .eq('task_id', task.id)
      .order('id', { ascending: true })
    const organismKinds = (organism ?? []).map((r) => r.event)
    expect(organismKinds).toContain('task_started')
    expect(organismKinds).toContain('task_completed')

    // Ajan yaşam döngüsü settle olmuş, departman iş bitince deaktive olmuş.
    expect(agents.get('test-agent').state).toBe('idle')
    expect(departments.isActive('operations')).toBe(false)
  }, 60_000)

  it('delegasyon: ajan bağlamından delegate_task iş emri açar, task_delegated izi düşer', async () => {
    const { serverExecuteTool } = await import('../agents/executor')
    const { getTask } = await import('../tasks/repository')

    const result = (await serverExecuteTool(
      'delegate_task',
      {
        title: 'Delegasyon testi: creative brief',
        department: 'creative',
        priority: 'high',
        input: { brief: 'test' },
      },
      RUNTIME_USER_ID,
      { callerAgent: 'growth-agent' },
    )) as { ok: boolean; taskId?: string }

    expect(result.ok).toBe(true)
    const created = await getTask(result.taskId!)
    expect(created).toMatchObject({ department: 'creative', priority: 'high', status: 'pending' })

    const supabase = await adminApi()
    const { data: events } = await supabase
      .from('runtime_events')
      .select('event, detail')
      .eq('task_id', result.taskId!)
    expect(events?.map((e) => e.event)).toContain('task_delegated')

    // Geçersiz girdiler run'ı düşürmeden reddedilir.
    const noRoute = (await serverExecuteTool('delegate_task', { title: 'yönsüz' }, RUNTIME_USER_ID)) as { ok: boolean }
    expect(noRoute.ok).toBe(false)

    // İptal yolu (task_cancelled) + kuyruk hijyeni: bu iş emri sonraki
    // testlerin worker tick'ine sızmasın.
    const { getRuntime } = await import('./manager')
    const cancelled = await getRuntime().cancelTask(result.taskId!, 'test temizliği')
    expect(cancelled.status).toBe('cancelled')
  }, 30_000)

  it('timeout sweep: takılan running görev failed\'a düşer ve retry hakkıyla backoff\'lu kuyruğa döner', async () => {
    const { createTask, transitionTask, getTask } = await import('../tasks/repository')
    const { sweepTimedOutTasks } = await import('./timeout')
    const { scheduleRetryIfEligible } = await import('./retry')

    const bus = new RuntimeEventBus()
    const agents = new AgentRuntimeRegistry(bus)

    const task = await createTask(RUNTIME_USER_ID, {
      title: 'Takılan görev', department: 'operations', ownerAgent: 'test-agent', maxRetries: 1,
    })
    await transitionTask(task.id, 'running')

    // started_at'ı geriye çek — ölü süreç simülasyonu (davranış değil veri kurgusu).
    const supabase = await adminApi()
    const stale = new Date(Date.now() - 60 * 60_000).toISOString()
    await supabase.from('agent_tasks').update({ started_at: stale }).eq('id', task.id)

    const swept = await sweepTimedOutTasks(RUNTIME_USER_ID, 10 * 60_000, { bus, agentRuntime: agents })
    expect(swept.map((t) => t.id)).toContain(task.id)
    expect(swept[0].status).toBe('failed')
    expect(swept[0].error).toMatch(/Zaman aşımı/)

    const decision = await scheduleRetryIfEligible(swept[0], bus)
    expect(decision.retried).toBe(true)

    const requeued = await getTask(task.id)
    expect(requeued?.status).toBe('queued')
    expect(requeued?.retryCount).toBe(1)
    // Backoff kapısı: scheduled_for gelecekte — kuyruk taraması hemen almaz.
    expect(Date.parse(requeued!.scheduledFor!)).toBeGreaterThan(Date.now())

    // Hak bitti: ikinci retry reddedilir.
    await transitionTask(task.id, 'running')
    const failedAgain = await transitionTask(task.id, 'failed', { error: 'ikinci çöküş' })
    const second = await scheduleRetryIfEligible(failedAgain, bus)
    expect(second.retried).toBe(false)
    expect(second.reason).toMatch(/deneme hakkı bitti/)
  }, 30_000)

  it('paused ajanın görevi kuyrukta bekler; resume sonrası tick tamamlar', async () => {
    const { createTask, getTask } = await import('../tasks/repository')
    const { worker, agents } = await buildWorker()

    await agents.requestPause('test-agent')
    const task = await createTask(RUNTIME_USER_ID, {
      title: 'Pause testi görevi', ownerAgent: 'test-agent',
    })

    const pausedTick = await worker.runTick()
    expect(pausedTick.claimed).toBe(0)
    expect(pausedTick.skipped).toBeGreaterThan(0)
    expect((await getTask(task.id))?.status).toBe('pending')

    await agents.resume('test-agent')
    const resumedTick = await worker.runTick()
    expect(resumedTick.completed).toBe(1)
    expect((await getTask(task.id))?.status).toBe('done')
  }, 60_000)
})
