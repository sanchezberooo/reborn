import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Agent Task modeli testi (migration 0008 + lib/tasks/repository.ts).
// İki katman:
// 1. Saf sözleşme testleri (env'siz her yerde koşar): durum makinesi
//    tablosunun bütünlüğü.
// 2. Canlı Supabase testleri (roster.test.ts deseni — env yoksa skip):
//    oluşturma, durum makinesi yaptırımı, bağımlılık kapısı, döngü reddi,
//    retry hakkı, atama tutarlılığı, kuyruk sırası, event izi.

import {
  PRIORITY_RANK,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TRANSITIONS,
  TERMINAL_STATUSES,
} from './types'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi sentinel — diğer setlerle (…000b-…000f) çakışmaz. */
const TASKS_USER_ID = '00000000-0000-4000-a000-000000000010'

describe('task durum makinesi — tablo bütünlüğü', () => {
  it('her durumun geçiş listesi yalnız tanımlı durumlara işaret eder', () => {
    for (const status of TASK_STATUSES) {
      for (const target of TASK_TRANSITIONS[status]) {
        expect(TASK_STATUSES).toContain(target)
        expect(target).not.toBe(status)
      }
    }
  })

  it('terminal durumlardan çıkış yoktur', () => {
    for (const status of TERMINAL_STATUSES) {
      expect(TASK_TRANSITIONS[status]).toEqual([])
    }
  })

  it('öncelik rütbesi tüm öncelikleri kapsar ve urgent en öndedir', () => {
    for (const priority of TASK_PRIORITIES) {
      expect(PRIORITY_RANK[priority]).toBeTypeOf('number')
    }
    expect(PRIORITY_RANK.urgent).toBeLessThan(PRIORITY_RANK.high)
    expect(PRIORITY_RANK.high).toBeLessThan(PRIORITY_RANK.normal)
    expect(PRIORITY_RANK.normal).toBeLessThan(PRIORITY_RANK.low)
  })
})

describe.skipIf(!hasEnv)('agent task repository (canlı Supabase)', () => {
  async function repo() {
    return import('./repository')
  }

  async function cleanup() {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    const supabase = getSupabaseAdmin()
    // agent_tasks silinince deps/events FK cascade ile düşer.
    await supabase.from('agent_tasks').delete().eq('user_id', TASKS_USER_ID)
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  it('createTask: pending doğar, created event\'i yazılır; geçersiz girdiler reddedilir', async () => {
    const { createTask, getTaskEvents } = await repo()

    const task = await createTask(TASKS_USER_ID, {
      title: 'Sözleşme testi görevi',
      department: 'growth',
      priority: 'high',
    })
    expect(task.status).toBe('pending')
    expect(task.priority).toBe('high')
    expect(task.department).toBe('growth')

    const events = await getTaskEvents(task.id)
    expect(events.map((e) => e.event)).toEqual(['created'])

    await expect(createTask(TASKS_USER_ID, { title: '   ' })).rejects.toThrow(/title/)
    await expect(
      createTask(TASKS_USER_ID, { title: 'x', department: 'video' }),
    ).rejects.toThrow(/departman/)
    await expect(
      createTask(TASKS_USER_ID, { title: 'x', ownerAgent: 'olmayan-ajan' }),
    ).rejects.toThrow(/ajan/)
  })

  it('durum makinesi: izinli zincir çalışır, izinsiz geçiş ve terminal çıkışı fırlatır', async () => {
    const { createTask, transitionTask, getTaskEvents } = await repo()

    const task = await createTask(TASKS_USER_ID, { title: 'Durum makinesi görevi' })
    const running = await transitionTask(task.id, 'running')
    expect(running.startedAt).not.toBeNull()

    const done = await transitionTask(task.id, 'done', { output: { sonuç: 42 } })
    expect(done.finishedAt).not.toBeNull()
    expect(done.output).toEqual({ sonuç: 42 })

    await expect(transitionTask(task.id, 'running')).rejects.toThrow(/terminal|izinli değil/)

    const events = await getTaskEvents(task.id)
    expect(events.map((e) => `${e.event}:${e.toStatus ?? ''}`)).toEqual([
      'created:pending', 'status_changed:running', 'status_changed:done',
    ])
  })

  it('bağımlılık kapısı: bağımlı task bloklanır, bağımlılık bitmeden çalışamaz, bitince kuyruk sırası doğru akar', async () => {
    const { createTask, transitionTask, claimNextRunnable, unmetDependencies } = await repo()

    const first = await createTask(TASKS_USER_ID, { title: 'Önce biten iş', priority: 'urgent' })
    const second = await createTask(TASKS_USER_ID, {
      title: 'Bağımlı iş',
      priority: 'urgent',
      dependsOn: [first.id],
    })
    expect(second.status).toBe('blocked')
    expect(await unmetDependencies(second.id)).toEqual([first.id])

    await expect(transitionTask(second.id, 'queued')).rejects.toThrow(/açık bağımlılık/)

    // Kuyruk: urgent 'first' gelir ('second' blocked olduğu için aday değil).
    const claimed = await claimNextRunnable(TASKS_USER_ID)
    expect(claimed?.id).toBe(first.id)
    await transitionTask(first.id, 'done')

    // Bağımlılık kapandı: blocked → queued artık izinli, kuyruk 'second'ı verir.
    await transitionTask(second.id, 'queued')
    const next = await claimNextRunnable(TASKS_USER_ID)
    expect(next?.id).toBe(second.id)
    await transitionTask(second.id, 'done')
  })

  it('döngüsel bağımlılık reddedilir (geçişli zincir dahil)', async () => {
    const { createTask, addDependency } = await repo()

    const a = await createTask(TASKS_USER_ID, { title: 'Döngü A' })
    const b = await createTask(TASKS_USER_ID, { title: 'Döngü B', dependsOn: [a.id] })
    const c = await createTask(TASKS_USER_ID, { title: 'Döngü C', dependsOn: [b.id] })

    await expect(addDependency(a.id, c.id)).rejects.toThrow(/döngüsel/i)
    await expect(addDependency(a.id, a.id)).rejects.toThrow(/kendisine/)
  })

  it('retry: hak varken failed→queued, hak bitince fırlatır; sayaç ve event izi doğru', async () => {
    const { createTask, transitionTask, retryTask, getTaskEvents } = await repo()

    const task = await createTask(TASKS_USER_ID, { title: 'Retry görevi', maxRetries: 1 })
    await transitionTask(task.id, 'running')
    await transitionTask(task.id, 'failed', { error: 'ilk deneme çöktü' })

    const retried = await retryTask(task.id)
    expect(retried.status).toBe('queued')
    expect(retried.retryCount).toBe(1)

    await transitionTask(task.id, 'running')
    await transitionTask(task.id, 'failed', { error: 'ikinci deneme çöktü' })
    await expect(retryTask(task.id)).rejects.toThrow(/deneme hakkı bitti/)

    const events = await getTaskEvents(task.id)
    expect(events.filter((e) => e.event === 'retry_scheduled')).toHaveLength(1)
  })

  it('assignTask: departman tutarlılığı uygulanır, boş departman ajandan devralınır', async () => {
    const { createTask, assignTask } = await repo()

    const typed = await createTask(TASKS_USER_ID, { title: 'Growth işi', department: 'growth' })
    await expect(assignTask(typed.id, 'creative-agent')).rejects.toThrow(/departmanlar uyuşmalı/)
    const assigned = await assignTask(typed.id, 'growth-agent')
    expect(assigned.ownerAgent).toBe('growth-agent')

    const untyped = await createTask(TASKS_USER_ID, { title: 'Serbest iş' })
    const inherited = await assignTask(untyped.id, 'builder-agent')
    expect(inherited.department).toBe('builder')
  })
})
