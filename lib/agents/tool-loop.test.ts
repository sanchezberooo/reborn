import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

// Tool çağrısı hata sözleşmesi testi (Paket B / TASK B1.1 + B1.2 + B5).
//
// İKİ KATMAN:
// 1. runToolCall sözleşmesi — reddedilen çağrı FIRLATMAZ, isError döner.
//    Reddedilen yol tool gövdesine hiç ulaşmadığı ve denetim yazımı test
//    koşusunda kapalı olduğu için DB'ye dokunmaz → CI'da HER ZAMAN koşar.
// 2. Run düzeyi sonuç — hatalı tool çağrısı run'ı DÜŞÜRMEZ; ajan hatayı
//    görüp devam eder ve run done ile biter. Canlı Supabase ister
//    (agent_runs satırı) — env-guard'lı.

process.env.AI_PROVIDER = 'mock'

import type { AITurn } from '@/lib/ai'
import { runToolCall } from './tool-loop'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — kullanılan sentinel'lerle çakışmayan yeni id. */
const TOOL_LOOP_USER_ID = '00000000-0000-4000-a000-000000000020'

// ── 1. Sözleşme — DB YOK, CI'da koşar ──────────────────────────────────────

describe('runToolCall — reddedilen çağrı turu düşürmez', () => {
  it('FIRLATMAZ; isError sonucu döner ve toolUseId korunur', async () => {
    // growth-agent'ın life-data.write yetkisi yok → enforcement reddeder.
    const result = await runToolCall(
      { id: 'tu-1', name: 'save_memory', input: { content: 'x' } },
      TOOL_LOOP_USER_ID,
      { callerAgent: 'growth-agent' },
    )

    expect(result.isError).toBe(true)
    expect(result.toolUseId).toBe('tu-1')
    // Model reddedildiğini ANLAMALI (metin güvenli — izin tablosu sızmaz):
    expect(result.content).toContain('reddedildi')
  })

  it('bilinmeyen ajan da reddedilir ve yine isError döner', async () => {
    const result = await runToolCall(
      { id: 'tu-2', name: 'read_memories', input: {} },
      TOOL_LOOP_USER_ID,
      { callerAgent: 'sahte-ajan' },
    )
    expect(result.isError).toBe(true)
    expect(result.toolUseId).toBe('tu-2')
  })
})

// ── 2. Yürütme + run düzeyi — canlı Supabase ister ─────────────────────────

describe.skipIf(!hasEnv)('bilinmeyen tool adı (canlı Supabase)', () => {
  it("tanımsız tool artık HATA fırlatır — sessizce { ok: true } dönmez", async () => {
    const { serverExecuteTool } = await import('./executor')
    // Sanchez muaftır, yani enforcement'ı geçer ve executor'ın default:
    // dalına ULAŞIR — B1.2 öncesi burası başarı döndürüyordu.
    await expect(
      serverExecuteTool('boyle_bir_tool_yok', {}, TOOL_LOOP_USER_ID, { callerAgent: 'sanchez' }),
    ).rejects.toThrow(/tanımlı değil/)
  })

  it('bu hata da mevcut sözleşmeden geçer: runToolCall isError\'a çevirir', async () => {
    const result = await runToolCall(
      { id: 'tu-3', name: 'boyle_bir_tool_yok', input: {} },
      TOOL_LOOP_USER_ID,
      { callerAgent: 'sanchez' },
    )
    expect(result.isError).toBe(true)
    expect(result.content).toContain('tanımlı değil')
  })
})

describe.skipIf(!hasEnv)('runAgent — hatalı tool çağrısı run\'ı düşürmez (canlı Supabase)', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/ai')
    vi.resetModules()
  })

  afterAll(async () => {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
    await getSupabaseAdmin().from('agent_runs').delete().eq('user_id', TOOL_LOOP_USER_ID)
  })

  it('reddedilen tool sonrası ajan devam eder, run done biter, model isError görür', async () => {
    // Sağlayıcı iki turluk bir senaryo oynatır: 1) izinsiz bir tool iste,
    // 2) tool sonucunu gördükten sonra normal çıktıyla bitir. MockProvider
    // ajanlara tool çağrısı ürettirmediği için senaryo burada kurulur.
    const seenToolResults: { content: string; isError?: boolean }[] = []
    let turn = 0

    vi.resetModules()
    vi.doMock('@/lib/ai', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/ai')>()
      return {
        ...actual,
        getAIProvider: () => ({
          name: 'senaryo',
          capabilities: {},
          async complete(req: { messages: unknown[] }): Promise<AITurn> {
            turn++
            if (turn === 1) {
              return {
                stopReason: 'tool_use',
                text: '',
                // growth-agent'ın life-data.write yetkisi yok → reddedilecek.
                toolUses: [{ id: 'tu-red', name: 'save_memory', input: { content: 'olmamalı' } }],
              }
            }
            // 2. tur: modele geri dönen tool sonucunu yakala.
            for (const m of req.messages as { role: string; results?: typeof seenToolResults }[]) {
              if (m.role === 'tool_results' && m.results) seenToolResults.push(...m.results)
            }
            // Çıktı growth-agent'ın ŞEMASINI tutmalı (Paket C1.2): burada
            // sınanan şey tool hatasının run'ı düşürmediğidir, şema ihlali
            // değil — sözleşmeye uymayan çıktı testi yanlış sebepten kırardı.
            return {
              stopReason: 'end_turn',
              text: JSON.stringify({
                objective: 'devam ettim',
                strategySummary: 'tool hatasına rağmen tamamlandı',
                tactics: [],
                drafts: [],
                metricsToWatch: [],
                assumptions: [],
              }),
              toolUses: [],
            }
          },
          stream: actual.getAIProvider().stream,
          embed: async () => [],
        }),
      }
    })

    const { runAgent } = await import('./runner')
    const result = await runAgent('growth-agent', { objective: 'tool hata testi' }, TOOL_LOOP_USER_ID)

    // Run DÜŞMEDİ — B1.2 öncesi burası ok:false + status 'error' olurdu.
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.output).toMatchObject({ objective: 'devam ettim' })

    // Model hatayı GÖRDÜ:
    expect(seenToolResults).toHaveLength(1)
    expect(seenToolResults[0].isError).toBe(true)
    expect(seenToolResults[0].content).toContain('reddedildi')

    const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
    const { data } = await getSupabaseAdmin()
      .from('agent_runs').select('status, verification').eq('id', result.runId).single()

    expect(data?.status).toBe('done')
    // ...ve tool hatası kaybolmadı: VERIFY'ın bloklamayan 4. kontrolünde görünür.
    const toolCheck = (data!.verification.checks as { name: string; passed: boolean; blocking: boolean }[])
      .find((c) => c.name === 'tool-results')
    expect(toolCheck).toMatchObject({ passed: false, blocking: false })
  }, 60_000)
})
