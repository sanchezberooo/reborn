import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Rapor modu testleri (CP4) — iki katman:
//
// 1. MockProvider senaryo birimi (HER ZAMAN koşar, DB'siz): rapor modu
//    input'u 1. turda fetch_source_overview ister (brain_integrate ASLA),
//    2. turda tool sonucunu zorunlu tüm bölümleri içeren rapor zarfına döker.
// 2. Uçtan uca (knowledge-agent.test.ts deseni: canlı Supabase + gerçek
//    bge-m3; env/migration yoksa skip): runAgent(mode:'report') akışının
//    Brain'e SIFIR iz bıraktığı + rapor yapısı. GitHub ağı DETERMİNİSTİK:
//    yalnız api.github.com istekleri sabit fixture'a yönlendirilir, Supabase
//    trafiği gerçek fetch'ten geçmeye devam eder.
// 3. (4b) Rapor sonrası mevcut manuel createSignal → brain_integrate akışının
//    bozulmadığının TEYİDİ — yeni mekanizma yok, mevcut araçlar çağrılır.
//
// KİMLİK VE TEMİZLİK: sentinel REPORT_USER_ID (…0010 — …000b onboarding,
// …000c memory-loop, …000d brain, …000e knowledge, …000f retrieval-scale
// setleriyle çakışmaz); beforeAll/afterAll entities + agent_runs satırlarını
// siler.

// getAIProvider ilk çağrıda cache'ler — runAgent'tan önce mock'a sabitle.
process.env.AI_PROVIDER = 'mock'

import { MockProvider, KNOWLEDGE_REPORT_SECTIONS } from '../ai/mock'
import { buildKnowledgeAgentPrompt } from '../agents/knowledge-agent-prompt'
import type { AIMessage } from '../ai/provider'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const REPORT_USER_ID = '00000000-0000-4000-a000-000000000010'
const REPO_URL = 'https://github.com/reborn-test/fixture-repo'

// ── Sabit GitHub fixture'ı (4a: "sabit repo verisi") ────────────────────────

const FIXTURE_REPO_META = {
  description: 'Deterministik test reposu — report-mode e2e fixture verisi',
  stargazers_count: 1234,
  language: 'TypeScript',
  topics: ['testing', 'fixtures'],
}
const FIXTURE_README =
  '# Fixture Repo\n\nBu README, report-mode uçtan uca testinin sabit GitHub verisidir.'

/** Mock tool sonucu — executor'ın fetch_source_overview çıktısıyla aynı şekil
 *  (overview + brainRelation); birim katman bunu elle enjekte eder. */
const UNIT_TOOL_RESULT = {
  sourceUrl: REPO_URL,
  sourceType: 'github',
  description: FIXTURE_REPO_META.description,
  stars: FIXTURE_REPO_META.stargazers_count,
  language: FIXTURE_REPO_META.language,
  topics: FIXTURE_REPO_META.topics,
  readmeExcerpt: FIXTURE_README,
  brainRelation: {
    relatedNodes: [{ id: '11111111-1111-4111-a111-111111111111', type: 'fact', title: 'İlgili test node' }],
    similarityLevel: 'Medium',
    confidence: 'Low',
  },
}

// ─── 1. MockProvider rapor senaryosu (DB'siz, her zaman koşar) ──────────────

describe('MockProvider rapor modu senaryosu (deterministik, DB\'siz)', () => {
  const provider = new MockProvider()
  const system = buildKnowledgeAgentPrompt() // rapor modunda sinyal bağlamı yok
  const reportInput = JSON.stringify({ mode: 'report', sourceUrl: REPO_URL })

  it('1. tur: fetch_source_overview istenir — Brain\'e yazan tool ASLA', async () => {
    const turn = await provider.complete({
      system,
      messages: [{ role: 'user', content: reportInput }],
    })
    expect(turn.stopReason).toBe('tool_use')
    expect(turn.toolUses).toHaveLength(1)
    expect(turn.toolUses[0].name).toBe('fetch_source_overview')
    expect(turn.toolUses[0].input).toEqual({ sourceUrl: REPO_URL })
  })

  it('2. tur: zorunlu tüm bölümleri içeren rapor zarfı döner, seviyeler aynen taşınır', async () => {
    const messages: AIMessage[] = [
      { role: 'user', content: reportInput },
      { role: 'assistant', content: '' },
      {
        role: 'tool_results',
        results: [{ toolUseId: 'mock-knowledge-report-overview', content: JSON.stringify(UNIT_TOOL_RESULT) }],
      },
    ]
    const turn = await provider.complete({ system, messages })
    expect(turn.stopReason).toBe('end_turn')
    expect(turn.toolUses).toHaveLength(0)

    const output = JSON.parse(turn.text) as { mode: string; sourceUrl: string; report: string }
    expect(output.mode).toBe('report')
    expect(output.sourceUrl).toBe(REPO_URL)
    for (const section of KNOWLEDGE_REPORT_SECTIONS) {
      expect(output.report).toContain(section)
    }
    // brainRelation seviyeleri rapora AYNEN taşınır — sayısal skor yok:
    expect(output.report).toContain('- Similarity Level: Medium')
    expect(output.report).toContain('- Confidence: Low')
    expect(output.report).toContain('11111111-1111-4111-a111-111111111111')
    expect(output.report).not.toMatch(/Similarity Level: \d/)
  })

  it('mode:report olmayan input rapor senaryosuna girmez (sinyal işleme yolu korunur)', async () => {
    const turn = await provider.complete({
      system,
      messages: [{ role: 'user', content: JSON.stringify({}) }],
    })
    // Bekleyen sinyal bağlamı yok → sinyal işleme kapanış JSON'ı (rapor değil).
    const output = JSON.parse(turn.text) as { processed?: unknown[]; mode?: string }
    expect(output.mode).toBeUndefined()
    expect(output.processed).toEqual([])
  })
})

// ─── 2 + 3. Uçtan uca (canlı Supabase + gerçek bge-m3, env yoksa skip) ──────

async function adminApi() {
  const { getSupabaseAdmin } = await import('../supabase-admin')
  return getSupabaseAdmin()
}

// Migration 0005 probe'u (knowledge-agent.test.ts deseni): scope yoksa skip.
let hasMigration = false
if (hasEnv) {
  const supabase = await adminApi()
  const { error } = await supabase.from('entities').select('scope').limit(1)
  hasMigration = !error
  if (!hasMigration) {
    console.warn('[report-mode.test] migration 0005 canlıda uygulanmamış — e2e suite atlanıyor.')
  }
}

async function cleanup() {
  const supabase = await adminApi()
  await supabase.from('entities').delete().eq('user_id', REPORT_USER_ID)
  await supabase.from('agent_runs').delete().eq('user_id', REPORT_USER_ID)
}

async function countUserEntities(): Promise<number> {
  const supabase = await adminApi()
  const { count, error } = await supabase
    .from('entities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', REPORT_USER_ID)
  if (error) throw error
  return count ?? 0
}

describe.skipIf(!hasEnv || !hasMigration)(
  'Rapor modu uçtan uca (canlı Supabase + MockProvider + sabit GitHub fixture)',
  () => {
    const originalFetch = globalThis.fetch

    beforeAll(async () => {
      await cleanup()
      // SEÇİCİ stub: yalnız api.github.com fixture'a gider; Supabase ve diğer
      // her şey gerçek fetch'ten geçer (Supabase istemcisi de global fetch
      // kullanır — kör stub onu koparırdı).
      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input)
        if (url.startsWith('https://api.github.com/')) {
          if (url.endsWith('/readme')) {
            return Promise.resolve(
              new Response(FIXTURE_README, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }),
            )
          }
          return Promise.resolve(
            new Response(JSON.stringify(FIXTURE_REPO_META), { status: 200, headers: { 'Content-Type': 'application/json' } }),
          )
        }
        return originalFetch(input, init)
      }) as typeof fetch
    }, 600_000)

    afterAll(async () => {
      globalThis.fetch = originalFetch
      await cleanup()
    })

    it(
      "runAgent(mode:'report'): rapor üretilir ve Brain'e SIFIR iz bırakır",
      async () => {
        const entitiesBefore = await countUserEntities()

        const { runAgent } = await import('../agents/runner')
        const result = await runAgent(
          'knowledge-agent',
          { mode: 'report', sourceUrl: REPO_URL },
          REPORT_USER_ID,
        )
        expect(result.ok).toBe(true)
        if (!result.ok) return

        const output = result.output as { mode: string; sourceUrl: string; report: string }
        expect(output.mode).toBe('report')
        expect(output.sourceUrl).toBe(REPO_URL)
        for (const section of KNOWLEDGE_REPORT_SECTIONS) {
          expect(output.report).toContain(section)
        }
        // Sentinel'in Agent Brain'i boş → gerçek brainRelation hesabı Low/Low
        // döndürmeli (eşik-tabanlı yol gerçekten çalıştı):
        expect(output.report).toContain('- Similarity Level: Low')
        expect(output.report).toContain('- Confidence: Low')

        // EPHEMERAL sözleşmesi: entities'e (her iki scope) tek satır bile
        // yazılmadı. agent_runs satırı Brain değil, run muhasebesidir.
        expect(await countUserEntities()).toBe(entitiesBefore)

        const supabase = await adminApi()
        const { data: runs } = await supabase
          .from('agent_runs')
          .select('status')
          .eq('user_id', REPORT_USER_ID)
          .eq('id', result.runId)
          .single()
        expect(runs?.status).toBe('done')
      },
      600_000, // ilk koşuda bge-m3 model yüklemesi burada ödenebilir
    )

    it(
      '4b: rapor sonrası mevcut manuel createSignal → brain_integrate akışı bozulmadı',
      async () => {
        const { createSignal, getNode } = await import('../brain/node-repository')
        const { getLinkedNodes } = await import('../brain/link-registry')
        const { serverExecuteTool } = await import('../agents/executor')

        const signal = await createSignal(
          'Rapor-sonrası manuel entegrasyon teyidi — benzersiz report-mode test sinyali.',
          'report-mode-test',
          undefined,
          { userId: REPORT_USER_ID },
        )
        expect(signal.id).toBeTruthy()

        const integrated = (await serverExecuteTool(
          'brain_integrate',
          {
            signalId: signal.id,
            targetType: 'fact',
            content: 'Rapor sonrası damıtılmış test bilgisi.',
          },
          REPORT_USER_ID,
        )) as { nodeId?: string; ok?: boolean; error?: string }

        expect(integrated.nodeId).toBeTruthy()
        const fact = await getNode(integrated.nodeId!)
        expect(fact).not.toBeNull()
        expect(fact!.type).toBe('fact')

        // derived_from kenarı sinyale bağlanmış olmalı (mevcut akışın kalbi):
        const neighbors = await getLinkedNodes(integrated.nodeId!, 'derived_from')
        expect(neighbors.some((n) => n.node.id === signal.id)).toBe(true)
      },
      600_000,
    )
  },
)
