// Retry Engine — başarısız görevin yeniden deneme yolu (Sprint 3, madde 6).
// Kural üçlüsü:
//  * Limit: max_retries görev başına haktır (migration 0008 kolonu);
//    hak bitince görev failed'da KALIR — insan kararı bekler, sessizce
//    kaybolmaz.
//  * Backoff: üstel — min(baseMs * factor^(deneme-1), maxMs). Bekleme
//    scheduled_for'a yazılır; kuyruk taraması (listRunnableTasks) zamanı
//    gelmemiş görevi zaten süzer — ayrı bir zamanlayıcı YOK, kapı görev
//    modelinin kendisindedir.
//  * Failure reason: hata metni görev satırına transitionTask(failed,
//    { error }) ile işlenmiştir; retry event'i deneme sayısını ve yeni
//    zamanı append-only ize ekler (agent_task_events 'retry_scheduled' +
//    runtime_events 'task_retried').

import 'server-only'
import type { AgentTask } from '../tasks/types'
import { retryTask } from '../tasks/repository'
import type { RuntimeEventBus } from './event-bus'
import type { RetryPolicy } from './types'
import { DEFAULT_RETRY_POLICY } from './types'

/** attempt 1-tabanlıdır (1. yeniden deneme = base). Saf fonksiyon — test
 *  edilebilirlik için ayrık; jitter bilinçli yok (tek worker, çakışma yok). */
export function computeBackoffMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const bounded = Math.max(1, Math.floor(attempt))
  return Math.min(policy.baseMs * policy.factor ** (bounded - 1), policy.maxMs)
}

export interface RetryDecision {
  retried: boolean
  /** retried=true ise: görevin yeniden çalışabileceği en erken an (ISO). */
  scheduledFor?: string
  /** retried=false ise: neden (hak bitti / uygun durumda değil). */
  reason?: string
  task: AgentTask
}

/**
 * failed durumdaki görev için retry kararı: hak varsa backoff hesaplar,
 * failed → queued geçirir (scheduled_for gelecekte) ve task_retried yayınlar;
 * hak yoksa görevi failed'da bırakır. failed olmayan görevde no-op (savunma).
 */
export async function scheduleRetryIfEligible(
  task: AgentTask,
  bus: RuntimeEventBus,
  opts: { policy?: RetryPolicy; workerId?: string } = {},
): Promise<RetryDecision> {
  if (task.status !== 'failed') {
    return { retried: false, reason: `görev 'failed' değil ('${task.status}') — retry uygulanmaz.`, task }
  }
  if (task.retryCount >= task.maxRetries) {
    return {
      retried: false,
      reason: `deneme hakkı bitti (${task.retryCount}/${task.maxRetries}) — insan kararı bekliyor.`,
      task,
    }
  }

  const attempt = task.retryCount + 1
  const backoffMs = computeBackoffMs(attempt, opts.policy)
  const scheduledFor = new Date(Date.now() + backoffMs).toISOString()
  const retried = await retryTask(task.id, { scheduledFor })

  await bus.publish({
    type: 'task_retried',
    taskId: task.id,
    agentName: task.ownerAgent ?? undefined,
    department: task.department ?? undefined,
    workerId: opts.workerId,
    userId: task.userId,
    detail: { attempt, maxRetries: task.maxRetries, backoffMs, scheduledFor, lastError: task.error },
  })

  return { retried: true, scheduledFor, task: retried }
}
