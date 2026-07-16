// Task Executor — görev yürütme stratejileri (Sprint 3, madde 11'in kancası).
// Sözleşme lib/runtime/types.ts TaskExecutor'dadır; worker yürütücü SEÇER,
// yürütücü İŞİ yapar. Bugün tek gerçek implementasyon vardır: ajan
// çalıştırması (runAgent). OpenClaw/n8n/MCP bağlandığı gün lib/integrations
// sözleşmeleri bir TaskExecutor arkasına sarılır ve worker'ın executors
// listesine eklenir — worker ve görev modeli DEĞİŞMEZ.

import 'server-only'
import { runAgent } from '../agents/runner'
import { linkRun } from '../tasks/repository'
import type { TaskExecutionContext, TaskExecutionOutcome, TaskExecutor } from './types'

/**
 * MAXAİ ajan çalıştırması: görev girdisini runAgent'a taşır, agent_runs izini
 * göreve iliştirir (run_linked event'i). Girdi sözleşmesi: task.input aynen
 * geçer; taskId/title/description zarfa eklenir ki ajan hangi iş emri
 * üzerinde çalıştığını bilsin (delegate_task'ın dependsOnCurrentTask'ı da
 * bu taskId'ye dayanır).
 */
export class AgentRunExecutor implements TaskExecutor {
  readonly id = 'agent-run'

  canExecute(): boolean {
    return true
  }

  async execute(ctx: TaskExecutionContext): Promise<TaskExecutionOutcome> {
    const { task, agentName, userId } = ctx
    const input: Record<string, unknown> = {
      taskId: task.id,
      title: task.title,
      ...(task.description ? { description: task.description } : {}),
      ...(task.input ?? {}),
    }

    const result = await runAgent(agentName, input, userId, { taskId: task.id })
    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    await linkRun(task.id, result.runId)
    return { ok: true, output: result.output, runId: result.runId }
  }
}
