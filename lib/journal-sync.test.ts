import { afterAll, describe, expect, it } from 'vitest'
import { FIXTURE_USER_ID } from '../scripts/fixture-data'
import type { JournalEntryData } from './db-server'

// Journal → entities köprü senkronu entegrasyon testi (Faz 2, Görev 1).
// retrieval.test.ts ile aynı önkoşullar: canlı Supabase + gerçek bge-m3;
// env yoksa suite skip. Tüm kayıtlar FIXTURE_USER_ID altında, uzak geçmiş
// bir tarihle yazılır ve afterAll'da temizlenir — gerçek kullanıcı verisine
// dokunmaz.

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Modül zinciri env ister; env'siz ortamda skip yerine patlamasın diye dinamik.
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

const TEST_DATE = '2020-02-02'
// Fixture setinde eşi olmayan benzersiz içerik — retrieval doğrulaması bunun
// üzerinden yapılır (retrieval.test.ts silme testiyle aynı teknik).
const UNIQUE_TEXT =
  'Mor flamingo takımyıldızının altında teleskopla mandolin çaldım — köprü senkron testine özgü benzersiz cümle.'
const UPDATED_TEXT =
  'Güncelleme: mor flamingo gözlemine bu kez akordeon eşlik etti — köprü senkron testinin ikinci benzersiz cümlesi.'

function makeEntry(freeWrite: string): JournalEntryData {
  return {
    date: TEST_DATE,
    mood: 7,
    day_score: 8,
    question_1: 'Bugün seni ne şaşırttı?',
    answer_1: 'Gökyüzünün berraklığı.',
    question_2: '',
    answer_2: '',
    free_write: freeWrite,
  }
}

describe.skipIf(!hasEnv)('journal → entities köprü senkronu (canlı Supabase + bge-m3)', () => {
  afterAll(async () => {
    const supabase = await adminApi()
    // Sıra: önce köprü, sonra silo (deleteJournalEntry ile aynı gerekçe).
    const { data: rows } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('user_id', FIXTURE_USER_ID)
      .eq('date', TEST_DATE)
    for (const row of rows ?? []) {
      await supabase
        .from('entities')
        .delete()
        .eq('source_table', 'journal_entries')
        .eq('source_id', row.id as string)
    }
    await supabase
      .from('journal_entries')
      .delete()
      .eq('user_id', FIXTURE_USER_ID)
      .eq('date', TEST_DATE)
  })

  let journalId: string
  let entityId: string

  it('yeni girdi silo tabloya VE entities köprüsüne embedding ile yazılıyor', async () => {
    const { saveJournalEntry } = await dbApi()
    const result = await saveJournalEntry(FIXTURE_USER_ID, makeEntry(UNIQUE_TEXT))
    expect(result.entitySynced).toBe(true)
    journalId = result.id

    const supabase = await adminApi()
    const { data: entity, error } = await supabase
      .from('entities')
      .select('id, type, title, content, embedding, user_id')
      .eq('source_table', 'journal_entries')
      .eq('source_id', journalId)
      .single()
    expect(error).toBeNull()
    expect(entity!.type).toBe('journal')
    expect(entity!.user_id).toBe(FIXTURE_USER_ID)
    expect(entity!.title).toBe(`Günlük ${TEST_DATE}`)
    expect(entity!.content).toContain(UNIQUE_TEXT)
    // PostgREST vector kolonunu string döndürür — 1024 boyut sözleşmesi.
    const vector = JSON.parse(entity!.embedding as string) as number[]
    expect(vector).toHaveLength(1024)
    entityId = entity!.id as string
  }, 600_000) // ilk koşuda model yüklemesi burada ödenir

  it("köprü entity'si hibrit retrieval'da bulunuyor", async () => {
    const { hybridRetrieve } = await retrievalApi()
    const results = await hybridRetrieve('flamingo takımyıldızı altında mandolin', {
      userId: FIXTURE_USER_ID,
      limit: 5,
    })
    expect(results.some((r) => r.id === entityId)).toBe(true)
  }, 120_000)

  it('aynı güne ikinci kayıt köprüyü çoğaltmıyor, güncelliyor', async () => {
    const { saveJournalEntry } = await dbApi()
    const result = await saveJournalEntry(FIXTURE_USER_ID, makeEntry(UPDATED_TEXT))
    expect(result.id).toBe(journalId) // upsert: aynı silo satırı

    const supabase = await adminApi()
    const { data: bridges } = await supabase
      .from('entities')
      .select('id, content')
      .eq('source_table', 'journal_entries')
      .eq('source_id', journalId)
    expect(bridges).toHaveLength(1)
    expect(bridges![0].id).toBe(entityId)
    expect(bridges![0].content).toContain(UPDATED_TEXT)
    expect(bridges![0].content).not.toContain(UNIQUE_TEXT)
  }, 120_000)

  it("silme: silo satırı ve köprü birlikte düşüyor, retrieval'a çıkmıyor", async () => {
    const { deleteJournalEntry } = await dbApi()
    const deleted = await deleteJournalEntry(FIXTURE_USER_ID, TEST_DATE)
    expect(deleted).toBe(true)

    const supabase = await adminApi()
    const { data: journalRows } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('user_id', FIXTURE_USER_ID)
      .eq('date', TEST_DATE)
    expect(journalRows).toHaveLength(0)
    const { data: bridgeRows } = await supabase
      .from('entities')
      .select('id')
      .eq('source_table', 'journal_entries')
      .eq('source_id', journalId)
    expect(bridgeRows).toHaveLength(0)

    const { hybridRetrieve } = await retrievalApi()
    const results = await hybridRetrieve('flamingo takımyıldızı altında mandolin', {
      userId: FIXTURE_USER_ID,
      limit: 5,
    })
    expect(results.some((r) => r.id === entityId)).toBe(false)
  }, 120_000)

  it('olmayan tarihi silmek false döner (idempotent)', async () => {
    const { deleteJournalEntry } = await dbApi()
    expect(await deleteJournalEntry(FIXTURE_USER_ID, '1999-01-01')).toBe(false)
  }, 60_000)
})
