import { getAIProvider, TOOLS } from '@/lib/ai'
import type { AIMessage, AIToolResult, AITurn } from '@/lib/ai'
import { buildSystemPrompt } from '@/lib/sanchez-prompt'
import { serverExecuteTool } from '@/lib/agents/executor'
import type { ModuleItem } from '@/lib/modules'
import type { ChatEvent } from '@/lib/chat-events'

// NDJSON akış protokolü: her satır tek bir ChatEvent JSON'ı (bkz. lib/chat-events.ts).
// Gerçek token-bazlı streaming — istemci tarafı: components/chat/useSanchezChat.ts
//
// Tool-use döngüsü BURADA yaşar; provider (lib/ai) yalnızca tek model turunu
// soyutlar. AI_PROVIDER=mock ile bu route API key'siz uçtan uca çalışır.

export async function POST(req: Request) {
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

  // Yeni kullanıcı (entities çekirdeği boş) → tanışma sohbeti bölümü system
  // prompt'a eklenir; MockProvider bu marker'la onboarding senaryosuna girer
  // (roadmap ilke 14). Sorgu hatası onboarding'i tetiklemez, normal akışa düşer.
  const { needsOnboarding } = await import('@/lib/db-server')
  const onboarding = userId ? await needsOnboarding(userId).catch(() => false) : false

  const systemPrompt = buildSystemPrompt(profile, memories, lastConversation, activeModule, onboarding)
  const provider = getAIProvider()

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: ChatEvent) => controller.enqueue(enc.encode(JSON.stringify(event) + '\n'))

      try {
        const currentHistory: AIMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        while (true) {
          let turn: AITurn | null = null

          // Gerçek zamanlı token akışı + araç başlangıcı bildirimi
          for await (const event of provider.stream({
            system: systemPrompt,
            messages: currentHistory,
            tools: TOOLS,
            maxTokens: 4096,
            webSearch: true,
          })) {
            if (event.type === 'text') {
              send({ type: 'text', text: event.text })
            } else if (event.type === 'tool_start') {
              send({ type: 'tool_start', name: event.name })
            } else if (event.type === 'done') {
              turn = event.turn
            }
          }

          if (!turn || turn.stopReason !== 'tool_use') break

          currentHistory.push({ role: 'assistant', content: turn.text, raw: turn.raw })

          const toolResults: AIToolResult[] = await Promise.all(
            turn.toolUses.map(async (tu) => {
              try {
                const result = await serverExecuteTool(tu.name, tu.input, userId)
                const resultStr = typeof result === 'string' ? result : JSON.stringify(result)
                void adminClient.from('agent_logs').insert({
                  agent_name: 'sanchez', action: tu.name, result: resultStr.slice(0, 500),
                })
                send({ type: 'tool_end', name: tu.name, ok: true })
                return { toolUseId: tu.id, content: resultStr }
              } catch (err) {
                console.error(`[Reborn] tool ${tu.name} error:`, err)
                send({ type: 'tool_end', name: tu.name, ok: false })
                return {
                  toolUseId: tu.id,
                  content: `Hata: ${err instanceof Error ? err.message : 'Tool çalışmadı'}`,
                  isError: true,
                }
              }
            }),
          )

          currentHistory.push({ role: 'tool_results', results: toolResults })
        }

        send({ type: 'done' })
      } catch (err) {
        console.error('[Reborn] AI provider error:', err)
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
