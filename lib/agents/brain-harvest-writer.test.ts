import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Brain hasadının YAZMA yolu testi (Paket C1 / TASK C1.3 + C1.5).
// Canlı Supabase ister (entities yazımı + embedding) — env-guard'lı.
// Karar hattının kendisi DB'siz sınanıyor (brain-harvest.test.ts); burada
// yalnız saf katmanın gösteremeyeceği doğrulanır: node gerçekten doğuyor mu,
// kökenini taşıyor mu, inceleme kuyruğunda görünüyor mu.

process.env.AI_PROVIDER = 'mock'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — kullanılan sentinel'lerle çakışmayan yeni id. */
const HARVEST_USER_ID = '00000000-0000-4000-a000-000000000021'
const RUN_ID = '00000000-0000-4000-a000-0000000000d1'
const TASK_ID = '00000000-0000-4000-a000-0000000000d2'

const REUSABLE_CONTENT =
  'Kuyruk derinliği worker kapasitesinin iki katını aştığında yeni görev kabulü '
  + 'yavaşlatılmalı. Aksi halde retry fırtınası doğuyor ve kuyruk kendini besleyerek '
  + 'büyüyor. Bu desen tick tabanlı her worker için geçerlidir.'

function outputWith(candidates: unknown[]) {
  return {
    objective: 'test', designSummary: 'test', components: [], buildSteps: [],
    risks: [], openQuestions: [], brainCandidates: candidates,
  }
}

describe.skipIf(!hasEnv)('harvestToBrain (canlı Supabase)', () => {
  async function adminApi() {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    return getSupabaseAdmin()
  }

  async function cleanup() {
    const supabase = await adminApi()
    await supabase.from('entities').delete().eq('user_id', HARVEST_USER_ID)
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  it('yazılan node KÖKENİNİ taşır (hangi run, hangi ajan, hangi task)', async () => {
    const { harvestToBrain } = await import('./brain-harvest-writer')

    const result = await harvestToBrain({
      agentName: 'builder-agent',
      userId: HARVEST_USER_ID,
      output: outputWith([{
        type: 'pattern',
        title: 'Geri basınç deseni',
        content: REUSABLE_CONTENT,
        reusable: true,
      }]),
      verifyPassed: true,
      failedToolCallCount: 0,
      origin: { runId: RUN_ID, agentName: 'builder-agent', taskId: TASK_ID },
    })

    expect(result.attempted).toBe(true)
    expect(result.written).toHaveLength(1)

    const supabase = await adminApi()
    const { data } = await supabase
      .from('entities')
      .select('type, scope, layer, status, metadata')
      .eq('id', result.written[0].nodeId)
      .single()

    // Agent Brain'e, karantina statüsünde doğar — güvenilir bilgi DEĞİL.
    expect(data).toMatchObject({ type: 'pattern', scope: 'agent', status: 'aday' })

    // Köken metadata'da yaşar: links iki entity'yi bağlar, agent_run entity
    // değildir — kenar olarak ifade EDİLEMEZ (yeni tablo açmadan).
    const meta = data!.metadata as Record<string, unknown>
    expect(meta.kind).toBe('agent-output')
    expect(meta.origin).toMatchObject({
      runId: RUN_ID, agentName: 'builder-agent', taskId: TASK_ID,
    })
    expect(typeof meta.trustScore).toBe('number')
  }, 120_000)

  it('yazılan node inceleme kuyruğunda GÖRÜNÜR', async () => {
    const { listReviewQueue } = await import('../knowledge/review-queue')
    const queue = await listReviewQueue({ limit: 100 })

    const mine = queue.find((e) => e.source === `run:${RUN_ID}`)
    expect(mine).toBeTruthy()
    expect(mine).toMatchObject({ entryKind: 'agent-output', status: 'aday' })
    expect(mine!.reason).toContain('builder-agent')
  }, 60_000)

  it('verify_failed run\'ın çıktısı Brain\'e YAZILMAZ', async () => {
    const { harvestToBrain } = await import('./brain-harvest-writer')
    const supabase = await adminApi()
    const before = await supabase.from('entities').select('id').eq('user_id', HARVEST_USER_ID)

    const result = await harvestToBrain({
      agentName: 'builder-agent',
      userId: HARVEST_USER_ID,
      output: outputWith([{
        type: 'pattern', title: 'Yazılmamalı', content: REUSABLE_CONTENT, reusable: true,
      }]),
      verifyPassed: false,
      failedToolCallCount: 0,
      origin: { runId: RUN_ID, agentName: 'builder-agent' },
    })

    expect(result.attempted).toBe(false)
    expect(result.written).toHaveLength(0)
    expect(result.deniedReason).toContain('VERIFY')

    const after = await supabase.from('entities').select('id').eq('user_id', HARVEST_USER_ID)
    expect(after.data?.length).toBe(before.data?.length)
  }, 60_000)

  it('yetkisiz departmanın ajanı yazamaz (growth)', async () => {
    const { harvestToBrain } = await import('./brain-harvest-writer')
    const supabase = await adminApi()
    const before = await supabase.from('entities').select('id').eq('user_id', HARVEST_USER_ID)

    const result = await harvestToBrain({
      agentName: 'growth-agent',
      userId: HARVEST_USER_ID,
      output: outputWith([{
        type: 'pattern', title: 'Yazılmamalı', content: REUSABLE_CONTENT, reusable: true,
      }]),
      verifyPassed: true,
      failedToolCallCount: 0,
      origin: { runId: RUN_ID, agentName: 'growth-agent' },
    })

    expect(result.attempted).toBe(false)
    expect(result.deniedReason).toContain('brain.contribute')

    const after = await supabase.from('entities').select('id').eq('user_id', HARVEST_USER_ID)
    expect(after.data?.length).toBe(before.data?.length)
  }, 60_000)

  it('kalite eşiğini geçmeyen aday Brain\'e GİRMEZ ve gerekçesi döner', async () => {
    const { harvestToBrain } = await import('./brain-harvest-writer')
    const supabase = await adminApi()
    const before = await supabase.from('entities').select('id').eq('user_id', HARVEST_USER_ID)

    const result = await harvestToBrain({
      agentName: 'operations-agent',
      userId: HARVEST_USER_ID,
      output: outputWith([{
        type: 'fact',
        title: 'Tick raporu',
        content: 'Bu çalıştırmada 3 görev düştü ve şu an kuyruk boş; şimdilik ek işlem gerekmiyor ama izlenmeli.',
        reusable: true,
      }]),
      verifyPassed: true,
      failedToolCallCount: 0,
      origin: { runId: RUN_ID, agentName: 'operations-agent' },
    })

    expect(result.attempted).toBe(true)
    expect(result.written).toHaveLength(0)
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0].reason).toMatch(/tek seferlik/i)

    const after = await supabase.from('entities').select('id').eq('user_id', HARVEST_USER_ID)
    expect(after.data?.length).toBe(before.data?.length)
  }, 60_000)
})
