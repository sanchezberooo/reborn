import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Onboarding akışı entegrasyon testi (Faz 2, Görev 3) — goals-sync.test.ts
// deseni: canlı Supabase + gerçek bge-m3; env yoksa skip. Akış, chat route'unun
// tool döngüsünün birebir simülasyonudur: MockProvider onboarding senaryosunu
// turlar halinde oynar, onay turundaki save_goal çağrısı serverExecuteTool ile
// GERÇEKTEN çalıştırılır ve hedefin DB'de doğduğu doğrulanır. Kayıtlar fixture
// setinden ayrı bir sentinel kullanıcı altında yaşar, sonda temizlenir.

import { MockProvider, ONBOARDING_GOAL_TITLE } from './ai/mock'
import { buildSystemPrompt, ONBOARDING_MARKER } from './sanchez-prompt'
import { DEFAULT_PROFILE } from './memory'
import { TOOLS } from './ai/tools'
import type { AIMessage, AIStreamEvent, AITurn } from './ai/provider'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — fixture setiyle (…0001) karışmasın diye ayrı sentinel. */
const ONBOARDING_USER_ID = '00000000-0000-4000-a000-00000000000b'

async function dbApi() {
  return import('./db-server')
}
async function adminApi() {
  const { getSupabaseAdmin } = await import('./supabase-admin')
  return getSupabaseAdmin()
}
async function executorApi() {
  return import('./agents/executor')
}

// goals tablosu var mı? (migration 0002 önkoşulu — goals-sync.test.ts notu)
const goalsTableReady = hasEnv
  ? await (async () => {
      const supabase = await adminApi()
      const { error } = await supabase.from('goals').select('id').limit(1)
      if (error) {
        console.warn(
          `[onboarding-flow.test] goals tablosu yok (${error.code}) — migration 0002_goals.sql uygulanınca bu suite koşar.`,
        )
        return false
      }
      return true
    })()
  : false

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

const ANSWER =
  'Disiplinli, İngilizcesi güçlü ve kendi sistemini kendisi inşa eden bir mühendis olmak istiyorum.'

describe.skipIf(!hasEnv || !goalsTableReady)('onboarding akışı (MockProvider + canlı Supabase)', () => {
  const provider = new MockProvider()
  const system = buildSystemPrompt(DEFAULT_PROFILE, [], undefined, undefined, true)
  let savedGoalId: string | null = null

  beforeAll(async () => {
    // Önceki yarım koşulardan kalıntı olmasın — sentinel kullanıcı sıfırlanır.
    const supabase = await adminApi()
    await supabase.from('entities').delete().eq('user_id', ONBOARDING_USER_ID)
  })

  afterAll(async () => {
    const supabase = await adminApi()
    // Entity silmek yeterli: goals uzantısı ve links FK cascade ile düşer.
    await supabase.from('entities').delete().eq('user_id', ONBOARDING_USER_ID)
  })

  it('yeni kullanıcı tespiti: entities boşken needsOnboarding true', async () => {
    const { needsOnboarding } = await dbApi()
    expect(await needsOnboarding(ONBOARDING_USER_ID)).toBe(true)
  }, 60_000)

  it('system prompt: onboarding bayrağı marker bölümünü ekler', () => {
    expect(system).toContain(ONBOARDING_MARKER)
    expect(buildSystemPrompt(DEFAULT_PROFILE, [])).not.toContain(ONBOARDING_MARKER)
  })

  it('tur 1: Sanchez tanışır ve "kim olmak istiyorsun" sorusunu sorar', async () => {
    const t1 = await runTurn(provider, system, [
      { role: 'user', content: 'Merhaba Sanchez, tanışalım' },
    ])
    expect(t1.turn.stopReason).toBe('end_turn')
    expect(t1.text.toLowerCase()).toContain('kim olmak istiyorsun')
    // 'merhaba' içindeki 'web' benzeri kelime senaryoları devreye girmemeli
    expect(t1.turn.toolUses).toHaveLength(0)
  })

  it('tur 2: cevaptan hedef taslağı çıkarır ve onaya sunar', async () => {
    const t1 = await runTurn(provider, system, [
      { role: 'user', content: 'Merhaba Sanchez, tanışalım' },
    ])
    const t2 = await runTurn(provider, system, [
      { role: 'user', content: 'Merhaba Sanchez, tanışalım' },
      { role: 'assistant', content: t1.text },
      { role: 'user', content: ANSWER },
    ])
    expect(t2.turn.stopReason).toBe('end_turn')
    expect(t2.text).toContain(ONBOARDING_GOAL_TITLE)
    expect(t2.text).toContain(ANSWER) // taslak kullanıcının kendi cevabını taşır
    expect(t2.text.toLowerCase()).toContain('evet') // onay talimatı
  })

  it('tur 3 (onay yok): yeni cevap sayılır, taslak onunla yeniden sunulur', async () => {
    const revised = 'Aslında önce IELTS 7.5 alan biri olmak istiyorum.'
    const t = await runTurn(provider, system, [
      { role: 'user', content: 'Merhaba Sanchez, tanışalım' },
      { role: 'assistant', content: 'intro' },
      { role: 'user', content: ANSWER },
      { role: 'assistant', content: 'taslak' },
      { role: 'user', content: revised },
    ])
    expect(t.turn.stopReason).toBe('end_turn')
    expect(t.text).toContain(revised)
    expect(t.text).not.toContain(ANSWER)
  })

  it('tur 3 (onay): gerçek save_goal turu → hedef DB\'de doğar → kapanış', async () => {
    const history: AIMessage[] = [
      { role: 'user', content: 'Merhaba Sanchez, tanışalım' },
      { role: 'assistant', content: 'intro' },
      { role: 'user', content: ANSWER },
      { role: 'assistant', content: 'taslak' },
      { role: 'user', content: 'Evet, kaydet.' },
    ]

    // 1. model turu: tool_use istenir (metin mock, istek gerçek)
    const t3 = await runTurn(provider, system, history)
    expect(t3.turn.stopReason).toBe('tool_use')
    expect(t3.events.some((e) => e.type === 'tool_start' && e.name === 'save_goal')).toBe(true)
    expect(t3.turn.toolUses).toHaveLength(1)
    const toolUse = t3.turn.toolUses[0]
    expect(toolUse.name).toBe('save_goal')
    expect(toolUse.input.title).toBe(ONBOARDING_GOAL_TITLE)
    expect(toolUse.input.description).toBe(ANSWER)

    // 2. tool yürütme: route'un yaptığı gibi serverExecuteTool — GERÇEK yazma
    const { serverExecuteTool } = await executorApi()
    const result = (await serverExecuteTool(
      toolUse.name,
      toolUse.input,
      ONBOARDING_USER_ID,
    )) as { ok: boolean; goal_id: string; title: string; status: string }
    expect(result.ok).toBe(true)
    expect(result.title).toBe(ONBOARDING_GOAL_TITLE)
    savedGoalId = result.goal_id

    // 3. model turu: tool sonucu geri beslenir → kapanış mesajı
    history.push({ role: 'assistant', content: t3.text })
    history.push({
      role: 'tool_results',
      results: [{ toolUseId: toolUse.id, content: JSON.stringify(result) }],
    })
    const t4 = await runTurn(provider, system, history)
    expect(t4.turn.stopReason).toBe('end_turn')
    expect(t4.text).toContain('Kaydettim')
  }, 600_000) // ilk koşuda bge-m3 model yüklemesi burada ödenir

  it('doğrulama: goal gerçekten yazıldı — native entity + goals uzantısı + embedding', async () => {
    expect(savedGoalId).not.toBeNull()
    const supabase = await adminApi()

    const { data: goalRow } = await supabase
      .from('goals')
      .select('id, user_id, status, parent_goal_id')
      .eq('id', savedGoalId!)
      .single()
    expect(goalRow!.user_id).toBe(ONBOARDING_USER_ID)
    expect(goalRow!.status).toBe('active')

    const { data: entity } = await supabase
      .from('entities')
      .select('type, title, content, source_table, embedding')
      .eq('id', savedGoalId!)
      .single()
    expect(entity!.type).toBe('goal')
    expect(entity!.title).toBe(ONBOARDING_GOAL_TITLE)
    expect(entity!.content).toBe(ANSWER) // açıklama = kullanıcının kendi cevabı
    expect(entity!.source_table).toBeNull() // native mod — köprü değil
    expect(JSON.parse(entity!.embedding as string) as number[]).toHaveLength(1024)
  }, 60_000)

  it('onboarding söner: ilk entity doğunca needsOnboarding false', async () => {
    const { needsOnboarding } = await dbApi()
    expect(await needsOnboarding(ONBOARDING_USER_ID)).toBe(false)
  }, 60_000)
})
