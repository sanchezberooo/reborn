import type { BetaToolUseBlock, BetaMessageParam, BetaToolResultBlockParam, BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { anthropic, CLAUDE_MODEL, TOOLS, WEB_SEARCH_TOOL } from '@/lib/anthropic'
import { buildSystemPrompt } from '@/lib/sanchez-prompt'
import { serverExecuteTool } from '@/lib/agents/executor'
import type { ModuleItem } from '@/lib/modules'
import type { ChatEvent } from '@/lib/chat-events'

// NDJSON akış protokolü: her satır tek bir ChatEvent JSON'ı (bkz. lib/chat-events.ts).
// Gerçek token-bazlı streaming — istemci tarafı: components/chat/useSanchezChat.ts

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('ANTHROPIC_API_KEY eksik. .env.local dosyasına ekle.', { status: 503 })
  }

  const { messages, lastConversation, activeModule } = (await req.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    lastConversation?: { role: string; content: string }[]
    activeModule?: ModuleItem
  }

  const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
  const adminClient = getSupabaseAdmin()

  const profileResult = await adminClient.from('profiles').select('*').limit(1).single()
  const userId = profileResult.data?.id ?? ''

  const memoriesResult = await adminClient
    .from('memories')
    .select('id, summary, date')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  const { DEFAULT_PROFILE } = await import('@/lib/memory')
  const profileData = profileResult.data
  const profile = profileData ? {
    name: profileData.name ?? DEFAULT_PROFILE.name,
    age: profileData.age ?? DEFAULT_PROFILE.age,
    location: profileData.location ?? DEFAULT_PROFILE.location,
    goal: profileData.goal ?? DEFAULT_PROFILE.goal,
    ielts_target: profileData.ielts_target ?? DEFAULT_PROFILE.ielts_target,
    ielts_exam: profileData.ielts_exam ?? DEFAULT_PROFILE.ielts_exam,
    project: profileData.project ?? DEFAULT_PROFILE.project,
    application_deadline: profileData.application_deadline ?? DEFAULT_PROFILE.application_deadline,
    universities: profileData.universities ?? DEFAULT_PROFILE.universities,
    strengths: profileData.strengths ?? DEFAULT_PROFILE.strengths,
    weaknesses: profileData.weaknesses ?? DEFAULT_PROFILE.weaknesses,
  } : DEFAULT_PROFILE

  const memories = memoriesResult.data ?? []

  const systemPrompt = buildSystemPrompt(profile, memories, lastConversation, activeModule)
  const allTools = [...TOOLS, WEB_SEARCH_TOOL] as unknown as BetaToolUnion[]

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: ChatEvent) => controller.enqueue(enc.encode(JSON.stringify(event) + '\n'))

      try {
        const currentHistory: BetaMessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        while (true) {
          const stream = anthropic.beta.messages.stream({
            model: CLAUDE_MODEL,
            system: systemPrompt,
            messages: currentHistory,
            tools: allTools,
            max_tokens: 4096,
            betas: ['web-search-2025-03-05'],
          })

          // Gerçek zamanlı token akışı + araç başlangıcı bildirimi
          for await (const event of stream) {
            if (event.type === 'content_block_start') {
              const block = event.content_block
              if (block.type === 'tool_use' || block.type === 'server_tool_use') {
                send({ type: 'tool_start', name: block.name })
              }
            } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send({ type: 'text', text: event.delta.text })
            }
          }

          const response = await stream.finalMessage()

          if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') break

          if (response.stop_reason === 'tool_use') {
            const toolUses = response.content.filter(
              (b): b is BetaToolUseBlock => b.type === 'tool_use',
            )

            currentHistory.push({ role: 'assistant', content: response.content })

            const toolResults: BetaToolResultBlockParam[] = await Promise.all(
              toolUses.map(async (tu) => {
                try {
                  const result = await serverExecuteTool(tu.name, tu.input as Record<string, unknown>, userId)
                  const resultStr = typeof result === 'string' ? result : JSON.stringify(result)
                  void adminClient.from('agent_logs').insert({
                    agent_name: 'sanchez', action: tu.name, result: resultStr.slice(0, 500),
                  })
                  send({ type: 'tool_end', name: tu.name, ok: true })
                  return { type: 'tool_result' as const, tool_use_id: tu.id, content: resultStr }
                } catch (err) {
                  console.error(`[Reborn] tool ${tu.name} error:`, err)
                  send({ type: 'tool_end', name: tu.name, ok: false })
                  return {
                    type: 'tool_result' as const,
                    tool_use_id: tu.id,
                    content: `Hata: ${err instanceof Error ? err.message : 'Tool çalışmadı'}`,
                    is_error: true,
                  }
                }
              }),
            )

            currentHistory.push({ role: 'user', content: toolResults })
          }
        }

        send({ type: 'done' })
      } catch (err) {
        console.error('[Reborn] Claude error:', err)
        send({ type: 'error', message: 'Bir hata oluştu. Tekrar dene.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}
