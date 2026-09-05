import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// VERIFY aşaması testi (Paket B / TASK B2 + B5).
//
// İKİ KATMAN, Paket A'daki canUseTool deseniyle aynı gerekçe:
// 1. SAF karar hattı (verifyAgentOutput) — DB/env/LLM gerektirmez, CI'da HER
//    ZAMAN koşar. Doğrulamanın asıl sözleşmesi burada korunur.
// 2. Kalıcılık (runAgent → agent_runs) — canlı Supabase ister, env-guard'lı.
//    Yalnız saf katmanın gösteremeyeceğini gösterir: sonucun satıra yazıldığı
//    ve status'ün verify_failed'a döndüğü.

process.env.AI_PROVIDER = 'mock'

import { verifyAgentOutput } from './verify'
import type { OutputShape } from './types'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — kullanılan sentinel'lerle çakışmayan yeni id. */
const VERIFY_USER_ID = '00000000-0000-4000-a000-000000000018'

const SHAPE: OutputShape = { title: 'string', items: 'array', count: 'number' }

function check(result: ReturnType<typeof verifyAgentOutput>, name: string) {
  const found = result.checks.find((c) => c.name === name)
  if (!found) throw new Error(`kontrol bulunamadı: ${name}`)
  return found
}

// ── 1. Saf karar hattı — DB YOK, CI'da koşar ────────────────────────────────

describe('verifyAgentOutput — output existence', () => {
  it('dolu çıktı geçer', () => {
    const r = verifyAgentOutput({ output: { a: 1 } })
    expect(check(r, 'output-existence').passed).toBe(true)
    expect(r.passed).toBe(true)
  })

  it('null / undefined / boş nesne / boş dizi / boş metin düşer', () => {
    for (const output of [null, undefined, {}, [], '   ']) {
      const r = verifyAgentOutput({ output })
      expect({ output, passed: r.passed }).toMatchObject({ passed: false })
      expect(check(r, 'output-existence').passed).toBe(false)
    }
  })
})

describe('verifyAgentOutput — parse başarısı', () => {
  it('parseAgentOutput fallback\'i (parseError) verify\'ı DÜŞÜRÜR', () => {
    // Bugüne kadar bu çıktı sessizce 'done' olarak kaydediliyordu — B2'nin
    // kapattığı en somut hata.
    const r = verifyAgentOutput({ output: { parseError: true, rawLength: 12, raw: 'bozuk metin' } })
    expect(r.passed).toBe(false)
    expect(check(r, 'parse-success').passed).toBe(false)
  })

  it('normal çıktıda parse kontrolü geçer', () => {
    expect(check(verifyAgentOutput({ output: { ok: true } }), 'parse-success').passed).toBe(true)
  })

  it('parseError=false gerçek bir alan olabilir — yalnız true düşürür', () => {
    expect(verifyAgentOutput({ output: { parseError: false } }).passed).toBe(true)
  })
})

describe('verifyAgentOutput — şema geçerliliği', () => {
  it('şema beyan edilmemişse ATLANIR, diğer kontroller yine çalışır', () => {
    const r = verifyAgentOutput({ output: { rastgele: 'alan' } })
    const schema = check(r, 'schema-validity')
    expect(schema.skipped).toBe(true)
    expect(r.passed).toBe(true)
    // atlanan şema, var olan kontrolleri susturmuyor:
    expect(check(r, 'output-existence').passed).toBe(true)
    expect(check(r, 'parse-success').passed).toBe(true)
  })

  it('uyan çıktı geçer; FAZLA alan sorun değildir', () => {
    const r = verifyAgentOutput({
      output: { title: 'x', items: [1], count: 2, fazladan: true },
      outputSchema: SHAPE,
    })
    expect(r.passed).toBe(true)
  })

  it('eksik alan düşer ve hangi alan olduğunu söyler', () => {
    const r = verifyAgentOutput({ output: { title: 'x', items: [] }, outputSchema: SHAPE })
    expect(r.passed).toBe(false)
    expect(check(r, 'schema-validity').detail).toContain('count')
  })

  it('yanlış tip düşer', () => {
    const r = verifyAgentOutput({
      output: { title: 'x', items: 'dizi değil', count: 2 },
      outputSchema: SHAPE,
    })
    expect(r.passed).toBe(false)
    expect(check(r, 'schema-validity').detail).toContain('items')
  })

  it('dizi şema = ALTERNATİF şekiller: herhangi birine uymak yeterli', () => {
    // knowledge-agent gerçeği: sinyal işleme ve rapor modunun zarfları ayrı.
    const alternatives: OutputShape[] = [
      { processed: 'array', skipped: 'array', summary: 'string' },
      { mode: 'string', sourceUrl: 'string', report: 'string' },
    ]
    expect(verifyAgentOutput({
      output: { processed: [], skipped: [], summary: 'ok' },
      outputSchema: alternatives,
    }).passed).toBe(true)

    expect(verifyAgentOutput({
      output: { mode: 'report', sourceUrl: 'https://github.com/x/y', report: '# rapor' },
      outputSchema: alternatives,
    }).passed).toBe(true)

    const neither = verifyAgentOutput({ output: { baska: 'sey' }, outputSchema: alternatives })
    expect(neither.passed).toBe(false)
    expect(check(neither, 'schema-validity').detail).toContain('hiçbir alternatif')
  })

  it('çıktı ayrıştırılamadıysa şema kontrolü atlanır (kök neden tek satırda kalsın)', () => {
    const r = verifyAgentOutput({ output: { parseError: true }, outputSchema: SHAPE })
    expect(check(r, 'schema-validity').skipped).toBe(true)
    expect(r.passed).toBe(false) // yine de parse yüzünden düşer
  })
})

describe('verifyAgentOutput — tool sonuçları', () => {
  it('hata dönen tool çağrısı sonuca işlenir ama run\'ı DÜŞÜRMEZ', () => {
    const r = verifyAgentOutput({
      output: { ok: true },
      failedToolCalls: [{ name: 'brain_integrate', message: 'Hata: reddedildi' }],
    })
    const tools = check(r, 'tool-results')
    expect(tools.passed).toBe(false)
    expect(tools.blocking).toBe(false)
    expect(tools.detail).toContain('brain_integrate')
    // Bloklamayan kontrol genel sonucu değiştirmez:
    expect(r.passed).toBe(true)
  })

  it('tool hatası yoksa kontrol geçer', () => {
    expect(check(verifyAgentOutput({ output: { ok: true } }), 'tool-results').passed).toBe(true)
  })

  it('tool hatası + şema ihlali birlikte: düşme sebebi ŞEMA olarak raporlanır', () => {
    const r = verifyAgentOutput({
      output: { title: 'x' },
      outputSchema: SHAPE,
      failedToolCalls: [{ name: 'brain_link', message: 'Hata: patladı' }],
    })
    expect(r.passed).toBe(false)
    expect(check(r, 'schema-validity').passed).toBe(false)
  })
})

// ── 2. Kalıcılık — canlı Supabase ister ────────────────────────────────────

describe.skipIf(!hasEnv)('runAgent → agent_runs.verification (canlı Supabase)', () => {
  async function adminApi() {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    return getSupabaseAdmin()
  }

  async function cleanup() {
    const supabase = await adminApi()
    await supabase.from('agent_runs').delete().eq('user_id', VERIFY_USER_ID)
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  it('geçen doğrulama: status done + verification satıra YAZILIR', async () => {
    const { runAgent } = await import('./runner')
    // growth-agent şema beyan etmez → existence + parse yeterli; MockProvider
    // jenerik JSON fixture'ı bu iki kontrolü geçer.
    const result = await runAgent(
      'growth-agent',
      { objective: 'VERIFY testi — MockProvider fixture bekleniyor.' },
      VERIFY_USER_ID,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const supabase = await adminApi()
    const { data } = await supabase
      .from('agent_runs').select('status, verification').eq('id', result.runId).single()

    expect(data?.status).toBe('done')
    // NULL "doğrulanmadı" demek — burada gerçekten koşmuş olmalı:
    expect(data?.verification).toBeTruthy()
    expect(data?.verification).toMatchObject({ passed: true })
    const names = (data!.verification.checks as { name: string }[]).map((c) => c.name)
    expect(names).toEqual([
      'output-existence', 'parse-success', 'schema-validity', 'tool-results',
    ])
  }, 60_000)

  it('düşen doğrulama: status verify_failed + runAgent ok:false + gerekçe', async () => {
    // knowledge-agent'ın şeması iki alternatif şekil bekler; input'a
    // mode:'report' verilmeden sinyal yolu koşar ve bekleyen sinyal yoksa
    // MockProvider sözleşmeye UYAN çıktı üretir — bu yüzden şemayı düşürmek
    // için ajanın kendisini değil, çıktının şeklini bozacak bir yol gerekir.
    // En dürüst kırılma: registry'ye ŞEMALI geçici bir ajan kaydetmek.
    const { registerAgent, unregisterAgent } = await import('./registry')
    const { runAgent } = await import('./runner')

    registerAgent({
      name: 'verify-probe-agent',
      displayName: 'Verify Probe',
      department: 'operations',
      persona: 'Test ajanı — MockProvider jenerik JSON fixture\'ı döndürür.',
      toolNames: [],
      moduleTarget: null,
      outputContract: '{ "zorunluAlan": string }',
      // MockProvider { mock, note, input } döndürür → bu şema TUTMAZ.
      outputSchema: { zorunluAlan: 'string' },
    })

    try {
      const result = await runAgent('verify-probe-agent', { probe: true }, VERIFY_USER_ID)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('VERIFY başarısız')
      expect(result.error).toContain('zorunluAlan')
      expect(result.verification?.passed).toBe(false)
      expect(result.runId).toBeTruthy()

      const supabase = await adminApi()
      const { data } = await supabase
        .from('agent_runs').select('status, output, verification').eq('id', result.runId!).single()

      expect(data?.status).toBe('verify_failed')
      // Çıktı BAŞARISIZ doğrulamada da yazılır — inceleme onu görmeyi gerektirir.
      expect(data?.output).toMatchObject({ mock: true })
      expect(data?.verification).toMatchObject({ passed: false })
    } finally {
      unregisterAgent('verify-probe-agent')
    }
  }, 60_000)
})
