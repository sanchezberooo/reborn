import type {
  AIProvider,
  AIProviderCapabilities,
  AIRequest,
  AIStreamEvent,
  AITurn,
} from './provider'
import { ONBOARDING_MARKER } from '../sanchez-prompt'

// MockProvider v1 — deterministik senaryo fixture'ları. API key'siz ve bakiyesiz
// geliştirme/test için: streaming, tool durum göstergeleri, hata toleransı ve
// özetleme uçtan uca gerçek AI olmadan çalışır (roadmap Faz 0 başarı kriteri #2).
//
// Senaryo seçimi SON KULLANICI MESAJINDAKİ anahtar kelimeyle yapılır (basit ve
// öngörülebilir):
//   'hata'                → birkaç token sonra Error fırlatır (hata yolu testi)
//   'araştır' veya 'web'  → sahte web_search: tool_start + sahte sonuçlu cevap
//   'hafıza' veya 'hatırla' → gerçek read_memories tool turu ister; sonuç dönünce
//                             ikinci turda cevap verir (tool döngüsü testi)
//   diğer her şey         → normal sohbet cevabı
//
// İSTİSNA — onboarding (Faz 2, Görev 3): system prompt ONBOARDING_MARKER
// içeriyorsa senaryo seçimi kelimeye değil KULLANICI MESAJI SAYISINA bağlanır
// (çok turlu, deterministik tanışma akışı — roadmap ilke 14):
//   1. kullanıcı mesajı → Sanchez kendini tanıtır + "kim olmak istiyorsun?" sorar
//   2. kullanıcı mesajı → cevaptan sabit varsayımla hedef taslağı çıkarır, onaya sunar
//   3+ ve onay kelimesi → GERÇEK save_goal tool turu ister (executor saveGoal'u
//                          gerçekten çalıştırır); sonuç dönünce kapanış mesajı
//   3+ ve onay yok      → mesaj yeni cevap sayılır, taslak onunla yeniden sunulur
//
// complete() için: system prompt 'özetle' içeriyorsa sabit özet fixture'ı,
// aksi halde JSON fixture (ajanların JSON-only çıktı sözleşmesi için) döner.

const TOKEN_DELAY_MS = 24

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function lastUserText(req: AIRequest): string {
  for (let i = req.messages.length - 1; i >= 0; i--) {
    const m = req.messages[i]
    if (m.role === 'user') return m.content.toLowerCase()
  }
  return ''
}

function hasToolResults(req: AIRequest): boolean {
  return req.messages.some((m) => m.role === 'tool_results')
}

/** Kullanıcı mesajlarını sırayla döndürür — onboarding tur sayacı ve
 *  "kim olmak istiyorsun" cevabının yakalanması için. */
function userMessages(req: AIRequest): string[] {
  const out: string[] = []
  for (const m of req.messages) if (m.role === 'user') out.push(m.content)
  return out
}

type Scenario = 'onboarding' | 'error' | 'web_search' | 'memory' | 'chat'

function pickScenario(req: AIRequest): Scenario {
  // Onboarding system marker'ı kelime senaryolarından ÖNCE gelir: tanışma
  // sohbetinde geçen "web" ya da "hata" kelimesi akışı raydan çıkarmasın.
  if (req.system.includes(ONBOARDING_MARKER)) return 'onboarding'
  const text = lastUserText(req)
  if (text.includes('hata')) return 'error'
  if (text.includes('araştır') || text.includes('web')) return 'web_search'
  if (text.includes('hafıza') || text.includes('hatırla')) return 'memory'
  return 'chat'
}

const APPROVAL_WORDS = ['evet', 'onay', 'kabul', 'tamam', 'olur']

function isApproval(text: string): boolean {
  const t = text.toLowerCase()
  return APPROVAL_WORDS.some((w) => t.includes(w))
}

// ─── Fixture metinleri ──────────────────────────────────────────────────────

const CHAT_RESPONSE =
  '[MOCK] Merhaba Bero. Şu an MockProvider ile konuşuyorsun — gerçek Sanchez, ' +
  'AI Aktivasyon fazında bağlanacak. Streaming, tool çağrıları ve hata akışı ' +
  'bu mock üzerinden uçtan uca test edilebilir. Denemek için mesajında ' +
  '"araştır", "hafıza" veya "hata" kelimelerini kullanabilirsin.'

const WEB_SEARCH_RESPONSE =
  '[MOCK] Web araştırması tamamlandı. Sahte sonuçlara göre: aradığın konu ' +
  'hakkında üç güncel kaynak buldum ve en önemli bulgu şu — bu cümle ' +
  'MockProvider fixture\'ıdır, gerçek arama sonucu değildir. Gerçek web_search ' +
  'AnthropicProvider ile çalışır.'

const MEMORY_INTRO = 'Hafızama bakıyorum... '

const MEMORY_RESPONSE =
  '[MOCK] Hafıza kayıtlarına baktım — read_memories aracı gerçekten çalıştı ve ' +
  'sonucu bana ulaştı (tool döngüsü sağlam). Kayıtların yorumu gerçek üretken ' +
  'AI bağlanınca yapılacak; bu cevap deterministik bir fixture.'

// ── Onboarding fixture'ları ──
// Hedef başlığı sabittir (mock'ta gerçek çıkarım yok); açıklama kullanıcının
// "kim olmak istiyorsun" cevabının kendisidir — deterministik ama kişisel:
// yazılan veri gerçekten kullanıcıdan gelir, tool yazımı gerçektir.

export const ONBOARDING_GOAL_TITLE = 'Olmak istediğim kişiye ilk adım'

const ONBOARDING_INTRO =
  '[MOCK] Merhaba. Ben Sanchez — Reborn\'un içinde yaşıyorum ve buradaki tek muhatabın benim. ' +
  'Klasik bir kurulum sihirbazı yok; tanışarak başlıyoruz. ' +
  'Tek bir sorum var, acele etme: kim olmak istiyorsun?'

const ONBOARDING_PROPOSAL_PREFIX =
  '[MOCK] Anladım. Söylediklerinden ilk hedefini şöyle çıkarıyorum:\n\n' +
  `**${ONBOARDING_GOAL_TITLE}**\n> `

const ONBOARDING_PROPOSAL_SUFFIX =
  '\n\nBunu ilk hedefin olarak kaydedeyim mi? Onaylıyorsan "evet" yaz; ' +
  'düzeltmek istersen yeniden anlat.'

const ONBOARDING_SAVING = 'Hedefini kaydediyorum... '

const ONBOARDING_DONE =
  '[MOCK] Kaydettim — ilk hedefin artık Reborn\'da yaşıyor ve hafızama bağlandı. ' +
  'Tanışma bu kadar; bundan sonrası birlikte inşa. Bu hedefi konuşmaya her zaman dönebiliriz.'

const SUMMARY_FIXTURE =
  '[MOCK] Sohbet özeti: Bero Sanchez ile konuştu; bu özet MockProvider tarafından üretilen sabit bir fixture\'dır.'

// ─── Provider ───────────────────────────────────────────────────────────────

export class MockProvider implements AIProvider {
  readonly name = 'mock'
  // Sahte web_search fixture'ı döndürebildiği için webSearch: true
  readonly capabilities: AIProviderCapabilities = { webSearch: true, embeddings: false }

  async complete(req: AIRequest): Promise<AITurn> {
    // Özet isteği hata senaryosundan ÖNCE: sohbet metninde 'hata' geçmesi özeti düşürmesin
    if (req.system.toLowerCase().includes('özetle')) {
      return { stopReason: 'end_turn', text: SUMMARY_FIXTURE, toolUses: [] }
    }
    if (pickScenario(req) === 'error') {
      throw new Error('MockProvider: hata senaryosu tetiklendi (mesajda "hata" geçiyor).')
    }
    // Ajanlar JSON-only çıktı sözleşmesiyle çalışır (lib/agents/runner.ts parser'ı)
    const output = JSON.stringify({
      mock: true,
      note: 'MockProvider çıktısı — gerçek ajan davranışı AI Aktivasyon fazında bağlanır.',
      input: lastUserText(req).slice(0, 200),
    })
    return { stopReason: 'end_turn', text: output, toolUses: [] }
  }

  async *stream(req: AIRequest): AsyncIterable<AIStreamEvent> {
    const scenario = pickScenario(req)

    if (scenario === 'onboarding') {
      yield* this.streamOnboarding(req)
      return
    }

    if (scenario === 'error') {
      yield* this.streamText('[MOCK] Bir şeyler ters gitmek üzere')
      throw new Error('MockProvider: hata senaryosu tetiklendi (mesajda "hata" geçiyor).')
    }

    if (scenario === 'web_search') {
      yield { type: 'tool_start', name: 'web_search' }
      await sleep(600) // sahte arama gecikmesi
      yield* this.streamText(WEB_SEARCH_RESPONSE)
      yield { type: 'done', turn: { stopReason: 'end_turn', text: WEB_SEARCH_RESPONSE, toolUses: [] } }
      return
    }

    if (scenario === 'memory' && !hasToolResults(req)) {
      // 1. tur: gerçek read_memories çağrısı iste — executor gerçekten çalışır
      yield* this.streamText(MEMORY_INTRO)
      yield { type: 'tool_start', name: 'read_memories' }
      yield {
        type: 'done',
        turn: {
          stopReason: 'tool_use',
          text: MEMORY_INTRO,
          toolUses: [{ id: 'mock-tool-use-1', name: 'read_memories', input: { limit: 5 } }],
        },
      }
      return
    }

    // 2. tur (tool sonucu geldi) veya normal sohbet
    const text = scenario === 'memory' ? MEMORY_RESPONSE : CHAT_RESPONSE
    yield* this.streamText(text)
    yield { type: 'done', turn: { stopReason: 'end_turn', text, toolUses: [] } }
  }

  /** Onboarding tanışma akışı — tur sayısı kullanıcı mesajı sayısıyla belirlenir
   *  (dosya başındaki senaryo tablosu). Tek gerçek yan etki: onay turundaki
   *  save_goal tool çağrısı — executor bunu gerçekten çalıştırır, hedef DB'ye yazılır. */
  private async *streamOnboarding(req: AIRequest): AsyncIterable<AIStreamEvent> {
    const users = userMessages(req)
    const last = users[users.length - 1] ?? ''
    // "Kim olmak istiyorsun" cevabı: ilk selamlama hariç, onay kelimesi olmayan
    // SON kullanıcı mesajı (kullanıcı taslağı reddedip yeniden anlatabilir).
    const answer =
      [...users.slice(1)].reverse().find((m) => !isApproval(m)) ?? users[1] ?? ''

    if (users.length <= 1) {
      yield* this.streamText(ONBOARDING_INTRO)
      yield { type: 'done', turn: { stopReason: 'end_turn', text: ONBOARDING_INTRO, toolUses: [] } }
      return
    }

    if (users.length >= 3 && isApproval(last)) {
      if (!hasToolResults(req)) {
        // Onay turu: gerçek save_goal çağrısı iste — metin mock, yazma gerçek.
        yield* this.streamText(ONBOARDING_SAVING)
        yield { type: 'tool_start', name: 'save_goal' }
        yield {
          type: 'done',
          turn: {
            stopReason: 'tool_use',
            text: ONBOARDING_SAVING,
            toolUses: [{
              id: 'mock-onboarding-goal',
              name: 'save_goal',
              input: { title: ONBOARDING_GOAL_TITLE, description: answer },
            }],
          },
        }
        return
      }
      yield* this.streamText(ONBOARDING_DONE)
      yield { type: 'done', turn: { stopReason: 'end_turn', text: ONBOARDING_DONE, toolUses: [] } }
      return
    }

    // 2. tur ya da 3+ turda onay gelmedi (yeni cevap): taslağı onaya sun.
    const proposal = ONBOARDING_PROPOSAL_PREFIX + answer + ONBOARDING_PROPOSAL_SUFFIX
    yield* this.streamText(proposal)
    yield { type: 'done', turn: { stopReason: 'end_turn', text: proposal, toolUses: [] } }
  }

  /** Metni kelime kelime, küçük gecikmelerle akıtır — gerçekçi token akışı taklidi. */
  private async *streamText(text: string): AsyncIterable<AIStreamEvent> {
    const chunks = text.split(/(?<=\s)/) // boşlukları koruyarak kelimelere böl
    for (const chunk of chunks) {
      await sleep(TOKEN_DELAY_MS)
      yield { type: 'text', text: chunk }
    }
  }

  async embed(): Promise<number[][]> {
    throw new Error('MockProvider.embed: henüz yok — embedding Faz 1\'de LocalEmbeddingProvider ile gelir.')
  }
}
