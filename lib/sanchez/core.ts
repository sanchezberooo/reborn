// Sanchez Core — merkez orkestrasyon katmanı (Sprint 2, madde 1).
// REBORN'un merkezinde yalnız Sanchez vardır: kullanıcı yalnız onunla
// konuşur; Dashboard, Personal Brain, MAXAİ ajanları ve gelecekteki dış
// entegrasyonlar (lib/integrations) onun kullandığı araçlardır. Bu dosya o
// merkezin tek turluk düşünce hattını (observe → … → brain-update, bkz.
// lib/sanchez/types.ts) yürütür.
//
// TAŞIYICIDAN BAĞIMSIZ: core HTTP/ReadableStream bilmez — olayları
// SanchezEventSink'e basar. app/api/chat/route.ts yalnız NDJSON zarfıdır;
// yarın bir ChannelGateway (lib/integrations — OpenClaw rolü) aynı core'u
// başka bir taşıyıcıyla çağırabilir, çekirdek değişmez.
//
// DAVRANIŞ SÖZLEŞMESİ (eski route gövdesinden birebir devralındı):
//  * NDJSON olay protokolü korunur: text | tool_start | tool_end | done | error.
//  * Retrieval/onboarding hatası turu DÜŞÜRMEZ — boş bağlamla devam edilir.
//  * Tool hatası turu DÜŞÜRMEZ — modele isError sonucu döner.
//  * MAX_TOOL_ITERATIONS aşımı nazikçe kapanır (hata değil, açıklama metni).

import 'server-only'
import { getAIProvider, TOOLS, MAX_TOOL_ITERATIONS } from '../ai'
import type { AIMessage, AIToolResult, AITurn } from '../ai'
import { buildSystemPrompt } from '../sanchez-prompt'
import type { BeroProfile } from '../memory'
import type { RetrievedContextItem } from '../sanchez-prompt'
import { serverExecuteTool } from '../agents/executor'
import type { SanchezEventSink, SanchezTurnRequest } from './types'

interface ObservedState {
  userId: string
  profile: BeroProfile
  onboarding: boolean
}

/** [observe] Durum toplama: tek profil satırı + onboarding ihtiyacı.
 *  Onboarding sorgu hatası onboarding'i TETİKLEMEZ — normal akışa düşülür. */
async function observe(): Promise<ObservedState> {
  const { getSupabaseAdmin } = await import('../supabase-admin')
  const adminClient = getSupabaseAdmin()

  const profileResult = await adminClient.from('profiles').select('*').limit(1).single()
  const userId = profileResult.data?.id ?? ''

  const { DEFAULT_PROFILE } = await import('../memory')
  const profileData = profileResult.data
  const profile: BeroProfile = profileData ? {
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

  const { needsOnboarding } = await import('../db-server')
  const onboarding = userId ? await needsOnboarding(userId).catch(() => false) : false

  return { userId, profile, onboarding }
}

/** [understand] Niyet damıtma: retrieval sorgusu kullanıcının SON mesajıdır.
 *  (Gelişmiş sorgu damıtımı — çok-mesajlı niyet, sorgu yeniden yazımı —
 *  üretken katmana bağlıdır ve FAZ AI konusudur; kancası burasıdır.) */
function understand(request: SanchezTurnRequest): string {
  return [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
}

/** [retrieve] Hibrit hafıza getirimi (semantik + link grafı + recency).
 *  Hata boş bağlama düşer — sohbet embedding modeli olmadan da yaşar. */
async function retrieve(query: string, userId: string): Promise<RetrievedContextItem[]> {
  if (!userId) return []
  const { buildChatContext } = await import('../ai/chat-context')
  return buildChatContext(query, userId)
}

/** [execute] Tek turun tool çağrılarını yürütür ve sonuçları modele taşınacak
 *  biçimde döndürür. [delegate] run_agent burada MAXAİ'ye gider; [learn] ve
 *  [brain-update] model save_memory/save_goal çağırdığında lib/db-server'ın
 *  köprü entity + embedding senkronuyla burada gerçekleşir. Tool hatası turu
 *  düşürmez — modele isError sonucu döner. */
async function executeToolCalls(
  turn: AITurn,
  userId: string,
  send: SanchezEventSink,
): Promise<AIToolResult[]> {
  const { getSupabaseAdmin } = await import('../supabase-admin')
  const adminClient = getSupabaseAdmin()

  return Promise.all(
    turn.toolUses.map(async (tu) => {
      try {
        // callerAgent 'sanchez': delegasyon izinde "kim açtı" alanı — Sanchez
        // iş emri açtığında olay task_created'dır, task_delegated değil.
        const result = await serverExecuteTool(tu.name, tu.input, userId, { callerAgent: 'sanchez' })
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
}

/**
 * Sanchez'in tek turu — pipeline'ın tamamı. Olaylar sink'e basılır; normal
 * bitişte 'done', beklenmeyen hatada 'error' olayı GARANTİDİR (taşıyıcı
 * stream'i kapatmakla yükümlüdür, olay üretmekle değil).
 */
export async function runSanchezTurn(
  request: SanchezTurnRequest,
  send: SanchezEventSink,
): Promise<void> {
  try {
    // [observe] + [understand] + [retrieve] — deterministik hazırlık.
    const observed = await observe()
    const query = understand(request)
    const retrieved = await retrieve(query, observed.userId)

    // [reason] hazırlığı: bağlam system prompt'a dokunur. Yeni kullanıcı
    // (entities çekirdeği boş) onboarding bölümünü tetikler; MockProvider
    // aynı marker'la deterministik senaryoya girer (roadmap ilke 14).
    const systemPrompt = buildSystemPrompt(
      observed.profile,
      retrieved,
      request.lastConversation,
      request.activeModule,
      observed.onboarding,
    )
    const provider = getAIProvider()

    const currentHistory: AIMessage[] = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Kaçak döngü guard'ı: model üst üste MAX_TOOL_ITERATIONS'tan fazla
    // tool turu isterse akış nazikçe kapatılır — hata fırlatılmaz,
    // 'done' ile düzgün biter. Normal kullanım limite yaklaşmaz.
    let toolRounds = 0

    while (true) {
      // [reason] — model turu, gerçek zamanlı token akışı.
      // [plan] — modelin tool seçimi bu turun stopReason/toolUses'unda.
      let turn: AITurn | null = null

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

      if (toolRounds >= MAX_TOOL_ITERATIONS) {
        console.warn(`[Reborn] MAX_TOOL_ITERATIONS (${MAX_TOOL_ITERATIONS}) aşıldı — tool döngüsü durduruldu.`)
        send({
          type: 'text',
          text: '\n\nBu iş beklediğimden fazla adım gerektirdi; bu turu burada durdurdum. Devam etmemi istersen tekrar söyle.',
        })
        break
      }
      toolRounds++

      currentHistory.push({ role: 'assistant', content: turn.text, raw: turn.raw })

      // [delegate] + [execute] + [learn] + [brain-update] — üstteki
      // executeToolCalls notu; sonuçlar modele döner, döngü devam eder.
      const toolResults = await executeToolCalls(turn, observed.userId, send)
      currentHistory.push({ role: 'tool_results', results: toolResults })
    }

    send({ type: 'done' })
  } catch (err) {
    console.error('[Reborn] AI provider error:', err)
    send({ type: 'error', message: 'Bir hata oluştu. Tekrar dene.' })
  }
}
