// Agent Runtime Engine tip sözlüğü (Sprint 3) — migration 0009'un ve
// lib/runtime katmanının TypeScript karşılığı. Yalnız tip + sabit içerir;
// runtime bağımlılığı yok (lib/tasks/types.ts deseni). Davranış diğer
// lib/runtime dosyalarındadır.
//
// KATMAN HARİTASI (bağımlılık yönü yukarıdan aşağıya, döngü yok):
//   manager → worker → { dispatcher, executor, retry, timeout }
//           → { department-runtime, agent-runtime } → event-bus → (DB)
// Hepsi Sprint 2 temellerinin ÜZERİNE kurulur: lib/tasks/repository.ts
// (görev durum makinesi), lib/agents/registry.ts (roster), lib/departments/
// registry.ts (izin modeli). Bu katman o sözleşmelerin hiçbirini değiştirmez.

import type { AgentTask, TaskStatus } from '../tasks/types'

// ── Ajan yaşam döngüsü ──────────────────────────────────────────────────────

/** Ajanın runtime durumları. Görev durumundan (TaskStatus) AYRI kavramdır:
 *  görev iş emrinin, bu ise çalışanın hâlidir.
 *   idle      — boşta, iş bekliyor
 *   thinking  — görev alındı, dispatch/bağlam hazırlığı sürüyor
 *   working   — LLM çalıştırması uçuşta
 *   waiting   — atanmış işi var ama zamanı gelmedi (retry backoff /
 *               scheduled_for gelecekte)
 *   blocked   — atanmış işlerinin tamamı bağımlılık kapısında
 *   completed — son çalıştırma başarıyla bitti (geçici — tick sonunda
 *               derived duruma oturur)
 *   failed    — son çalıştırma hata ile bitti (geçici — completed gibi)
 *   paused    — insan duraklattı: dispatcher bu ajana iş VERMEZ
 */
export const AGENT_RUNTIME_STATES = [
  'idle', 'thinking', 'working', 'waiting', 'blocked', 'completed', 'failed', 'paused',
] as const
export type AgentRuntimeState = (typeof AGENT_RUNTIME_STATES)[number]

/** Çalışma uçuşta sayılan durumlar — bu durumdaki ajana yeni iş verilmez ve
 *  pause isteği anında uygulanmaz (bayraklanır, iş bitince oturur). */
export const ACTIVE_AGENT_STATES = ['thinking', 'working'] as const satisfies readonly AgentRuntimeState[]

/**
 * Ajan durum makinesi — izinli geçişler; agent-runtime.ts transition bu
 * tablo dışını reddeder. completed/failed geçicidir: aynı tick içinde ya
 * yeni göreve (thinking) ya derived duruma (idle/waiting/blocked) ya da
 * bekleyen pause isteğine (paused) oturur.
 */
export const AGENT_STATE_TRANSITIONS: Record<AgentRuntimeState, readonly AgentRuntimeState[]> = {
  idle: ['thinking', 'waiting', 'blocked', 'paused'],
  thinking: ['working', 'failed', 'blocked'],
  working: ['completed', 'failed', 'waiting'],
  waiting: ['thinking', 'idle', 'blocked', 'paused'],
  blocked: ['thinking', 'idle', 'waiting', 'paused'],
  completed: ['thinking', 'idle', 'waiting', 'blocked', 'paused'],
  failed: ['thinking', 'idle', 'waiting', 'blocked', 'paused'],
  paused: ['idle'],
}

/** Bir ajanın anlık runtime bilgisi — process-içi hafızada yaşar (bilinçli:
 *  süreç yeniden başlarsa herkes idle'dan başlar; kalıcı ajan durumu
 *  multi-worker gününün işidir, bkz. teknik borçlar). */
export interface AgentRuntimeInfo {
  agentName: string
  state: AgentRuntimeState
  currentTaskId: string | null
  /** Bu duruma giriş zamanı (ISO). */
  since: string
  lastError: string | null
  /** Çalışma uçuştayken gelen pause isteği — iş bitince paused'a oturur. */
  pauseRequested: boolean
}

// ── Organizma olay sözlüğü ──────────────────────────────────────────────────

/** migration 0009 + 0011 + 0012 runtime_events.event CHECK listesinin TS
 *  karşılığı — ikisi birlikte güncellenir (yeni olay tipi = yeni migration). */
export const RUNTIME_EVENT_TYPES = [
  'task_created',
  'task_started',
  'task_completed',
  'task_failed',
  'task_delegated',
  'task_cancelled',
  'task_retried',
  'task_timed_out',
  'agent_started',
  'agent_stopped',
  'agent_state_changed',
  'department_activated',
  'department_deactivated',
  'worker_started',
  'worker_stopped',
  'brain_updated',
  // Knowledge Department (Sprint 5, migration 0011) — üretici katman
  // lib/knowledge/events.ts; olaylar aynı omurgadan (bu bus) akar:
  'knowledge_added',
  'knowledge_updated',
  'knowledge_reviewed',
  'knowledge_rejected',
  'skill_created',
  'workflow_created',
  'pattern_created',
  'sop_created',
  'template_created',
  // Knowledge Ingestion (Sprint 6, migration 0012) — üretici katman
  // lib/knowledge/ingestion.ts + registry inceleme yolu:
  'repository_imported',
  'repository_updated',
  'knowledge_extracted',
  'knowledge_approved',
] as const
export type RuntimeEventType = (typeof RUNTIME_EVENT_TYPES)[number]

export interface RuntimeEvent {
  type: RuntimeEventType
  taskId?: string
  agentName?: string
  department?: string
  workerId?: string
  userId?: string
  detail?: Record<string, unknown>
  /** publish anında event-bus damgalar (ISO). */
  createdAt: string
}

/** publish girdisi — createdAt bus'ta damgalanır. */
export type RuntimeEventInput = Omit<RuntimeEvent, 'createdAt'>

// ── Retry / worker konfigürasyonu ───────────────────────────────────────────

/** Üstel backoff politikası: bekleme = min(baseMs * factor^(deneme-1), maxMs). */
export interface RetryPolicy {
  baseMs: number
  factor: number
  maxMs: number
}

/** Varsayılan: 15sn → 30sn → 1dk → … tavan 15dk. LLM çalıştırmaları pahalı
 *  ve hatalar çoğunlukla geçici (rate limit, ağ) — agresif retry israftır. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseMs: 15_000,
  factor: 2,
  maxMs: 15 * 60_000,
}

export type WorkerStatus = 'stopped' | 'running' | 'stopping'

export interface WorkerConfig {
  /** Tick aralığı — kuyruk taraması sıklığı. */
  pollIntervalMs: number
  /** running görev bu süreyi aşarsa timeout manager düşürür. */
  taskTimeoutMs: number
  /** Tek tick'te en fazla kaç görev çalıştırılır (sıralı — v1 tek worker). */
  maxTasksPerTick: number
  retryPolicy: RetryPolicy
}

/** Timeout 10dk: en ağır meşru çalıştırma (webSearch'lü ajan, çok tool turu)
 *  dakikalar sürebilir; 10dk üstü kalan 'running' bu fazda ölü süreçtir. */
export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  pollIntervalMs: 5_000,
  taskTimeoutMs: 10 * 60_000,
  maxTasksPerTick: 3,
  retryPolicy: DEFAULT_RETRY_POLICY,
}

// ── Live State anlık görüntüsü ──────────────────────────────────────────────

export interface WorkerInfo {
  id: string
  status: WorkerStatus
  startedAt: string | null
  lastTickAt: string | null
  tickCount: number
  config: WorkerConfig
}

export interface DepartmentRuntimeInfo {
  departmentId: string
  active: boolean
  activatedAt: string | null
  /** Departmanın deprecated olmayan roster üyeleri. */
  agents: string[]
}

/** Process-ömürlü sayaçlar — kalıcı istatistik değil, canlılık göstergesi. */
export interface RuntimeCounters {
  published: number
  persistFailures: number
  tasksCompleted: number
  tasksFailed: number
  tasksRetried: number
  tasksTimedOut: number
  tasksDelegated: number
}

export interface TickSummary {
  tick: number
  claimed: number
  completed: number
  failed: number
  timedOut: number
  /** Uygun ajan yokken kuyrukta bırakılan aday sayısı. */
  skipped: number
}

/** Backend'in ürettiği canlı durum — Office ekranı (Sprint 4+) bunu okuyacak;
 *  bu sprintte yalnız /api/runtime/state üzerinden dışa verilir. */
export interface RuntimeSnapshot {
  worker: WorkerInfo | null
  agents: Record<string, AgentRuntimeInfo>
  departments: Record<string, DepartmentRuntimeInfo & {
    /** Açık görev sayıları (DB'den) — canlı kuyruk derinliği. */
    queue: Partial<Record<TaskStatus, number>>
  }>
  counters: RuntimeCounters
  recentEvents: RuntimeEvent[]
  generatedAt: string
}

/** Görev yürütme sözleşmesi — future hook noktası (Sprint 3, madde 11):
 *  bugün tek gerçek implementasyon AgentRunExecutor'dur (lib/runtime/
 *  executor.ts, runAgent'ı sarar). OpenClaw/n8n/MCP bağlandığı gün
 *  lib/integrations sözleşmeleri üzerinden yeni bir TaskExecutor kaydedilir;
 *  worker değişmez — executors listesine kayıt eklenir. */
export interface TaskExecutionContext {
  task: AgentTask
  /** Registry ajan adı — dispatcher çözer. */
  agentName: string
  userId: string
  workerId: string
}

export interface TaskExecutionOutcome {
  ok: boolean
  output?: unknown
  error?: string
  /** agent_runs bağlantısı (varsa) — task'a linkRun ile iliştirilir. */
  runId?: string
}

export interface TaskExecutor {
  /** kebab-case yürütücü kimliği (örn 'agent-run'). */
  readonly id: string
  canExecute(ctx: TaskExecutionContext): boolean
  execute(ctx: TaskExecutionContext): Promise<TaskExecutionOutcome>
}
