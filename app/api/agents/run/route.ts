import type Anthropic from '@anthropic-ai/sdk'
import { anthropic, CLAUDE_MODEL, TOOLS } from '@/lib/anthropic'
import { getAgent } from '@/lib/agents/registry'
import { serverExecuteTool } from '@/lib/agents/executor'

type MessageParam = Anthropic.Messages.MessageParam
type ToolUseBlock = Anthropic.Messages.ToolUseBlock
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam

export async function POST(req: Request) {
  const { agentName, input } = (await req.json()) as {
    agentName: string
    input: Record<string, unknown>
  }

  const agent = getAgent(agentName)
  if (!agent) {
    return Response.json({ error: `Agent '${agentName}' not found` }, { status: 404 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: profile } = await supabase.from('profiles').select('id').limit(1).single()
  const userId = (profile?.id as string) ?? ''

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
    return Response.json({ error: 'Failed to create agent_runs row', detail: insertError?.message }, { status: 500 })
  }

  const runId = runRow.id as string

  try {
    const filteredTools = agent.toolNames.length > 0
      ? TOOLS.filter((t) => agent.toolNames.includes(t.name)) as Anthropic.Messages.Tool[]
      : undefined

    const messages: MessageParam[] = [
      { role: 'user', content: JSON.stringify(input) },
    ]

    let finalText = ''

    while (true) {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        system: agent.persona,
        messages,
        ...(filteredTools ? { tools: filteredTools } : {}),
        max_tokens: 2048,
      })

      for (const block of response.content) {
        if (block.type === 'text') finalText = block.text
      }

      if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') break

      if (response.stop_reason === 'tool_use') {
        const toolUses = response.content.filter(
          (b): b is ToolUseBlock => b.type === 'tool_use'
        )

        messages.push({ role: 'assistant', content: response.content })

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

        messages.push({ role: 'user', content: toolResults })
      }
    }

    const stripped = finalText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    let output: unknown
    try {
      output = JSON.parse(stripped)
    } catch {
      output = { raw: finalText }
    }

    await supabase.from('agent_runs').update({
      status: 'done',
      output,
      module_target: agent.moduleTarget,
      finished_at: new Date().toISOString(),
    }).eq('id', runId)

    const { data: finalRun } = await supabase.from('agent_runs').select('*').eq('id', runId).single()
    return Response.json(finalRun)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase.from('agent_runs').update({
      status: 'error',
      error: message,
      finished_at: new Date().toISOString(),
    }).eq('id', runId)
    return Response.json({ error: message }, { status: 500 })
  }
}
