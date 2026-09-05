import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Run görünürlük ucu testi (Paket B / TASK B4 + B5).
//
// Route handler'ı DOĞRUDAN çağırır (HTTP sunucusu YOK): Next route'u saf bir
// (Request) => Response fonksiyonudur, testin sunucu ayağa kaldırmasına gerek
// yoktur. Canlı Supabase ister — env-guard'lı (lib/goals-sync.test.ts deseni).
//
// Sınadığı asıl şey, saf birim testlerin gösteremeyeceği: bir run'ın tool
// çağrılarının İZİNLİ ve REDDEDİLEN olarak ayırt edilebilir döndüğü. Denetim
// satırları GERÇEK yoldan üretilir (serverExecuteTool → enforcement → audit);
// tabloya elle satır basılmaz.

process.env.AI_PROVIDER = 'mock'
// Denetim yazıcısı test koşusunda varsayılan kapalı (lib/audit/log.ts);
// bu dosyanın konusu tam da o satırlar — açılır.
process.env.REBORN_AUDIT_IN_TESTS = '1'

import { GET } from './route'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — kullanılan sentinel'lerle çakışmayan yeni id. */
const RUNS_USER_ID = '00000000-0000-4000-a000-000000000019'

type Json = Record<string, unknown>

async function adminApi() {
  const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
  return getSupabaseAdmin()
}

/** Ateşle-unut audit yazımı için açık bekleme (enforcement.test.ts deseni). */
async function waitForAuditCount(runId: string, expected: number, timeoutMs = 8000) {
  const supabase = await adminApi()
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data } = await supabase.from('audit_log').select('id').eq('run_id', runId)
    if ((data?.length ?? 0) >= expected) return
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`audit_log: ${runId} için ${expected} satır ${timeoutMs}ms içinde düşmedi`)
}

describe.skipIf(!hasEnv)('GET /api/agents/runs (canlı Supabase)', () => {
  let runId = ''

  async function cleanup() {
    const supabase = await adminApi()
    await supabase.from('audit_log').delete().eq('user_id', RUNS_USER_ID)
    await supabase.from('agent_runs').delete().eq('user_id', RUNS_USER_ID)
    await supabase.from('memories').delete().eq('user_id', RUNS_USER_ID)
  }

  beforeAll(async () => {
    await cleanup()

    // 1. GERÇEK bir çalıştırma — VERIFY ve token alanları buradan doğar.
    const { runAgent } = await import('@/lib/agents/runner')
    const result = await runAgent(
      'growth-agent',
      { objective: 'Görünürlük ucu testi — MockProvider fixture bekleniyor.' },
      RUNS_USER_ID,
    )
    if (!result.ok) throw new Error(`runAgent beklenmedik şekilde düştü: ${result.error}`)
    runId = result.runId

    // 2. Bu run'a bağlı İKİ tool çağrısı — biri izinli, biri reddedilen.
    //    İkisi de gerçek kapıdan geçer (lib/departments/enforcement.ts).
    const { serverExecuteTool } = await import('@/lib/agents/executor')
    await serverExecuteTool('read_memories', { limit: 1 }, RUNS_USER_ID, {
      callerAgent: 'sanchez', runId,
    })
    await expect(
      serverExecuteTool('save_memory', { content: 'reddedilmeli' }, RUNS_USER_ID, {
        callerAgent: 'growth-agent', runId,
      }),
    ).rejects.toThrow(/reddedildi/)

    await waitForAuditCount(runId, 2)
  }, 90_000)

  afterAll(cleanup)

  it('liste: mevcut alanlar KORUNUR (UI kırılmaz) ve yeni alanlar eklenir', async () => {
    const res = await GET(new Request('http://localhost/api/agents/runs?agent=growth-agent'))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Json[]

    const row = rows.find((r) => r.id === runId)
    expect(row).toBeTruthy()

    // Geriye uyumluluk: dört ekran bu snake_case alanları okuyor.
    for (const field of [
      'id', 'agent_name', 'status', 'input', 'output',
      'module_target', 'error', 'started_at', 'finished_at',
    ]) {
      expect({ field, present: field in row! }).toMatchObject({ present: true })
    }

    // Yeni alanlar:
    expect(row!.verification).toMatchObject({ passed: true })
    expect(row!.tool_call_summary).toMatchObject({ total: 2, allowed: 1, denied: 1, errored: 0 })
    expect(typeof row!.duration_ms).toBe('number')
    // MockProvider usage üretmez → null ("ölçülmedi"), 0 DEĞİL.
    expect(row!.input_tokens).toBeNull()
    expect(row!.output_tokens).toBeNull()
    // Bu run bir göreve bağlı değil:
    expect(row!.task_id).toBeNull()
  })

  it('liste: N+1 yok — tek run için bile toplu sorgu yolu doğru gruplar', async () => {
    const res = await GET(new Request('http://localhost/api/agents/runs?limit=100'))
    const rows = (await res.json()) as Json[]
    // Başka run'ların özeti bu run'ınkine sızmamalı (gruplama doğru).
    const mine = rows.find((r) => r.id === runId)
    expect(mine!.tool_call_summary).toMatchObject({ total: 2 })
  })

  it('detay: izinli ve reddedilen tool çağrıları AYIRT EDİLEBİLİR döner', async () => {
    const res = await GET(new Request(`http://localhost/api/agents/runs?id=${runId}`))
    expect(res.status).toBe(200)
    const detail = (await res.json()) as Json

    const calls = detail.tool_calls as Json[]
    expect(calls).toHaveLength(2)

    const allowed = calls.find((c) => c.tool_name === 'read_memories')
    expect(allowed).toMatchObject({ status: 'allowed', capability: 'life-data.read', deny_reason: null })

    const denied = calls.find((c) => c.tool_name === 'save_memory')
    expect(denied).toMatchObject({
      status: 'denied',
      deny_reason: 'capability-forbidden',
      capability: 'life-data.write',
    })
    // Girdi DEĞERLERİ denetim satırına girmez — yalnız anahtarlar.
    expect(JSON.stringify(calls)).not.toContain('reddedilmeli')

    expect(detail.tool_call_summary).toMatchObject({ total: 2, allowed: 1, denied: 1 })
    expect(detail.verification).toMatchObject({ passed: true })
    expect(detail.task).toBeNull()
    expect(Array.isArray(detail.logs)).toBe(true)
  })

  it('detay: olmayan run 404', async () => {
    const res = await GET(new Request(
      'http://localhost/api/agents/runs?id=00000000-0000-4000-a000-0000000000ff',
    ))
    expect(res.status).toBe(404)
  })

  it('liste: status filtresi çalışır', async () => {
    const res = await GET(new Request('http://localhost/api/agents/runs?status=verify_failed&limit=100'))
    const rows = (await res.json()) as Json[]
    // Bu run done'dır — verify_failed filtresinde görünmemeli.
    expect(rows.some((r) => r.id === runId)).toBe(false)
  })
})
