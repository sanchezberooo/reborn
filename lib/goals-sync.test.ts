import { afterAll, describe, expect, it } from 'vitest'
import { FIXTURE_USER_ID } from '../scripts/fixture-data'

// Goals sistemi entegrasyon testi (Faz 2, Görev 2) — journal-sync.test.ts
// deseni: canlı Supabase + gerçek bge-m3; env yoksa skip. Ek önkoşul:
// migration 0002_goals.sql uygulanmış olmalı — goals tablosu yoksa suite
// (patlamak yerine) skip edilir ve uyarı basar; migration onaylanıp
// uygulandığında kendiliğinden koşar. Kayıtlar FIXTURE_USER_ID altında,
// afterAll'da temizlenir.

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function dbApi() {
  return import('./db-server')
}
async function adminApi() {
  const { getSupabaseAdmin } = await import('./supabase-admin')
  return getSupabaseAdmin()
}
async function retrievalApi() {
  return import('./ai/retrieval')
}

// Tablo var mı? (top-level await — describe.skipIf statik değer ister)
const goalsTableReady = hasEnv
  ? await (async () => {
      const supabase = await adminApi()
      // head:true KULLANMA — PostgREST, HEAD isteğine tablo yokken bile
      // hatasız 204 döner; yokluk ancak gövdeli istekte görünür.
      const { error } = await supabase.from('goals').select('id').limit(1)
      if (error) {
        console.warn(
          `[goals-sync.test] goals tablosu yok (${error.code}) — migration 0002_goals.sql uygulanınca bu suite koşar.`,
        )
        return false
      }
      return true
    })()
  : false

// Fixture setinde eşi olmayan benzersiz içerikler (retrieval doğrulaması).
const ROOT_TEXT =
  'Zümrüt yeşili vitray atölyesinde usta unvanı almak — goals senkron testine özgü benzersiz kök hedef.'
const CHILD_TEXT =
  'Vitray için kurşun profil bükme tekniğini öğrenmek — goals senkron testinin benzersiz alt hedefi.'

describe.skipIf(!hasEnv || !goalsTableReady)('goals sistemi (canlı Supabase + bge-m3)', () => {
  const createdIds: string[] = []

  afterAll(async () => {
    const supabase = await adminApi()
    // Entity silmek yeterli: goals uzantısı ve links FK cascade ile düşer.
    for (const id of createdIds) {
      await supabase.from('entities').delete().eq('id', id)
    }
  })

  let rootId: string
  let childId: string

  it('yaratma: native entity (source_table NULL) + goals uzantı satırı + embedding', async () => {
    const { saveGoal } = await dbApi()
    const goal = await saveGoal(FIXTURE_USER_ID, {
      title: 'Vitray ustalığı',
      description: ROOT_TEXT,
      targetDate: '2027-06-30',
      progressType: 'percentage',
      progressValue: 10,
    })
    rootId = goal.id
    createdIds.push(rootId)

    expect(goal.status).toBe('active') // varsayılan
    expect(goal.parent_goal_id).toBeNull()
    expect(goal.target_date).toBe('2027-06-30')
    expect(goal.progress_value).toBe(10)

    const supabase = await adminApi()
    const { data: entity } = await supabase
      .from('entities')
      .select('type, title, content, source_table, source_id, embedding, user_id')
      .eq('id', rootId)
      .single()
    expect(entity!.type).toBe('goal')
    expect(entity!.source_table).toBeNull() // NATIVE mod — köprü değil
    expect(entity!.source_id).toBeNull()
    expect(entity!.title).toBe('Vitray ustalığı')
    expect(entity!.content).toBe(ROOT_TEXT)
    expect(JSON.parse(entity!.embedding as string) as number[]).toHaveLength(1024)
  }, 600_000) // ilk koşuda model yüklemesi burada ödenir

  it("alt hedef: parent_goal_id + otomatik 'sub-goal-of' links kenarı", async () => {
    const { saveGoal, SUB_GOAL_LINK_LABEL } = await dbApi()
    const child = await saveGoal(FIXTURE_USER_ID, {
      title: 'Kurşun profil tekniği',
      description: CHILD_TEXT,
      parentGoalId: rootId,
    })
    childId = child.id
    createdIds.push(childId)
    expect(child.parent_goal_id).toBe(rootId)

    const supabase = await adminApi()
    const { data: links } = await supabase
      .from('links')
      .select('target_entity_id, kind, label, strength')
      .eq('source_entity_id', childId)
    expect(links).toHaveLength(1)
    expect(links![0].target_entity_id).toBe(rootId)
    expect(links![0].kind).toBe('user')
    expect(links![0].label).toBe(SUB_GOAL_LINK_LABEL)
  }, 120_000)

  it('döngü koruması: kök, kendi alt hedefinin altına taşınamaz', async () => {
    const { saveGoal } = await dbApi()
    await expect(
      saveGoal(FIXTURE_USER_ID, { id: rootId, parentGoalId: childId }),
    ).rejects.toThrow(/döngüsel/)
  }, 60_000)

  it("retrieval: hedef semantik aramada bulunuyor, alt hedef graf boost'u alıyor", async () => {
    const { hybridRetrieve } = await retrievalApi()
    const results = await hybridRetrieve('vitray atölyesinde ustalaşmak', {
      userId: FIXTURE_USER_ID,
      limit: 5,
    })
    expect(results.some((r) => r.id === rootId)).toBe(true)
    // Kök güçlü eşleşince 'sub-goal-of' kenarı alt hedefe boost yayar
    // ("her şey birbirine bağlı" — roadmap graf kriteri goals'da da işler).
    const child = results.find((r) => r.id === childId)
    if (child) expect(child.graphBoost).toBeGreaterThan(0)
  }, 120_000)

  it('güncelleme: metin değişince embedding tazelenir, verilmeyen alan korunur', async () => {
    const { saveGoal } = await dbApi()
    const supabase = await adminApi()
    const { data: before } = await supabase.from('entities').select('embedding').eq('id', rootId).single()

    const updated = await saveGoal(FIXTURE_USER_ID, {
      id: rootId,
      description: `${ROOT_TEXT} Güncelleme: sergi tarihi netleşti.`,
      progressValue: 35,
    })
    expect(updated.title).toBe('Vitray ustalığı') // verilmedi → korundu
    expect(updated.progress_value).toBe(35)
    expect(updated.target_date).toBe('2027-06-30') // verilmedi → korundu

    const { data: after } = await supabase
      .from('entities')
      .select('content, embedding')
      .eq('id', rootId)
      .single()
    expect(after!.content).toContain('sergi tarihi netleşti')
    expect(after!.embedding).not.toBe(before!.embedding)
  }, 120_000)

  it('yeniden ebeveynleme: parent null olunca sub-goal-of kenarı düşer', async () => {
    const { saveGoal } = await dbApi()
    const detached = await saveGoal(FIXTURE_USER_ID, { id: childId, parentGoalId: null })
    expect(detached.parent_goal_id).toBeNull()

    const supabase = await adminApi()
    const { data: links } = await supabase.from('links').select('id').eq('source_entity_id', childId)
    expect(links).toHaveLength(0)

    // Testin devamı için ebeveyni geri bağla (silme testi SET NULL'u ölçecek).
    await saveGoal(FIXTURE_USER_ID, { id: childId, parentGoalId: rootId })
  }, 120_000)

  it("silme: entity+uzantı+link birlikte düşer, çocuk kök hedef olur, retrieval'a çıkmaz", async () => {
    const { deleteGoal } = await dbApi()
    expect(await deleteGoal(FIXTURE_USER_ID, rootId)).toBe(true)

    const supabase = await adminApi()
    const { data: entityRows } = await supabase.from('entities').select('id').eq('id', rootId)
    expect(entityRows).toHaveLength(0)
    const { data: goalRows } = await supabase.from('goals').select('id').eq('id', rootId)
    expect(goalRows).toHaveLength(0)
    const { data: linkRows } = await supabase.from('links').select('id').eq('target_entity_id', rootId)
    expect(linkRows).toHaveLength(0)

    // Çocuk yaşar, ebeveynsiz kalır (ON DELETE SET NULL — zincirleme silme yok).
    const { data: child } = await supabase.from('goals').select('parent_goal_id').eq('id', childId).single()
    expect(child!.parent_goal_id).toBeNull()

    const { hybridRetrieve } = await retrievalApi()
    const results = await hybridRetrieve('vitray atölyesinde ustalaşmak', {
      userId: FIXTURE_USER_ID,
      limit: 5,
    })
    expect(results.some((r) => r.id === rootId)).toBe(false)
  }, 120_000)

  it('olmayan hedefi silmek false döner (idempotent)', async () => {
    const { deleteGoal } = await dbApi()
    expect(await deleteGoal(FIXTURE_USER_ID, '00000000-0000-4000-8000-000000000000')).toBe(false)
  }, 60_000)
})
