import { getAIProvider, TOOLS } from '@/lib/ai'
import type { AIMessage, AIToolResult } from '@/lib/ai'
import { getAgent } from '@/lib/agents/registry'
import { serverExecuteTool } from '@/lib/agents/executor'

export type AgentRunResult =
  | { ok: true; output: unknown; runId: string }
  | { ok: false; error: string; notFound?: true }

/**
 * Ajanların JSON-only çıktı sözleşmesini ayıklar: kod bloklu (```json ... ```)
 * sarmalamayı kaldırır, ilk `{` ile son `}` arasını alır, parse eder. Bozuk
 * çıktıda veri kaybetmeden `parseError` fallback'ine düşer.
 */
export function parseAgentOutput(finalText: string): unknown {
  const debracketed = finalText
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()
  const firstBrace = debracketed.indexOf('{')
  const lastBrace  = debracketed.lastIndexOf('}')
  const candidate  = firstBrace !== -1 && lastBrace > firstBrace
    ? debracketed.slice(firstBrace, lastBrace + 1)
    : debracketed

  try {
    return JSON.parse(candidate)
  } catch {
    return { parseError: true, rawLength: finalText.length, raw: finalText }
  }
}

export async function runAgent(
  agentName: string,
  input: Record<string, unknown>,
  userId: string
): Promise<AgentRunResult> {
  const agent = getAgent(agentName)
  if (!agent) return { ok: false, error: `Agent '${agentName}' bulunamadı`, notFound: true }

  const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
  const supabase = getSupabaseAdmin()

  const { data: runRow, error: insertError } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: agentName,
      status: 'running',
      input,
      started_at: new Date().toISOString(),
      user_id: userId,
    })
    .select()
    .single()

  if (insertError || !runRow) {
    return { ok: false, error: insertError?.message ?? 'agent_runs satırı oluşturulamadı' }
  }

  const runId = runRow.id as string

  try {
    const provider = getAIProvider()

    const customTools = agent.toolNames.length > 0
      ? TOOLS.filter((t) => agent.toolNames.includes(t.name))
      : []

    const messages: AIMessage[] = [
      { role: 'user', content: JSON.stringify(input) },
    ]

    let finalText = ''

    while (true) {
      const turn = await provider.complete({
        model: agent.model,
        system: agent.persona,
        messages,
        tools: customTools,
        maxTokens: agent.maxTokens ?? 2048,
        webSearch: Boolean(agent.webSearch),
      })

      finalText += turn.text

      if (turn.stopReason !== 'tool_use') break

      messages.push({ role: 'assistant', content: turn.text, raw: turn.raw })

      const toolResults: AIToolResult[] = await Promise.all(
        turn.toolUses.map(async (tu) => {
          const result = await serverExecuteTool(tu.name, tu.input, userId)
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result)
          void supabase.from('agent_logs').insert({
            run_id: runId,
            agent_name: agentName,
            action: tu.name,
            result: resultStr.slice(0, 500),
          })
          return { toolUseId: tu.id, content: resultStr }
        })
      )

      if (toolResults.length > 0) {
        messages.push({ role: 'tool_results', results: toolResults })
      } else {
        break
      }
    }

    const output = parseAgentOutput(finalText)

    await supabase.from('agent_runs').update({
      status: 'done',
      output,
      module_target: agent.moduleTarget,
      finished_at: new Date().toISOString(),
    }).eq('id', runId)

    return { ok: true, output, runId }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('agent_runs').update({
      status: 'error',
      error: message,
      finished_at: new Date().toISOString(),
    }).eq('id', runId)
    return { ok: false, error: message }
  }
}
