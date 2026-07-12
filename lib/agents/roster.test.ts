import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// MAXAİ departman rosteri testi — üç sözleşmeyi korur:
// 1. Geriye uyumluluk: 7 deprecated ajan registry'den HÂLÂ okunabilir
//    (eski agent_runs geçmişi getAgent ile çözülmeye devam eder) ama
//    Sanchez'in system prompt'unda ve run_agent tool açıklamasında GÖRÜNMEZ.
// 2. Roster bütünlüğü: 5 yeni departman ajanı doğru metadata ile kayıtlı;
//    brain_integrate SADECE knowledge-agent'ın tool listesinde.
// 3. Uçtan uca: yeni bir ajan runner üzerinden MockProvider ile çalışır
//    (knowledge-agent.test.ts deseni: canlı Supabase, sentinel kullanıcı,
//    env yoksa o grup skip — saf registry/prompt testleri her yerde koşar).

// getAIProvider ilk çağrıda cache'ler — runAgent'tan önce mock'a sabitle.
process.env.AI_PROVIDER = 'mock'

import { AGENTS, getAgent } from './registry'
import { runAgent } from './runner'
import { buildSystemPrompt } from '../sanchez-prompt'
import { DEFAULT_PROFILE } from '../memory'
import { TOOLS } from '../ai'

const DEPRECATED_AGENTS = [
  'ingilizce-genel-plan',
  'ingilizce-planlayici',
  'kesif-arastirmaci',
  'burs-toplu-arastirma',
  'burs-derinlestir',
  'essay-brainstorm',
  'essay-critic',
] as const

const NEW_DEPARTMENT_AGENTS = [
  'growth-agent',
  'creative-agent',
  'builder-agent',
  'client-success-agent',
  'operations-agent',
] as const

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — knowledge-agent (…000e), brain (…000d), memory-loop
 *  (…000c), onboarding (…000b) setleriyle çakışmayan yeni sentinel. */
const ROSTER_USER_ID = '00000000-0000-4000-a000-00000000000f'

describe('deprecated ajanlar — geriye uyumluluk', () => {
  it.each(DEPRECATED_AGENTS)('%s registry\'den hâlâ okunabilir ve legacy işaretli', (name) => {
    const agent = getAgent(name)
    expect(agent).not.toBeNull()
    expect(agent!.deprecated).toBe(true)
    expect(agent!.department).toBe('legacy')
    // Emeklilik davranışı bozmamalı: persona ve çıktı sözleşmesi yerinde.
    expect(agent!.persona.length).toBeGreaterThan(0)
    expect(agent!.outputContract.length).toBeGreaterThan(0)
  })

  it('Sanchez system prompt\'unda hiçbir deprecated ajan listelenmez', () => {
    const prompt = buildSystemPrompt(DEFAULT_PROFILE, [])
    for (const name of DEPRECATED_AGENTS) {
      expect(prompt).not.toContain(name)
    }
  })

  it('run_agent tool açıklamasında hiçbir deprecated ajan geçmez', () => {
    const runAgentTool = TOOLS.find((t) => t.name === 'run_agent')
    expect(runAgentTool).toBeDefined()
    const schemaText = JSON.stringify(runAgentTool!.inputSchema) + runAgentTool!.description
    for (const name of DEPRECATED_AGENTS) {
      expect(schemaText).not.toContain(name)
    }
  })
})

describe('yeni departman rosteri — kayıt bütünlüğü', () => {
  it.each(NEW_DEPARTMENT_AGENTS)('%s registry\'de doğru metadata ile kayıtlı', (name) => {
    const agent = getAgent(name)
    expect(agent).not.toBeNull()
    expect(agent!.deprecated).toBeFalsy()
    expect(agent!.department).toBeTruthy()
    expect(agent!.department).not.toBe('legacy')
    // v1 roster kararları: hepsi haiku, hepsi taslak-üretici (persona'da sınır).
    expect(agent!.model).toBe('claude-haiku-4-5')
    expect(agent!.persona).toContain('MUTLAK SINIR')
  })

  it('Sanchez system prompt\'u yeni rosteri ve knowledge-agent\'ı listeler', () => {
    const prompt = buildSystemPrompt(DEFAULT_PROFILE, [])
    for (const name of [...NEW_DEPARTMENT_AGENTS, 'knowledge-agent']) {
      expect(prompt).toContain(name)
    }
  })

  it('brain_integrate SADECE knowledge-agent\'ın tool listesinde', () => {
    for (const agent of Object.values(AGENTS)) {
      if (agent.name === 'knowledge-agent') {
        expect(agent.toolNames).toContain('brain_integrate')
      } else {
        expect(agent.toolNames).not.toContain('brain_integrate')
      }
    }
  })
})

describe.skipIf(!hasEnv)('yeni ajan runner üzerinden uçtan uca (MockProvider + canlı Supabase)', () => {
  async function adminApi() {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    return getSupabaseAdmin()
  }

  async function cleanup() {
    const supabase = await adminApi()
    // agent_runs silmek agent_logs satırlarını FK cascade ile düşürür.
    await supabase.from('agent_runs').delete().eq('user_id', ROSTER_USER_ID)
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  it('growth-agent runAgent ile çalışır: ok döner, agent_runs satırı done olur', async () => {
    const result = await runAgent(
      'growth-agent',
      { objective: 'Roster testi için sahte hedef — MockProvider fixture bekleniyor.' },
      ROSTER_USER_ID,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // MockProvider.complete ajanlara JSON fixture döndürür (JSON-only sözleşme).
    expect(result.output).toMatchObject({ mock: true })

    const supabase = await adminApi()
    const { data: run } = await supabase
      .from('agent_runs')
      .select('agent_name, status, output')
      .eq('id', result.runId)
      .single()
    expect(run).toMatchObject({ agent_name: 'growth-agent', status: 'done' })
  }, 60_000)
})
