import type {
  AIProvider,
  AIProviderCapabilities,
  AIRequest,
  AIStreamEvent,
  AITurn,
} from './provider'
import { ONBOARDING_MARKER } from '../sanchez-prompt'
import { KNOWLEDGE_AGENT_MARKER } from '../agents/knowledge-agent-prompt'

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
//   'kaydet'              → gerçek save_memory tool turu ister (content = son
//                            kullanıcı mesajı); sonuç dönünce kapanış cevabı
//                            (hafıza döngüsü testi — lib/memory-loop.test.ts)
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

type Scenario = 'onboarding' | 'error' | 'web_search' | 'memory' | 'save_memory' | 'chat'

function pickScenario(req: AIRequest): Scenario {
  // Onboarding system marker'ı kelime senaryolarından ÖNCE gelir: tanışma
  // sohbetinde geçen "web" ya da "hata" kelimesi akışı raydan çıkarmasın.
  if (req.system.includes(ONBOARDING_MARKER)) return 'onboarding'
  const text = lastUserText(req)
  if (text.includes('hata')) return 'error'
  if (text.includes('araştır') || text.includes('web')) return 'web_search'
  if (text.includes('hafıza') || text.includes('hatırla')) return 'memory'
  if (text.includes('kaydet')) return 'save_memory'
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

const SAVE_MEMORY_INTRO = 'Bunu hafızama işliyorum... '

const SAVE_MEMORY_DONE =
  '[MOCK] Kaydettim — save_memory aracı gerçekten çalıştı; bilgi Brain\'e ' +
  'embedding\'li bir entity olarak işlendi ve sonraki sohbetlerde retrieval ile geri gelir.'

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

// ── Knowledge Agent fixture'ı ──
// Deterministik "bu bir Fact'tir" senaryosu (lib/brain/knowledge-agent.test.ts):
// karar mock'tur ama brain_integrate yazımı GERÇEKTİR (onboarding'deki
// save_goal deseniyle aynı). Test, oluşan fact node'un içeriğini bu sabitle
// doğrular — export bu yüzden.

export const KNOWLEDGE_FACT_CONTENT =
  '[MOCK] Damıtılmış fact: bu içerik MockProvider Knowledge Agent senaryosunun sabit fixture\'ıdır.'

const KNOWLEDGE_SIGNAL_ID_RE =
  /\[signalId: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i

// ── Knowledge Agent RAPOR MODU fixture'ı ──
// Deterministik rapor senaryosu (lib/knowledge/report-mode.test.ts): input
// { mode:'report', sourceUrl } ise 1. turda GERÇEK fetch_source_overview
// çağrısı istenir (executor gerçekten çalışır: GitHub fetch + brainRelation
// hesabı); 2. turda tool sonucundaki alanlar prompt şablonunun TÜM zorunlu
// bölümlerini içeren sabit yapılı rapora dökülür. brain_integrate/brain_link
// bu senaryoda ASLA istenmez — rapor ephemeral sözleşmesinin mock karşılığı.

/** Rapor şablonunun zorunlu bölüm başlıkları (knowledge-agent-prompt.ts
 *  şablonuyla birebir) — testler raporda hepsinin varlığını doğrular. */
export const KNOWLEDGE_REPORT_SECTIONS = [
  '# Kaynak Analiz Raporu:',
  '## Bu Repo Ne Yapıyor / Neden Önemli',
  '## Brain ile İlişki',
  '## Reusable Assets',
  '## Kim Faydalanır',
  '## Brain Value Score:',
  '## Import Etmeye Değer mi?',
] as const

/** runAgent user mesajı JSON.stringify(input)'tır — rapor modu girdisi buradan
 *  ayıklanır; JSON değilse veya mode:'report' yoksa null (sinyal işleme yolu). */
function parseKnowledgeReportInput(req: AIRequest): { sourceUrl: string } | null {
  const users = userMessages(req)
  if (users.length === 0) return null
  try {
    const parsed = JSON.parse(users[0]) as { mode?: unknown; sourceUrl?: unknown }
    if (parsed.mode === 'report' && typeof parsed.sourceUrl === 'string') {
      return { sourceUrl: parsed.sourceUrl }
    }
  } catch { /* JSON değil → rapor modu değil */ }
  return null
}

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
    // Knowledge Agent senaryosu — system marker'ı kelime senaryolarından ÖNCE
    // gelir (onboarding deseni): sinyal içeriğinde geçen "hata" vb. kelimeler
    // akışı raydan çıkarmasın.
    if (req.system.includes(KNOWLEDGE_AGENT_MARKER)) {
      return this.completeKnowledgeAgent(req)
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

    if (scenario === 'save_memory' && !hasToolResults(req)) {
      // 1. tur: gerçek save_memory çağrısı iste — content, kullanıcının son
      // mesajının kendisidir (deterministik ama gerçek veri; onboarding'deki
      // save_goal deseniyle aynı: metin mock, yazma gerçek).
      const users = userMessages(req)
      yield* this.streamText(SAVE_MEMORY_INTRO)
      yield { type: 'tool_start', name: 'save_memory' }
      yield {
        type: 'done',
        turn: {
          stopReason: 'tool_use',
          text: SAVE_MEMORY_INTRO,
          toolUses: [{
            id: 'mock-save-memory-1',
            name: 'save_memory',
            input: { content: users[users.length - 1] ?? '', importance: 5, tags: ['mock'] },
          }],
        },
      }
      return
    }

    // 2. tur (tool sonucu geldi) veya normal sohbet
    const text =
      scenario === 'memory' ? MEMORY_RESPONSE :
      scenario === 'save_memory' ? SAVE_MEMORY_DONE :
      CHAT_RESPONSE
    yield* this.streamText(text)
    yield { type: 'done', turn: { stopReason: 'end_turn', text, toolUses: [] } }
  }

  /** Knowledge Agent akışı — deterministik "bu bir Fact'tir" senaryosu.
   *  1. tur: system prompt'taki bağlam bölümünden İLK bekleyen sinyalin id'si
   *  ayıklanır ve onun için GERÇEK brain_integrate çağrısı istenir (executor
   *  gerçekten çalışır: yeni cold node + derived_from kenarı yazılır).
   *  2. tur (tool sonucu geldi) veya bekleyen sinyal yok: ajanın çıktı
   *  sözleşmesine (registry outputContract) uyan kapanış JSON'ı döner. */
  private completeKnowledgeAgent(req: AIRequest): AITurn {
    // Rapor modu sinyal işlemeden ÖNCE ayrıştırılır (input'ta mode:'report'):
    // runner rapor modunda sinyal bağlamını zaten boş geçer ama seçim yine de
    // input'a bağlanır — iki mod asla karışmaz.
    const reportInput = parseKnowledgeReportInput(req)
    if (reportInput) return this.completeKnowledgeReport(req, reportInput.sourceUrl)

    const signalId = KNOWLEDGE_SIGNAL_ID_RE.exec(req.system)?.[1]

    if (signalId && !hasToolResults(req)) {
      return {
        stopReason: 'tool_use',
        text: '',
        toolUses: [{
          id: 'mock-knowledge-integrate-1',
          name: 'brain_integrate',
          input: { signalId, targetType: 'fact', content: KNOWLEDGE_FACT_CONTENT },
        }],
      }
    }

    // nodeId, executor'ın brain_integrate sonucundan okunur (varsa).
    let nodeId: string | null = null
    const toolMsg = [...req.messages].reverse().find((m) => m.role === 'tool_results')
    if (toolMsg?.role === 'tool_results') {
      try {
        nodeId = (JSON.parse(toolMsg.results[0]?.content ?? '{}') as { nodeId?: string }).nodeId ?? null
      } catch { /* bozuk sonuç → nodeId null kalır */ }
    }
    const output = JSON.stringify({
      processed: signalId ? [{ signalId, targetType: 'fact', nodeId }] : [],
      skipped: [],
      summary: signalId
        ? '[MOCK] Knowledge Agent senaryosu — bir sinyal fact olarak entegre edildi.'
        : '[MOCK] Knowledge Agent senaryosu — bekleyen sinyal yok.',
    })
    return { stopReason: 'end_turn', text: output, toolUses: [] }
  }

  /** Rapor modu akışı — deterministik senaryo (dosya başındaki fixture notu).
   *  1. tur: GERÇEK fetch_source_overview çağrısı (iki aşamalı maliyet
   *  kontrolünün mock karşılığı: ön-bakış yeterli sayılır, fetch_source_content
   *  BİLİNÇLİ istenmez). 2. tur: tool sonucundaki overview + brainRelation,
   *  zorunlu tüm bölümleri içeren sabit yapılı rapora dökülür ve
   *  { mode, sourceUrl, report } zarfıyla döner. Brain'e yazan tool YOK. */
  private completeKnowledgeReport(req: AIRequest, sourceUrl: string): AITurn {
    if (!hasToolResults(req)) {
      return {
        stopReason: 'tool_use',
        text: '',
        toolUses: [{
          id: 'mock-knowledge-report-overview',
          name: 'fetch_source_overview',
          input: { sourceUrl },
        }],
      }
    }

    let overview: {
      description?: string | null
      stars?: number
      language?: string | null
      topics?: string[]
      brainRelation?: {
        relatedNodes?: { id: string; type: string; title: string }[]
        similarityLevel?: string
        confidence?: string
      }
      ok?: boolean
      error?: string
    } = {}
    const toolMsg = [...req.messages].reverse().find((m) => m.role === 'tool_results')
    if (toolMsg?.role === 'tool_results') {
      try {
        overview = JSON.parse(toolMsg.results[0]?.content ?? '{}') as typeof overview
      } catch { /* bozuk sonuç → boş overview ile rapor yine kurulur */ }
    }

    const rel = overview.brainRelation ?? {}
    const relatedNodes = rel.relatedNodes ?? []
    const similarity = rel.similarityLevel ?? 'Low'
    const confidence = rel.confidence ?? 'Low'
    const relatedLines = relatedNodes.length > 0
      ? relatedNodes.map((n) => `  - ${n.id} — ${n.type} — ${n.title}`).join('\n')
      : '  - yok'

    const report = [
      `# Kaynak Analiz Raporu: ${sourceUrl}`,
      '',
      '## Bu Repo Ne Yapıyor / Neden Önemli',
      `[MOCK] ${overview.description ?? 'Açıklama yok'} — ${overview.stars ?? 0} yıldız, dil: ${overview.language ?? 'bilinmiyor'}. Bu özet MockProvider fixture'ıdır; gerçek analiz AnthropicProvider ile üretilir.`,
      '',
      '## Brain ile İlişki',
      `- Existing Related Knowledge: ${relatedNodes.length > 0 ? '[MOCK] ilgili node snippet özeti.' : "Brain'de bu alanda kayıtlı bilgi yok."}`,
      '- Related Nodes:',
      relatedLines,
      `- Similarity Level: ${similarity}`,
      `- Confidence: ${confidence}`,
      '',
      '## Reusable Assets',
      '- Detected Skills: tespit edilmedi',
      '- Detected Patterns: tespit edilmedi',
      '- Detected Workflows: tespit edilmedi',
      '- Detected Tool References: GitHub REST (API)',
      `- Detected Technologies: ${overview.language ?? 'tespit edilmedi'}`,
      `- Detected Libraries: ${(overview.topics ?? []).join(', ') || 'tespit edilmedi'}`,
      '- Detected Best Practices: tespit edilmedi',
      '- Detected Project Structure: tespit edilmedi',
      '',
      '## Kim Faydalanır',
      '- Hangi ajanlar: kesif-arastirmaci (kaba eşleştirme — mock fixture)',
      '- Hangi sektörlerde kullanılabilir: [MOCK] genel yazılım',
      '- Gereksiz / import edilmemesi gerekenler: [MOCK] belirtilecek bir şey yok',
      '',
      `## Brain Value Score: ${similarity === 'High' ? 'Low' : 'Medium'}`,
      '[MOCK] Üç bileşenin basit ortalaması: tekrarsızlık + kaynak güvenilirliği + yeniden kullanılabilirlik.',
      '',
      '## Import Etmeye Değer mi?',
      '[MOCK] Bu bir öneridir, karar değil — son karar senin.',
    ].join('\n')

    return {
      stopReason: 'end_turn',
      text: JSON.stringify({ mode: 'report', sourceUrl, report }),
      toolUses: [],
    }
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
