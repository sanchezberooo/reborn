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

/**
 * Kullanıcı "yeni" mi — onboarding tanışma sohbeti tetiklenmeli mi? (Faz 2,
 * Görev 3; roadmap ilke 14.) Ölçüt: entities çekirdeğinde tek kayıt bile yok.
 * Journal, goal, not — Faz 1 sonrası tüm içerik entities'e aktığından "sıfır
 * veri"nin tek doğru kapısı burasıdır; onboarding sonunda save_goal ile ilk
 * entity doğar ve bu bayrak kendiliğinden söner.
 */
export async function needsOnboarding(userId: string): Promise<boolean> {
  const { supabase } = await entityDeps()
  const { count, error } = await supabase
    .from('entities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return (count ?? 0) === 0
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
// ─── Goals (Faz 2, Görev 2) ──────────────────────────────────────────────────
// Goals migration 0001'in NATIVE modunda yaşar: her goal bir entities satırı
// (type='goal', source_table NULL) + goals uzantı satırıdır (1:1, PK=FK, bkz.
// migrations/0002_goals.sql). Journal'daki köprü senkronunun (syncJournalEntry-
// Entity) karşılığı YOKTUR — title/description'ın esas kaynağı zaten entities,
// senkronize edilecek ikinci kaynak yok.

export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned'
export type GoalProgressType = 'binary' | 'percentage' | 'milestone'

/** Alt-hedef kenarının sözleşme etiketi: kaynak=çocuk, hedef=ebeveyn. */
export const SUB_GOAL_LINK_LABEL = 'sub-goal-of'

export interface Goal {
  id: string
  user_id: string
  title: string
  description: string | null
  parent_goal_id: string | null
  target_date: string | null
  status: GoalStatus
  progress_type: GoalProgressType
  progress_value: number
  created_at: string
  updated_at: string
}

export interface GoalInput {
  /** Verilirse güncelleme, verilmezse yaratma. */
  id?: string
  /** Yaratmada zorunlu; güncellemede verilmezse mevcut korunur. */
  title?: string
  description?: string | null
  parentGoalId?: string | null
  targetDate?: string | null
  status?: GoalStatus
  progressType?: GoalProgressType
  progressValue?: number
}

const GOAL_COLUMNS =
  'id, user_id, parent_goal_id, target_date, status, progress_type, progress_value, created_at, updated_at'

/** goals uzantı satırı + entity metnini tek Goal nesnesinde birleştirir. */
async function readGoal(goalId: string): Promise<Goal> {
  const { supabase } = await entityDeps()
  const [{ data: row, error }, { data: entity, error: entityError }] = await Promise.all([
    supabase.from('goals').select(GOAL_COLUMNS).eq('id', goalId).single(),
    supabase.from('entities').select('title, content').eq('id', goalId).single(),
  ])
  if (error) throw error
  if (entityError) throw entityError
  return {
    ...(row as Omit<Goal, 'title' | 'description' | 'target_date'>),
    target_date: (row as { target_date: string | null }).target_date
      ? String((row as { target_date: string }).target_date).slice(0, 10)
      : null,
    title: entity!.title as string,
    description: (entity!.content as string | null) ?? null,
  }
}

/** Ebeveyn zincirini yukarı yürüyerek döngü kontrolü: parent'ın ataları
 *  arasında goalId varsa bu atama hiyerarşiyi döngüye sokar. */
async function assertNoGoalCycle(goalId: string, parentId: string): Promise<void> {
  const { supabase } = await entityDeps()
  let cursor: string | null = parentId
  for (let depth = 0; cursor !== null; depth++) {
    if (cursor === goalId) {
      throw new Error('saveGoal: döngüsel alt-hedef ilişkisi — hedef kendi alt hedefinin altına taşınamaz.')
    }
    if (depth > 100) throw new Error('saveGoal: alt-hedef zinciri beklenmedik derinlikte (>100).')
    // Açık anotasyon: sorgu sonucu cursor'a geri aktığı için TS çıkarımı
    // kendine referans verir (TS7022) — sonucu bildirilmiş tiple karşıla.
    const res: { data: { parent_goal_id: string | null } | null; error: unknown } = await supabase
      .from('goals')
      .select('parent_goal_id')
      .eq('id', cursor)
      .maybeSingle()
    if (res.error) throw res.error
    cursor = res.data?.parent_goal_id ?? null
  }
}

/** Alt-hedef kenarını parent durumuna göre senkron tutar: bayat sub-goal-of
 *  kenarları silinir, geçerli ebeveyne kenar (yoksa) kurulur. */
async function syncSubGoalLink(goalId: string, parentId: string | null): Promise<void> {
  const { supabase } = await entityDeps()
  let stale = supabase
    .from('links')
    .delete()
    .eq('source_entity_id', goalId)
    .eq('kind', 'user')
    .eq('label', SUB_GOAL_LINK_LABEL)
  if (parentId) stale = stale.neq('target_entity_id', parentId)
  const { error } = await stale
  if (error) throw error

  if (parentId) {
    await createLink({
      sourceEntityId: goalId,
      targetEntityId: parentId,
      kind: 'user',
      label: SUB_GOAL_LINK_LABEL,
    })
  } else {
    invalidateRetrievalCache() // silme dalında createLink'in invalidasyonu yok
  }
}

/**
 * Goal yaratır ya da günceller (input.id). Yaratma: native entity (embedding
 * dahil) + goals uzantı satırı; uzantı yazımı başarısız olursa entity geri
 * alınır (yarım goal kalmaz). Güncelleme: verilmeyen alanlar korunur; başlık/
 * açıklama değişince embedding yeniden hesaplanır. Her iki yolda da alt-hedef
 * links kenarı parent_goal_id ile senkron tutulur.
 */
export async function saveGoal(userId: string, input: GoalInput): Promise<Goal> {
  const { supabase, embedder } = await entityDeps()

  if (input.parentGoalId) {
    const { data: parent, error } = await supabase
      .from('goals')
      .select('id, user_id')
      .eq('id', input.parentGoalId)
      .maybeSingle()
    if (error) throw error
    if (!parent || parent.user_id !== userId) {
      throw new Error('saveGoal: parent_goal_id geçersiz — ebeveyn hedef bulunamadı.')
    }
  }

  if (input.id) {
    // ── Güncelleme ──
    const { data: existing, error: lookupError } = await supabase
      .from('goals')
      .select(GOAL_COLUMNS)
      .eq('id', input.id)
      .eq('user_id', userId)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!existing) throw new Error('saveGoal: hedef bulunamadı.')

    const parentGoalId =
      input.parentGoalId !== undefined ? input.parentGoalId : (existing.parent_goal_id as string | null)
    if (parentGoalId) await assertNoGoalCycle(input.id, parentGoalId)

    if (input.title !== undefined || input.description !== undefined) {
      const { data: entity, error: entityError } = await supabase
        .from('entities')
        .select('title, content')
        .eq('id', input.id)
        .single()
      if (entityError) throw entityError
      const title = input.title !== undefined ? input.title : (entity!.title as string)
      if (!title.trim()) throw new Error('saveGoal: title boş olamaz.')
      const content = input.description !== undefined ? input.description : (entity!.content as string | null)
      const [embedding] = await embedder.embed([content ? `${title}\n\n${content}` : title])
      const { error: updateError } = await supabase
        .from('entities')
        .update({ title, content, embedding, updated_at: new Date().toISOString() })
        .eq('id', input.id)
      if (updateError) throw updateError
      invalidateRetrievalCache()
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.parentGoalId !== undefined) patch.parent_goal_id = input.parentGoalId
    if (input.targetDate !== undefined) patch.target_date = input.targetDate
    if (input.status !== undefined) patch.status = input.status
    if (input.progressType !== undefined) patch.progress_type = input.progressType
    if (input.progressValue !== undefined) patch.progress_value = input.progressValue
    const { error: goalError } = await supabase.from('goals').update(patch).eq('id', input.id)
    if (goalError) throw goalError

    await syncSubGoalLink(input.id, parentGoalId)
    return readGoal(input.id)
  }

  // ── Yaratma ──
  if (!input.title?.trim()) throw new Error('saveGoal: yeni hedef için title zorunlu.')

  const entity = await createEntity({
    userId,
    type: 'goal',
    title: input.title,
    content: input.description ?? undefined,
  })

  const { error: insertError } = await supabase.from('goals').insert({
    id: entity.id,
    user_id: userId,
    parent_goal_id: input.parentGoalId ?? null,
    target_date: input.targetDate ?? null,
    status: input.status ?? 'active',
    progress_type: input.progressType ?? 'binary',
    progress_value: input.progressValue ?? 0,
  })
  if (insertError) {
    await deleteEntity(entity.id).catch(() => {}) // rollback; asıl hata aşağıda
    throw insertError
  }

  if (input.parentGoalId) await syncSubGoalLink(entity.id, input.parentGoalId)
  return readGoal(entity.id)
}

/**
 * Goal'ü GERÇEKTEN siler — journal'daki gerekçeyle tutarlı: kullanıcı sil
 * dediğinde sistem unutur. Entity silinir; goals uzantısı ve links kenarları
 * FK cascade ile düşer, alt hedeflerin parent_goal_id'si SET NULL ile boşalır
 * (çocuklar kök hedef olur — zincirleme silme sürprizi yok, migration 0002
 * tasarım notu).
 */
export async function deleteGoal(userId: string, id: string): Promise<boolean> {
  const { supabase } = await entityDeps()
  const { data: row, error } = await supabase
    .from('goals')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!row) return false

  await deleteEntity(id)
  return true
}

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
