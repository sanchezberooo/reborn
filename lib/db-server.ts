import 'server-only'

import { invalidateRetrievalCache } from './ai/retrieval-cache'

// Entities & Links (Faz 1 — Unified Entity Core) yazma yolu (migration 0001).
// Ayrı dosyada yaşamasının nedeni: bu fonksiyonlar LocalEmbeddingProvider
// (transformers.js + onnxruntime, yalnız sunucu) ve service-role admin
// client kullanır. lib/db.ts hem sunucu hem istemci ("use client" sayfaları)
// tarafından import edildiğinden, bu bağımlılıkların oradan statik/dinamik
// hiçbir yolla client webpack grafiğine sızmaması gerekir — 'server-only'
// import'u bunu build-time'da garanti eder (bkz. UnhandledSchemeError
// 'node:path' regresyonu).
// user_id parametre olarak alınır: sunucuda browser-session'lı uid() yok;
// köprü senkronu ve fixture importu çağırdıkları bağlamın kimliğini geçer.

export type EntityType =
  | 'journal' | 'goal' | 'note' | 'project' | 'person'
  | 'task' | 'essay' | 'habit' | 'resource' | 'event'

export type LinkKind = 'semantic' | 'user' | 'wikilink'

export interface Entity {
  id: string
  user_id: string
  type: EntityType
  title: string
  content: string | null
  source_table: string | null
  source_id: string | null
  created_at: string
  updated_at: string
}

export interface EntityLink {
  id: string
  source_entity_id: string
  target_entity_id: string
  kind: LinkKind
  label: string | null
  strength: number | null
  created_at: string
}

async function entityDeps() {
  const [{ getSupabaseAdmin }, { getLocalEmbeddingProvider }] = await Promise.all([
    import('./supabase-admin'),
    import('./ai/local-embedding'),
  ])
  return { supabase: getSupabaseAdmin(), embedder: getLocalEmbeddingProvider() }
}

export interface CreateEntityInput {
  userId: string
  type: EntityType
  title: string
  content?: string
  /** Köprü satırı için silo referansı — ikisi birlikte verilir (şema CHECK'i). */
  sourceTable?: string
  sourceId?: string
  /** Fixture/test verisi için tarih override'ı; verilmezse DB default now(). */
  createdAt?: string
}

/** Entity yaratır; embedding'i (title + content) üzerinden hesaplayıp kaydeder. */
export async function createEntity(input: CreateEntityInput): Promise<Entity> {
  const { supabase, embedder } = await entityDeps()
  const embeddingText = input.content ? `${input.title}\n\n${input.content}` : input.title
  const [embedding] = await embedder.embed([embeddingText])

  const row: Record<string, unknown> = {
    user_id: input.userId,
    type: input.type,
    title: input.title,
    content: input.content ?? null,
    embedding,
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
  }
  if (input.createdAt) row.created_at = input.createdAt

  const { data, error } = await supabase
    .from('entities')
    .insert(row)
    .select('id, user_id, type, title, content, source_table, source_id, created_at, updated_at')
    .single()
  if (error) throw error

  invalidateRetrievalCache()
  return data as Entity
}

export interface CreateLinkInput {
  sourceEntityId: string
  targetEntityId: string
  kind: LinkKind
  label?: string
  /** Yalnız kind='semantic' için: benzerlik skoru [0, 1] (şema CHECK'i). */
  strength?: number
}

/** İki entity arasına kenar ekler; aynı (source, target, kind) varsa günceller. */
export async function createLink(input: CreateLinkInput): Promise<EntityLink> {
  if (input.kind !== 'semantic' && input.strength !== undefined) {
    throw new Error("createLink: strength yalnız kind='semantic' kenarlarda geçerli (şema CHECK'i).")
  }
  const { supabase } = await entityDeps()
  const { data, error } = await supabase
    .from('links')
    .upsert(
      {
        source_entity_id: input.sourceEntityId,
        target_entity_id: input.targetEntityId,
        kind: input.kind,
        label: input.label ?? null,
        strength: input.strength ?? null,
      },
      { onConflict: 'source_entity_id,target_entity_id,kind' },
    )
    .select('id, source_entity_id, target_entity_id, kind, label, strength, created_at')
    .single()
  if (error) throw error

  invalidateRetrievalCache()
  return data as EntityLink
}

/** Entity'yi siler (bağlı links satırları FK cascade ile düşer). */
export async function deleteEntity(id: string): Promise<void> {
  const { supabase } = await entityDeps()
  const { error } = await supabase.from('entities').delete().eq('id', id)
  if (error) throw error
  invalidateRetrievalCache()
}

// ─── Journal köprü senkronu (Faz 2, Görev 1) ─────────────────────────────────
// journal_entries esas kaynak kalır; her kayıt entities'te bir köprü satırıyla
// (source_table='journal_entries') temsil edilir. Köprüdeki title/content
// embedding'in hesaplandığı türetilmiş metindir (migration 0001 tasarım notu).

/** lib/db.ts JournalEntry ile aynı alanlar; db.ts istemci bundle'ına girdiği
 *  için buradan import edilmez, sözleşme şemadır (journal_entries kolonları). */
export interface JournalEntryData {
  date: string
  mood: number
  day_score: number
  question_1: string
  answer_1: string
  question_2: string
  answer_2: string
  free_write: string
}

/** Tek kullanıcılı Faz'da sunucu tarafı kimlik: ilk (tek) profil satırı.
 *  lib/db.ts uid()'in sunucu karşılığı — browser session'ı yok, admin client var. */
export async function resolveSingleUserId(): Promise<string> {
  const { supabase } = await entityDeps()
  const { data, error } = await supabase.from('profiles').select('id').limit(1).single()
  if (error) throw error
  if (!data?.id) throw new Error('Profil bulunamadı — POST /api/setup ile seed et.')
  return data.id as string
}

/** Köprü satırının türetilmiş metni: serbest yazı + cevaplı sorular + skorlar.
 *  Boş alanlar atlanır ki embedding gürültü yerine gerçek içeriği temsil etsin. */
function deriveJournalEntityText(entry: JournalEntryData): { title: string; content: string } {
  const parts: string[] = []
  if (entry.free_write.trim()) parts.push(entry.free_write.trim())
  if (entry.answer_1.trim()) parts.push(`${entry.question_1}\n${entry.answer_1.trim()}`)
  if (entry.answer_2.trim()) parts.push(`${entry.question_2}\n${entry.answer_2.trim()}`)
  parts.push(`Ruh hali: ${entry.mood}/10 · Gün puanı: ${entry.day_score}/10`)
  return { title: `Günlük ${entry.date}`, content: parts.join('\n\n') }
}

/**
 * journal_entries satırının köprü entity'sini yaratır ya da günceller
 * (embedding yeniden hesaplanır). Hem yazma yolu (saveJournalEntry) hem
 * backfill script'i (scripts/backfill-journal-entities.ts) bunu kullanır.
 */
export async function syncJournalEntryEntity(
  userId: string,
  journalId: string,
  entry: JournalEntryData,
): Promise<'created' | 'updated'> {
  const { supabase, embedder } = await entityDeps()
  const { title, content } = deriveJournalEntityText(entry)

  const { data: existing, error: lookupError } = await supabase
    .from('entities')
    .select('id')
    .eq('source_table', 'journal_entries')
    .eq('source_id', journalId)
    .maybeSingle()
  if (lookupError) throw lookupError

  if (existing) {
    const [embedding] = await embedder.embed([`${title}\n\n${content}`])
    const { error } = await supabase
      .from('entities')
      .update({ title, content, embedding, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw error
    invalidateRetrievalCache()
    return 'updated'
  }

  await createEntity({
    userId,
    type: 'journal',
    title,
    content,
    sourceTable: 'journal_entries',
    sourceId: journalId,
    // Recency ağırlığı günlüğün gününü yansıtsın; gün ortası, TZ kaymasında
    // gün değişmesin diye.
    createdAt: `${entry.date}T12:00:00.000Z`,
  })
  return 'created'
}

/**
 * Journal yazma yolunun sunucu tarafı: silo upsert + köprü senkronu.
 * Silo yazımı esastır ve senkrondan bağımsız korunur — embedding/entity
 * hatası kullanıcının günlüğünü kaybettirmez (entitySynced: false döner,
 * backfill script'i sonradan iyileştirir).
 */
export async function saveJournalEntry(
  userId: string,
  entry: JournalEntryData,
): Promise<{ id: string; entitySynced: boolean }> {
  const { supabase } = await entityDeps()
  const { data, error } = await supabase
    .from('journal_entries')
    .upsert(
      { ...entry, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' },
    )
    .select('id')
    .single()
  if (error) throw error
  const journalId = data.id as string

  try {
    await syncJournalEntryEntity(userId, journalId, entry)
    return { id: journalId, entitySynced: true }
  } catch (syncError) {
    console.error('[journal] köprü senkronu başarısız (silo kayıt korundu):', syncError)
    return { id: journalId, entitySynced: false }
  }
}

/**
 * Journal kaydını VE köprü entity'sini siler (arşivleme değil — gerekçe:
 * köprü satırı türetilmiş bir indeks kopyasıdır, esas kaynak silo satırdır;
 * kullanıcı günlüğü sildiğinde sistemin gerçekten unutması gerekir —
 * roadmap "kontrol ve güven kullanıcıda" ilkesi + Faz 1 "silinen hafıza
 * retrieval'a bir daha çıkmıyor" kriteri. Entity'den türetilmiş memories
 * satırları FK on delete set null ile bağımsız yaşar; onların silinmesi
 * hafıza görünürlüğü UI'ının ayrı kararıdır.)
 * Sıra bilinçli: önce köprü — silo silinip köprü kalırsa silinmiş içerik
 * retrieval'da görünmeye devam ederdi (güven ihlali); tersi yalnızca
 * backfill ile kapanan zararsız bir boşluk bırakır.
 */
export async function deleteJournalEntry(userId: string, date: string): Promise<boolean> {
  const { supabase } = await entityDeps()
  const { data: row, error: lookupError } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (!row) return false

  const { error: entityError } = await supabase
    .from('entities')
    .delete()
    .eq('source_table', 'journal_entries')
    .eq('source_id', row.id as string)
  if (entityError) throw entityError

  const { error: journalError } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', row.id as string)
  if (journalError) throw journalError

  invalidateRetrievalCache()
  return true
}
