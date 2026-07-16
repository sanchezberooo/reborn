// MAXAİ iş emri (Agent Task) tip sözlüğü — migration 0008'in TypeScript
// karşılığı. Yalnız tip + sabit içerir; runtime bağımlılığı yok (lib/brain/
// types.ts deseni). DB erişimi lib/tasks/repository.ts'tedir.
//
// Personal Brain'in 'task' entity tipi (kişisel yapılacaklar) ile AYRI
// kavramdır: bu model MAXAİ orkestrasyonunun iş emirleridir — kim, hangi
// departmanda, neye bağlı, kaç deneme.

export const TASK_STATUSES = [
  'pending', 'queued', 'running', 'blocked', 'done', 'failed', 'cancelled',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

/** Kuyruk sıralaması için sayısal rütbe — küçük değer önce çalışır.
 *  (DB'de text tutulur; alfabetik sıra anlamsal sıra değildir, çevrim burada.) */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

/** Terminal durumlar — bu durumlardan çıkış yoktur (iz değişmez; yeni
 *  ihtiyaç yeni task açar). */
export const TERMINAL_STATUSES = ['done', 'cancelled'] as const satisfies readonly TaskStatus[]

/**
 * Durum makinesi — izinli geçişler. repository.transitionTask bu tablo
 * dışındaki her geçişi reddeder.
 *   pending → queued|running|blocked|cancelled  (running: senkron çalıştırma
 *             yolu kuyruğu atlayabilir — bugünkü runAgent gerçeği)
 *   queued  → running|blocked|cancelled
 *   blocked → pending|queued|cancelled          (bağımlılık çözülünce)
 *   running → done|failed|cancelled
 *   failed  → pending|queued|cancelled          (retry yolu — retryTask)
 */
export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['queued', 'running', 'blocked', 'cancelled'],
  queued: ['running', 'blocked', 'cancelled'],
  blocked: ['pending', 'queued', 'cancelled'],
  running: ['done', 'failed', 'cancelled'],
  failed: ['pending', 'queued', 'cancelled'],
  done: [],
  cancelled: [],
}

export const TASK_EVENT_TYPES = [
  'created', 'status_changed', 'assigned', 'dependency_added',
  'retry_scheduled', 'run_linked', 'note',
] as const
export type TaskEventType = (typeof TASK_EVENT_TYPES)[number]

export interface AgentTask {
  id: string
  userId: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  /** Registry ajan adı (lib/agents) — null: henüz atanmadı. */
  ownerAgent: string | null
  /** DepartmentId (lib/departments) — null: henüz yönlendirilmedi. */
  department: string | null
  input: Record<string, unknown> | null
  output: unknown
  error: string | null
  retryCount: number
  maxRetries: number
  scheduledFor: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentTaskEvent {
  id: number
  taskId: string
  event: TaskEventType
  fromStatus: TaskStatus | null
  toStatus: TaskStatus | null
  detail: Record<string, unknown> | null
  runId: string | null
  createdAt: string
}
