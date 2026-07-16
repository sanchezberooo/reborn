// Timeout Manager — takılan görev tespiti (Sprint 3, madde 7).
// 'running' durumda started_at'ı eşikten eski kalan görev, sahibi ölmüş
// (çökmüş süreç, kopmuş bağlantı) iştir: failed'a düşürülür (failure reason
// zaman aşımı), task_timed_out yayınlanır ve retry engine'e devredilir —
// hak varsa backoff'la kuyruğa döner.
//
// TEK-WORKER VARSAYIMI: worker sıralı çalıştığı ve sweep tick başında
// koştuğu için canlı bir çalıştırmanın süpürülmesi mümkün değildir (uçuşta
// görev varken tick giremez — worker re-entry guard'ı). Multi-worker
// gününde bu sweep heartbeat/claim-sahipliği ister — bilinçli evrim noktası
// (repository'nin SKIP LOCKED notuyla aynı gün çözülür).

import 'server-only'
import type { AgentTask } from '../tasks/types'
import { listTasks, transitionTask } from '../tasks/repository'
import type { AgentRuntimeRegistry } from './agent-runtime'
import type { RuntimeEventBus } from './event-bus'

export interface TimeoutSweepDeps {
  bus: RuntimeEventBus
  agentRuntime: AgentRuntimeRegistry
  workerId?: string
}

/** Süpürülen (failed'a düşürülen) görevleri döndürür — retry kararı çağıranın
 *  (worker) işidir; ayrım bilinçli: sweep tespit eder, politika worker'da. */
export async function sweepTimedOutTasks(
  userId: string,
  timeoutMs: number,
  deps: TimeoutSweepDeps,
): Promise<AgentTask[]> {
  const running = await listTasks(userId, { status: 'running' })
  const threshold = Date.now() - timeoutMs
  const timedOut: AgentTask[] = []

  for (const task of running) {
    const startedAt = task.startedAt ? Date.parse(task.startedAt) : NaN
    if (Number.isNaN(startedAt) || startedAt > threshold) continue

    const error = `Zaman aşımı: görev ${Math.round(timeoutMs / 1000)}sn içinde bitmedi (started_at: ${task.startedAt}).`
    const failed = await transitionTask(task.id, 'failed', {
      error,
      detail: { reason: 'timeout', timeoutMs },
    })

    // Ölü süreçten kalan ajan durumu: bu görevi uçuşta gösteren kayıt varsa
    // failed'a oturt — Live State yalan söylemesin.
    if (task.ownerAgent) {
      const info = deps.agentRuntime.get(task.ownerAgent)
      if (info.currentTaskId === task.id && (info.state === 'thinking' || info.state === 'working')) {
        await deps.agentRuntime.transition(task.ownerAgent, 'failed', { error, userId })
      }
    }

    await deps.bus.publish({
      type: 'task_timed_out',
      taskId: task.id,
      agentName: task.ownerAgent ?? undefined,
      department: task.department ?? undefined,
      workerId: deps.workerId,
      userId,
      detail: { timeoutMs, startedAt: task.startedAt },
    })
    timedOut.push(failed)
  }
  return timedOut
}
