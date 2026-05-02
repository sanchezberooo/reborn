import type { BetaToolUseBlock, BetaMessageParam, BetaToolResultBlockParam, BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { anthropic, CLAUDE_MODEL, TOOLS, WEB_SEARCH_TOOL, executeTool } from '@/lib/anthropic'
import { buildSystemPrompt } from '@/lib/openai'
import { dbLoadProfile, dbLoadMemories } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { ModuleItem } from '@/lib/modules'

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('ANTHROPIC_API_KEY eksik. .env.local dosyasına ekle.', { status: 503 })
  }

  const { messages, lastConversation, activeModule } = (await req.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    lastConversation?: { role: string; content: string }[]
    activeModule?: ModuleItem
  }

  const data = await Promise.all([
    dbLoadProfile(),
    dbLoadMemories(),
  ]).catch(() => null)

  if (!data) {
    return new Response('Bağlantı sorunu. Tekrar dene.', { status: 503 })
  }

  const [profile, memories] = data
  const systemPrompt = buildSystemPrompt(profile, memories, lastConversation, activeModule)

  const allTools = [...TOOLS, WEB_SEARCH_TOOL] as unknown as BetaToolUnion[]

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()

      try {
        const currentHistory: BetaMessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        while (true) {
          const response = await anthropic.beta.messages.create({
            model: CLAUDE_MODEL,
            system: systemPrompt,
            messages: currentHistory,
            tools: allTools,
            max_tokens: 4096,
            betas: ['web-search-2025-03-05'],
          })

          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              controller.enqueue(enc.encode(block.text))
            }
          }

          if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
            break
          }

          if (response.stop_reason === 'tool_use') {
            const toolUses = response.content.filter(
              (b): b is BetaToolUseBlock => b.type === 'tool_use',
            )

            currentHistory.push({ role: 'assistant', content: response.content })

            const toolResults: BetaToolResultBlockParam[] = await Promise.all(
              toolUses.map(async (tu) => {
                try {
                  const result = await executeTool(tu.name, tu.input as Record<string, unknown>)
                  const resultStr = typeof result === 'string' ? result : JSON.stringify(result)

                  // agent_logs'a başarılı tool çağrısını kaydet
                  void supabase.from('agent_logs').insert({
                    agent_name: 'sanchez',
                    action: tu.name,
                    result: resultStr.slice(0, 500),
                  })

                  return {
                    type: 'tool_result' as const,
                    tool_use_id: tu.id,
                    content: resultStr,
                  }
                } catch (err) {
                  console.error(`[Reborn] tool ${tu.name} error:`, err)
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
      } catch (err) {
        console.error('[Reborn] Claude error:', err)
        controller.enqueue(enc.encode('Bir hata oluştu. Tekrar dene.'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
