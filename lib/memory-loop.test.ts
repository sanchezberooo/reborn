import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Hafıza döngüsü entegrasyon testi (CP1) — onboarding-flow.test.ts deseni:
// canlı Supabase + gerçek bge-m3; env yoksa skip. Döngünün iki yarısı birlikte
// doğrulanır:
//   1. YAZMA: MockProvider 'kaydet' senaryosuyla save_memory tool turu ister,
//      serverExecuteTool GERÇEKTEN çalıştırır → memories silo satırı + entities
//      köprü satırı (source_table='memories', embedding'li) doğar.
//   2. OKUMA: bir SONRAKİ chat çağrısının yaptığı aynı yol — buildChatContext
//      (hybridRetrieve) ilgili sorguda kaydı geri getirir ve buildSystemPrompt
//      bağlam bölümüne basar.
// Kayıtlar sentinel kullanıcı altında yaşar, sonda temizlenir.

import { MockProvider } from './ai/mock'
import { buildChatContext } from './ai/chat-context'
import { buildSystemPrompt } from './sanchez-prompt'
import { DEFAULT_PROFILE } from './memory'
import { TOOLS } from './ai/tools'
import type { AIMessage, AIStreamEvent, AITurn } from './ai/provider'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — fixture (…0001) ve onboarding (…000b) setleriyle karışmasın. */
const MEMORY_USER_ID = '00000000-0000-4000-a000-00000000000c'

const SENTINEL =
  'Bero mor lavanta çayını yalnızca dolunay gecelerinde içmeyi seviyor — benzersiz döngü test bilgisi.'
const USER_MESSAGE = `Şunu kaydet: ${SENTINEL}`
const RECALL_QUERY = 'lavanta çayını ne zaman içmeyi seviyorum?'

async function adminApi() {
  const { getSupabaseAdmin } = await import('./supabase-admin')
  return getSupabaseAdmin()
}
async function executorApi() {
  return import('./agents/executor')
}

/** Chat route'unun tek turunu taklit eder: stream'i tüket, metni ve turn'ü topla. */
async function runTurn(provider: MockProvider, system: string, messages: AIMessage[]) {
  const events: AIStreamEvent[] = []
  let turn: AITurn | null = null
  let text = ''
  for await (const e of provider.stream({ system, messages, tools: TOOLS, maxTokens: 1024 })) {
    events.push(e)
    if (e.type === 'text') text += e.text
    if (e.type === 'done') turn = e.turn
  }
  expect(turn).not.toBeNull()
  return { events, turn: turn!, text }
}

async function cleanup() {
  const supabase = await adminApi()
  // Entity silmek links'i cascade düşürür; memories silo satırı ayrıca silinir.
  await supabase.from('entities').delete().eq('user_id', MEMORY_USER_ID)
  await supabase.from('memories').delete().eq('user_id', MEMORY_USER_ID)
}

describe.skipIf(!hasEnv)('hafıza döngüsü (MockProvider + canlı Supabase + bge-m3)', () => {
  const provider = new MockProvider()
  const system = buildSystemPrompt(DEFAULT_PROFILE, [])
  let memoryId: string | null = null

  beforeAll(cleanup)
  afterAll(cleanup)

  it('tur 1: "kaydet" mesajı save_memory tool turu ister (tool_use)', async () => {
    const t = await runTurn(provider, system, [{ role: 'user', content: USER_MESSAGE }])
    expect(t.turn.stopReason).toBe('tool_use')
    expect(t.events.some((e) => e.type === 'tool_start' && e.name === 'save_memory')).toBe(true)
    expect(t.turn.toolUses).toHaveLength(1)
    expect(t.turn.toolUses[0].name).toBe('save_memory')
    expect(t.turn.toolUses[0].input.content).toBe(USER_MESSAGE)
  })

  it('yazma: serverExecuteTool → memories silo satırı + embedding\'li köprü entity', async () => {
    const { serverExecuteTool } = await executorApi()
    const result = (await serverExecuteTool(
      'save_memory',
      { content: SENTINEL, importance: 7, tags: ['test'], type: 'user_fact' },
      MEMORY_USER_ID,
    )) as { ok: boolean; memory_id: string; entity_synced: boolean }

    expect(result.ok).toBe(true)
    expect(result.entity_synced).toBe(true)
    memoryId = result.memory_id

    const supabase = await adminApi()
    const { data: memoryRow } = await supabase
      .from('memories')
      .select('id, content, summary, importance, type')
      .eq('id', memoryId)
      .single()
    expect(memoryRow!.content).toBe(SENTINEL)
    expect(memoryRow!.importance).toBe(7)

    const { data: entity } = await supabase
      .from('entities')
      .select('type, title, content, source_table, source_id, embedding')
      .eq('source_table', 'memories')
      .eq('source_id', memoryId)
      .single()
    expect(entity!.type).toBe('note')
    expect(entity!.content).toBe(SENTINEL)
    expect(entity!.title.length).toBeLessThanOrEqual(81) // 80 + '…'
    expect(JSON.parse(entity!.embedding as string) as number[]).toHaveLength(1024)
  }, 600_000) // ilk koşuda bge-m3 model yüklemesi burada ödenir

  it('okuma: sonraki chat çağrısının bağlam yolu (buildChatContext) kaydı geri getiriyor', async () => {
    const items = await buildChatContext(RECALL_QUERY, MEMORY_USER_ID)
    expect(items.length).toBeGreaterThan(0)
    const hit = items.find(
      (i) => i.title.includes('lavanta') || (i.snippet ?? '').includes('lavanta'),
    )
    expect(hit).toBeDefined()
    expect(hit!.type).toBe('note')

    // Route'un yaptığı gibi system prompt'a basılıyor mu?
    const prompt = buildSystemPrompt(DEFAULT_PROFILE, items)
    expect(prompt).toContain('İlgili hafıza')
    expect(prompt).toContain('lavanta')
  }, 120_000)

  it('tur 2: tool sonucu geri beslenince kapanış cevabı (end_turn)', async () => {
    const history: AIMessage[] = [
      { role: 'user', content: USER_MESSAGE },
      { role: 'assistant', content: 'Bunu hafızama işliyorum... ' },
      {
        role: 'tool_results',
        results: [{ toolUseId: 'mock-save-memory-1', content: JSON.stringify({ ok: true }) }],
      },
    ]
    const t = await runTurn(provider, system, history)
    expect(t.turn.stopReason).toBe('end_turn')
    expect(t.text).toContain('Kaydettim')
  })
})
