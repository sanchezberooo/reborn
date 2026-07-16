// Agent Task repository — MAXAİ iş emirlerinin tek yazma/okuma yolu
// (migration 0008). Durum makinesi (lib/tasks/types.ts TASK_TRANSITIONS)
// burada UYGULANIR: tablo dışı geçiş fırlatır; her mutasyon append-only
// event satırı bırakır (iz silinmez).
//
// EŞZAMANLILIK NOTU: claimNextRunnable SKIP LOCKED kullanmaz — tek
// kullanıcılı, tek işlemcili fazda yarış yok. Çok worker'lı gelecekte bu
// fonksiyon bir RPC'ye (FOR UPDATE SKIP LOCKED) taşınır; şema ve çağıran
// sözleşme değişmez — bilinçli evrim noktası.

import 'server-only'
import { getAgent } from '../agents/registry'
import { getDepartment } from '../departments/registry'
import type { AgentTask, AgentTaskEvent, TaskEventType, TaskPriority, TaskStatus } from './types'
import { PRIORITY_RANK, TASK_PRIORITIES, TASK_TRANSITIONS } from './types'

// Tek literal olması BİLİNÇLİ (satır birleştirme değil): supabase-js select
// tiplemesi literal string ister; birleşim `string`e düşer ve satır tipi
// GenericStringError'a döner (lib/brain/db.ts NODE_COLUMNS ile aynı desen).
const TASK_COLUMNS = 'id, user_id, title, description, status, priority, owner_agent, department, input, output, error, retry_count, max_retries, scheduled_for, started_at, finished_at, created_at, updated_at'

async function taskDeps() {
  const { getSupabaseAdmin } = await import('../supabase-admin')
  return { supabase: getSupabaseAdmin() }
}

function mapTaskRow(row: Record<string, unknown>): AgentTask {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    ownerAgent: (row.owner_agent as string | null) ?? null,
    department: (row.department as string | null) ?? null,
    input: (row.input as Record<string, unknown> | null) ?? null,
    output: row.output ?? null,
    error: (row.error as string | null) ?? null,
    retryCount: row.retry_count as number,
    maxRetries: row.max_retries as number,
    scheduledFor: (row.scheduled_for as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

async function writeEvent(
  taskId: string,
  event: TaskEventType,
  fields: { fromStatus?: TaskStatus; toStatus?: TaskStatus; detail?: Record<string, unknown>; runId?: string } = {},
): Promise<void> {
  const { supabase } = await taskDeps()
  const { error } = await supabase.from('agent_task_events').insert({
    task_id: taskId,
    event,
    from_status: fields.fromStatus ?? null,
    to_status: fields.toStatus ?? null,
    detail: fields.detail ?? null,
    run_id: fields.runId ?? null,
  })
  if (error) throw error
}

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: TaskPriority
  /** DepartmentId — verilirse lib/departments registry'sine karşı doğrulanır. */
  department?: string
  /** Registry ajan adı — verilirse lib/agents registry'sine karşı doğrulanır. */
  ownerAgent?: string
  input?: Record<string, unknown>
  maxRetries?: number
  /** Bu task'ın beklediği task id'leri — hepsi done olmadan çalışamaz. */
  dependsOn?: string[]
  scheduledFor?: string
}

export async function createTask(userId: string, spec: CreateTaskInput): Promise<AgentTask> {
  const title = spec.title.trim()
  if (!title) throw new Error('createTask: title boş olamaz.')
  if (spec.priority && !TASK_PRIORITIES.includes(spec.priority)) {
    throw new Error(`createTask: '${spec.priority}' geçerli bir öncelik değil (${TASK_PRIORITIES.join(', ')}).`)
  }
  if (spec.department && !getDepartment(spec.department)) {
    throw new Error(`createTask: '${spec.department}' tanımlı bir departman değil.`)
  }
  if (spec.ownerAgent && !getAgent(spec.ownerAgent)) {
    throw new Error(`createTask: '${spec.ownerAgent}' registry'de kayıtlı bir ajan değil.`)
  }

  const { supabase } = await taskDeps()
  const { data, error } = await supabase
    .from('agent_tasks')
    .insert({
      user_id: userId,
      title,
      description: spec.description?.trim() || null,
      priority: spec.priority ?? 'normal',
      department: spec.department ?? null,
      owner_agent: spec.ownerAgent ?? null,
      input: spec.input ?? null,
      max_retries: spec.maxRetries ?? 0,
      scheduled_for: spec.scheduledFor ?? null,
    })
    .select(TASK_COLUMNS)
    .single()
  if (error) throw error
  let task = mapTaskRow(data as Record<string, unknown>)

  await writeEvent(task.id, 'created', { toStatus: task.status })

  for (const dependsOnId of spec.dependsOn ?? []) {
    task = await addDependency(task.id, dependsOnId)
  }
  return task
}

export async function getTask(id: string): Promise<AgentTask | null> {
  const { supabase } = await taskDeps()
  const { data, error } = await supabase
    .from('agent_tasks').select(TASK_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapTaskRow(data as Record<string, unknown>) : null
}

export interface ListTasksOptions {
  status?: TaskStatus
  department?: string
  limit?: number
}

export async function listTasks(userId: string, opts: ListTasksOptions = {}): Promise<AgentTask[]> {
  const { supabase } = await taskDeps()
  let q = supabase.from('agent_tasks').select(TASK_COLUMNS).eq('user_id', userId)
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.department) q = q.eq('department', opts.department)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 50)
  if (error) throw error
  return (data ?? []).map((row) => mapTaskRow(row as Record<string, unknown>))
}

export async function getTaskEvents(taskId: string): Promise<AgentTaskEvent[]> {
  const { supabase } = await taskDeps()
  const { data, error } = await supabase
    .from('agent_task_events')
    .select('id, task_id, event, from_status, to_status, detail, run_id, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as number,
    taskId: row.task_id as string,
    event: row.event as TaskEventType,
    fromStatus: (row.from_status as TaskStatus | null) ?? null,
    toStatus: (row.to_status as TaskStatus | null) ?? null,
    detail: (row.detail as Record<string, unknown> | null) ?? null,
    runId: (row.run_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }))
}

/** Task'ın done olmamış bağımlılık id'leri — boş dizi: çalışmaya hazır. */
export async function unmetDependencies(taskId: string): Promise<string[]> {
  const { supabase } = await taskDeps()
  const { data, error } = await supabase
    .from('agent_task_dependencies')
    .select('depends_on_task_id, dependency:agent_tasks!agent_task_dependencies_depends_on_task_id_fkey(status)')
    .eq('task_id', taskId)
  if (error) throw error
  return (data ?? [])
    .filter((row) => (row.dependency as { status?: string } | null)?.status !== 'done')
    .map((row) => row.depends_on_task_id as string)
}

/**
 * Bağımlılık ekler. Döngü engeli kod tarafında: dependsOnId'nin (geçişli)
 * bağımlılık zinciri taskId'ye ulaşıyorsa reddedilir. Bağımlılık done
 * değilse ve task pending/queued ise task 'blocked'a çekilir.
 */
export async function addDependency(taskId: string, dependsOnId: string): Promise<AgentTask> {
  if (taskId === dependsOnId) throw new Error('addDependency: task kendisine bağlanamaz.')

  const [task, dependency] = await Promise.all([getTask(taskId), getTask(dependsOnId)])
  if (!task) throw new Error(`addDependency: task bulunamadı (${taskId}).`)
  if (!dependency) throw new Error(`addDependency: bağımlılık task'ı bulunamadı (${dependsOnId}).`)

  // Döngü taraması (BFS): dependsOnId'nin bağımlılıklarını geçişli yürü.
  const { supabase } = await taskDeps()
  const visited = new Set<string>([dependsOnId])
  let frontier = [dependsOnId]
  while (frontier.length > 0) {
    const { data, error } = await supabase
      .from('agent_task_dependencies')
      .select('depends_on_task_id')
      .in('task_id', frontier)
    if (error) throw error
    frontier = []
    for (const row of data ?? []) {
      const next = row.depends_on_task_id as string
      if (next === taskId) {
        throw new Error('addDependency: döngüsel bağımlılık — bu kenar reddedildi.')
      }
      if (!visited.has(next)) {
        visited.add(next)
        frontier.push(next)
      }
    }
  }

  const { error: insertError } = await supabase
    .from('agent_task_dependencies')
    .insert({ task_id: taskId, depends_on_task_id: dependsOnId })
  if (insertError) throw insertError
  await writeEvent(taskId, 'dependency_added', { detail: { dependsOnTaskId: dependsOnId } })

  if (dependency.status !== 'done' && (task.status === 'pending' || task.status === 'queued')) {
    return transitionTask(taskId, 'blocked', { detail: { reason: `bağımlılık bekliyor: ${dependsOnId}` } })
  }
  const fresh = await getTask(taskId)
  return fresh ?? task
}

export interface TransitionOptions {
  detail?: Record<string, unknown>
  runId?: string
  output?: unknown
  error?: string
}

/**
 * Durum geçişi — TASK_TRANSITIONS dışı her geçiş fırlatır. Çalışmaya giden
 * geçişlerde (queued/running) açık bağımlılık varsa reddedilir. Zaman
 * damgaları durumla birlikte atılır: running → started_at; done/failed/
 * cancelled → finished_at.
 */
export async function transitionTask(
  taskId: string,
  to: TaskStatus,
  opts: TransitionOptions = {},
): Promise<AgentTask> {
  const task = await getTask(taskId)
  if (!task) throw new Error(`transitionTask: task bulunamadı (${taskId}).`)

  if (!TASK_TRANSITIONS[task.status].includes(to)) {
    throw new Error(
      `transitionTask: '${task.status}' → '${to}' geçişi izinli değil (izinli: ${TASK_TRANSITIONS[task.status].join(', ') || 'yok — terminal durum'}).`,
    )
  }
  if (to === 'queued' || to === 'running') {
    const unmet = await unmetDependencies(taskId)
    if (unmet.length > 0) {
      throw new Error(`transitionTask: açık bağımlılık varken '${to}' olamaz — bekleyen: ${unmet.join(', ')}.`)
    }
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status: to, updated_at: now }
  if (to === 'running') patch.started_at = now
  if (to === 'done' || to === 'failed' || to === 'cancelled') patch.finished_at = now
  if (opts.output !== undefined) patch.output = opts.output
  if (opts.error !== undefined) patch.error = opts.error

  const { supabase } = await taskDeps()
  const { data, error } = await supabase
    .from('agent_tasks').update(patch).eq('id', taskId).select(TASK_COLUMNS).single()
  if (error) throw error

  await writeEvent(taskId, 'status_changed', {
    fromStatus: task.status,
    toStatus: to,
    detail: opts.detail,
    runId: opts.runId,
  })
  return mapTaskRow(data as Record<string, unknown>)
}

/**
 * Task'ı bir ajana atar. Ajan registry'de kayıtlı olmalı; task'ın
 * departmanı boşsa ajanın departmanı devralınır, doluysa uyuşmak zorunda
 * (iş emri bir departmanın hattından başka departmanın ajanına sızamaz).
 */
export async function assignTask(taskId: string, agentName: string): Promise<AgentTask> {
  const task = await getTask(taskId)
  if (!task) throw new Error(`assignTask: task bulunamadı (${taskId}).`)
  const agent = getAgent(agentName)
  if (!agent) throw new Error(`assignTask: '${agentName}' registry'de kayıtlı bir ajan değil.`)
  if (task.department && agent.department && task.department !== agent.department) {
    throw new Error(
      `assignTask: task '${task.department}' departmanında, '${agentName}' ise '${agent.department}' — departmanlar uyuşmalı.`,
    )
  }

  const { supabase } = await taskDeps()
  const { data, error } = await supabase
    .from('agent_tasks')
    .update({
      owner_agent: agentName,
      department: task.department ?? agent.department ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select(TASK_COLUMNS)
    .single()
  if (error) throw error

  await writeEvent(taskId, 'assigned', { detail: { agentName } })
  return mapTaskRow(data as Record<string, unknown>)
}

/** failed → queued retry yolu. Hak (max_retries) bittiyse fırlatır.
 *  opts.scheduledFor: retry engine'in backoff kapısı — verilirse görev
 *  kuyruğa o andan önce ÇEKİLMEZ (claim yolu scheduled_for'u süzer). */
export async function retryTask(
  taskId: string,
  opts: { scheduledFor?: string } = {},
): Promise<AgentTask> {
  const task = await getTask(taskId)
  if (!task) throw new Error(`retryTask: task bulunamadı (${taskId}).`)
  if (task.status !== 'failed') {
    throw new Error(`retryTask: yalnız 'failed' task yeniden denenebilir — mevcut durum '${task.status}'.`)
  }
  if (task.retryCount >= task.maxRetries) {
    throw new Error(`retryTask: deneme hakkı bitti (${task.retryCount}/${task.maxRetries}).`)
  }

  const { supabase } = await taskDeps()
  const { error } = await supabase
    .from('agent_tasks')
    .update({
      retry_count: task.retryCount + 1,
      scheduled_for: opts.scheduledFor ?? task.scheduledFor,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
  if (error) throw error
  await writeEvent(taskId, 'retry_scheduled', {
    detail: {
      attempt: task.retryCount + 1,
      maxRetries: task.maxRetries,
      ...(opts.scheduledFor ? { scheduledFor: opts.scheduledFor } : {}),
    },
  })
  return transitionTask(taskId, 'queued')
}

/** Task'a bir agent_runs kaydı iliştirir (iz: hangi çalıştırma bu emri işledi). */
export async function linkRun(taskId: string, runId: string): Promise<void> {
  const task = await getTask(taskId)
  if (!task) throw new Error(`linkRun: task bulunamadı (${taskId}).`)
  await writeEvent(taskId, 'run_linked', { runId })
}

/**
 * Çalıştırılabilir adayları SIRALI döndürür (durumu DEĞİŞTİRMEZ): status
 * pending|queued, zamanı gelmiş (scheduled_for), bağımlılıkları tamam;
 * sıralama öncelik rütbesi (urgent önce) + yaş (eski önce). Worker/dispatcher
 * bu listeden aday seçer ve claim'i (transitionTask → 'running') kendisi
 * yapar — seçim ile claim'in ayrılması, dispatch filtrelerinin (paused ajan,
 * dolu ajan) kuyruğu bozmadan atlama yapabilmesi içindir.
 */
export async function listRunnableTasks(userId: string, limit = 50): Promise<AgentTask[]> {
  const { supabase } = await taskDeps()
  const { data, error } = await supabase
    .from('agent_tasks')
    .select(TASK_COLUMNS)
    .eq('user_id', userId)
    .in('status', ['pending', 'queued'])
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  const candidates = (data ?? [])
    .map((row) => mapTaskRow(row as Record<string, unknown>))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt))

  const runnable: AgentTask[] = []
  for (const candidate of candidates) {
    const unmet = await unmetDependencies(candidate.id)
    if (unmet.length === 0) runnable.push(candidate)
  }
  return runnable
}

/** Terminal olmayan (pending|queued|running|blocked) + failed görevler —
 *  Live State'in kuyruk derinliği ve derived ajan durumu bunlardan hesaplanır.
 *  failed dahildir: retry hakkı bitmiş görev insan kararı bekler, görünür
 *  kalmalıdır. */
export async function listOpenTasks(userId: string, limit = 500): Promise<AgentTask[]> {
  const { supabase } = await taskDeps()
  const { data, error } = await supabase
    .from('agent_tasks')
    .select(TASK_COLUMNS)
    .eq('user_id', userId)
    .in('status', ['pending', 'queued', 'running', 'blocked', 'failed'])
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => mapTaskRow(row as Record<string, unknown>))
}

/**
 * Kuyruktan sıradaki çalıştırılabilir task'ı çeker ve 'running'e geçirir.
 * Uygun task yoksa null. (Eşzamanlılık notu dosya başında — tek worker
 * varsayımı; seçim mantığı listRunnableTasks'tadır.)
 */
export async function claimNextRunnable(userId: string): Promise<AgentTask | null> {
  const [first] = await listRunnableTasks(userId, 50)
  return first ? transitionTask(first.id, 'running') : null
}
