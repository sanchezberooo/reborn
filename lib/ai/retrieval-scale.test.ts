import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// CTO raporu bulgusunun küçük ölçekte kanıtı (Faz — RPC migration, Checkpoint 4a):
// eski süreç-içi motor `.limit(1000)` ile önce satır sayısını kesiyor, SONRA
// JS'te benzerliğe göre skorluyordu — kesme, alaka düzeyinden BAĞIMSIZ (DB'nin
// keyfi/insertion sırasına göre) olduğundan, gerçek en-iyi eşleşme kesilen
// satırların dışında kalırsa sessizce (hatasız) kaybolurdu. Bu hata sınıfı
// ÖLÇEKTEN BAĞIMSIZDIR: kapasitenin küçük bir N'de de aynı mekanizmayla
// yeniden üretilebilir — gerçek 1000 entity oluşturmaya gerek yok.
//
// Senaryo: N=CAP adet "çekici" (decoy) entity ÖNCE, hedef entity SONRA
// yaratılır (created_at farkı). Sorgu vektörü hedefin embedding'iyle BİREBİR
// aynıdır (one-hot, sim=1.0); decoy'ların embedding'i farklı boyutta one-hot
// (sim=0.0) — sonuç belirsizliksiz.
//   * "Eski davranış" simülasyonu: created_at artan sırayla ilk CAP satır
//     çekilir (eski koddaki sırasız/alakadan-bağımsız erken-kesmenin
//     birebir modeli) → hedef bu pencerede YOKTUR, hiç skorlanmaz.
//   * match_entities RPC'si: TÜM adaylar DB'de mesafeye göre sıralanır,
//     SONRA kesilir → hedef p_match_limit=1'de bile doğru döner.

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function adminApi() {
  const { getSupabaseAdmin } = await import('../supabase-admin')
  return getSupabaseAdmin()
}

/** RPC canlıda yoksa (migration 0006 uygulanmamış) suite kendini atlar. */
let hasRpc = false
if (hasEnv) {
  const supabase = await adminApi()
  const { error } = await supabase.rpc('match_entities', {
    p_user_id: '00000000-0000-4000-a000-000000000000',
    p_query_embedding: new Array(1024).fill(0),
    p_match_limit: 1,
    p_scope: null,
  })
  hasRpc = !error
  if (!hasRpc) {
    console.warn(
      `[retrieval-scale.test] match_entities RPC'si canlıda yok (${error?.code}) — migration 0006 uygulanınca bu suite koşar.`,
    )
  }
}

/** Bu testin sahibi — diğer sentinel setleriyle (…0001/…000b/…000c/…000d/…000e) karışmasın. */
const SCALE_USER_ID = '00000000-0000-4000-a000-00000000000f'
const DIM = 1024
/** Küçük ölçekli kapasite — gerçek koddaki 1000'in birebir küçültülmüş
 *  benzeri; hata mekanizması N'den bağımsız olduğundan kanıt için yeterli. */
const CAP = 5
const TARGET_INDEX = 999

function oneHot(index: number): number[] {
  const v = new Array(DIM).fill(0)
  v[index] = 1
  return v
}

describe.skipIf(!hasEnv || !hasRpc)('match_entities RPC — 1000-satır sınırının küçük ölçekli kanıtı', () => {
  const insertedIds: string[] = []
  let targetId: string

  beforeAll(async () => {
    const supabase = await adminApi()
    await supabase.from('entities').delete().eq('user_id', SCALE_USER_ID) // önceki artık varsa temizle

    const base = Date.now()
    // CAP adet decoy: hedeften ÖNCE yaratılır (created_at daha eski).
    for (let i = 0; i < CAP; i++) {
      const { data, error } = await supabase
        .from('entities')
        .insert({
          user_id: SCALE_USER_ID,
          type: 'note',
          title: `Decoy ${i}`,
          content: 'retrieval-scale.test decoy',
          embedding: oneHot(i),
          created_at: new Date(base + i * 1000).toISOString(),
        })
        .select('id')
        .single()
      if (error) throw error
      insertedIds.push(data!.id as string)
    }

    // Hedef: decoy'lardan SONRA yaratılır (created_at en yeni) — "insertion
    // sırasına göre ilk CAP" penceresinin kesinlikle DIŞINDA kalır.
    const { data: targetRow, error: targetError } = await supabase
      .from('entities')
      .insert({
        user_id: SCALE_USER_ID,
        type: 'note',
        title: 'Hedef (gerçek en-iyi eşleşme)',
        content: 'retrieval-scale.test target — sorgu vektörüyle birebir aynı embedding',
        embedding: oneHot(TARGET_INDEX),
        created_at: new Date(base + (CAP + 5) * 1000).toISOString(),
      })
      .select('id')
      .single()
    if (targetError) throw targetError
    targetId = targetRow!.id as string
    insertedIds.push(targetId)
  })

  afterAll(async () => {
    const supabase = await adminApi()
    await supabase.from('entities').delete().eq('user_id', SCALE_USER_ID)
  })

  it('eski davranışın simülasyonu: alakadan bağımsız erken-kesme hedefi hiç göremez (sessiz kayıp)', async () => {
    const supabase = await adminApi()
    // Eski kodun `.limit(1000)`'inin birebir küçültülmüş modeli: sıralama
    // alaka düzeyiyle İLGİSİZ (created_at artan) — gerçek koddaki PostgREST
    // varsayılan/insertion sırasının yerine geçen deterministik bir vekil.
    const { data: candidates, error } = await supabase
      .from('entities')
      .select('id')
      .eq('user_id', SCALE_USER_ID)
      .not('embedding', 'is', null)
      .order('created_at', { ascending: true })
      .limit(CAP)
    if (error) throw error

    const candidateIds = (candidates ?? []).map((r) => r.id as string)
    expect(candidateIds).toHaveLength(CAP)
    // Kanıt: gerçek en-iyi eşleşme aday kümesine hiç girmedi — JS tarafında
    // dot product'la "en iyi" hesaplansa bile bu decoy'lardan biri çıkar,
    // hata fırlamaz, kullanıcı yanlış/eksik sonucu asla ayırt edemez.
    expect(candidateIds).not.toContain(targetId)
  })

  it('match_entities RPC: aynı küçük limitte bile gerçek en-iyi eşleşmeyi doğru döner', async () => {
    const supabase = await adminApi()
    const { data, error } = await supabase.rpc('match_entities', {
      p_user_id: SCALE_USER_ID,
      p_query_embedding: oneHot(TARGET_INDEX),
      p_match_limit: CAP,
      p_scope: null,
    })
    if (error) throw error

    expect(data).toBeTruthy()
    const rows = data as Array<{ id: string; similarity: number }>
    expect(rows[0].id).toBe(targetId)
    expect(rows[0].similarity).toBeCloseTo(1, 5)

    // p_match_limit=1 gibi en agresif kesmede bile doğru: sıralama DB'de
    // KESMEDEN ÖNCE tam mesafeye göre yapılıyor — eski "kes sonra sırala"
    // sırasının tam tersi.
    const { data: tightest, error: tightestError } = await supabase.rpc('match_entities', {
      p_user_id: SCALE_USER_ID,
      p_query_embedding: oneHot(TARGET_INDEX),
      p_match_limit: 1,
      p_scope: null,
    })
    if (tightestError) throw tightestError
    const tightestRows = tightest as Array<{ id: string; similarity: number }>
    expect(tightestRows).toHaveLength(1)
    expect(tightestRows[0].id).toBe(targetId)
  })
})
