import type Anthropic from '@anthropic-ai/sdk'
import { anthropic, CLAUDE_MODEL, TOOLS, WEB_SEARCH_TOOL } from '@/lib/anthropic'
import { getAgent } from '@/lib/agents/registry'
import { serverExecuteTool } from '@/lib/agents/executor'

type MessageParam = Anthropic.Messages.MessageParam
type ToolUseBlock = Anthropic.Messages.ToolUseBlock
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam

export type AgentRunResult =
  | { ok: true; output: unknown; runId: string }
  | { ok: false; error: string; notFound?: true }

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
    const customTools = agent.toolNames.length > 0
      ? TOOLS.filter((t) => agent.toolNames.includes(t.name)) as Anthropic.Messages.Tool[]
      : []

    const useWebSearch = Boolean(agent.webSearch)
    const toolsForCall: Anthropic.Messages.Tool[] = useWebSearch
      ? [...customTools, WEB_SEARCH_TOOL]
      : customTools

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiCreate: (p: Record<string, unknown>) => Promise<any> = useWebSearch
      ? (p) => (anthropic.beta.messages as unknown as { create: (p: Record<string, unknown>) => Promise<unknown> })
          .create({ ...p, betas: ['web-search-2025-03-05'] })
      : (p) => anthropic.messages.create(p as unknown as Anthropic.MessageCreateParamsNonStreaming)

    const messages: MessageParam[] = [
      { role: 'user', content: JSON.stringify(input) },
    ]

    let finalText = ''

    while (true) {
      const response = await apiCreate({
        model: CLAUDE_MODEL,
        system: agent.persona,
        messages,
        ...(toolsForCall.length > 0 ? { tools: toolsForCall } : {}),
        max_tokens: agent.maxTokens ?? 2048,
      })

      for (const block of response.content as { type: string; text?: string }[]) {
        if (block.type === 'text') finalText += block.text ?? ''
      }

      if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') break

      if (response.stop_reason === 'tool_use') {
        const toolUses = (response.content as { type: string }[]).filter(
          (b): b is ToolUseBlock => b.type === 'tool_use'
        )

        messages.push({ role: 'assistant', content: response.content as MessageParam['content'] })

        const toolResults: ToolResultBlockParam[] = await Promise.all(
          toolUses.map(async (tu) => {
            const result = await serverExecuteTool(tu.name, tu.input as Record<string, unknown>, userId)
            const resultStr = typeof result === 'string' ? result : JSON.stringify(result)
            void supabase.from('agent_logs').insert({
              run_id: runId,
              agent_name: agentName,
              action: tu.name,
              result: resultStr.slice(0, 500),
            })
            return { type: 'tool_result' as const, tool_use_id: tu.id, content: resultStr }
          })
        )

        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults })
        } else {
          break
        }
      }
    }

    const debracketed = finalText
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim()
    const firstBrace = debracketed.indexOf('{')
    const lastBrace  = debracketed.lastIndexOf('}')
    const candidate  = firstBrace !== -1 && lastBrace > firstBrace
      ? debracketed.slice(firstBrace, lastBrace + 1)
      : debracketed

    let output: unknown
    try {
      output = JSON.parse(candidate)
    } catch {
      output = { parseError: true, rawLength: finalText.length, raw: finalText }
    }

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
