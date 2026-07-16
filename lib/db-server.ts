import 'server-only'

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
  // Sprint 4 (migration 0010) — Personal Brain çekirdek kavramları:
  | 'identity' | 'decision' | 'preference' | 'reflection'

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

  return data as EntityLink
}

/** Entity'yi siler (bağlı links satırları FK cascade ile düşer). */
export async function deleteEntity(id: string): Promise<void> {
  const { supabase } = await entityDeps()
  const { error } = await supabase.from('entities').delete().eq('id', id)
  if (error) throw error
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
// ─── Memories köprü yazımı (save_memory tool'u) ──────────────────────────────
// memories silo tablosu ESAS kaynak olarak kalır (mevcut verinin taşınması /
// tablonun geleceği AYRI bir görev); her YENİ hafıza journal desenindeki gibi
// entities'te embedding'li bir köprü satırı (source_table='memories') kazanır
// ki hybridRetrieve'e — dolayısıyla chat bağlamına — dahil olsun.
// Entity tipi 'note': şema CHECK listesinde 'memory' tipi yok ve yeni tip =
// yeni migration + uygulanana dek kırık save_memory demekti; kökeni zaten
// source_table taşıyor. Taksonomi kararı FAZ AI'da (CLAUDE.md §4).

export interface MemoryInput {
  content: string
  importance?: number
  tags?: string[]
  type?: string
}

const MEMORY_TITLE_MAX = 80

function deriveMemoryTitle(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > MEMORY_TITLE_MAX ? `${flat.slice(0, MEMORY_TITLE_MAX)}…` : flat
}

/**
 * Hafıza yazma yolu: silo insert + köprü senkronu (saveJournalEntry ile aynı
 * sözleşme). Silo yazımı esastır; embedding/entity hatası hafızayı
 * kaybettirmez (entitySynced: false döner).
 */
export async function saveMemory(
  userId: string,
  input: MemoryInput,
): Promise<{ id: string; entitySynced: boolean }> {
  const { supabase } = await entityDeps()
  const date = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const { data, error } = await supabase
    .from('memories')
    .insert({
      user_id: userId,
      content: input.content,
      summary: input.content,
      importance: input.importance ?? 5,
      tags: input.tags ?? [],
      type: input.type ?? 'general',
      date,
    })
    .select('id')
    .single()
  if (error) throw error
  const memoryId = data.id as string

  try {
    const entity = await createEntity({
      userId,
      type: 'note',
      title: deriveMemoryTitle(input.content),
      content: input.content,
      sourceTable: 'memories',
      sourceId: memoryId,
    })

    // Sprint 4 (Memory Engine): hiçbir kayıt yalnız yaşamamalı — köprü entity
    // en benzer node'lara otomatik bağlanır (semantic kenar, strength=benzerlik;
    // hibrit retrieval'ın graf genişletmesi bu kenarları okur). Bağ kurulamaması
    // kaydı DÜŞÜRMEZ: entity senkronu tamamlandı, bağ ikincil zenginleştirmedir.
    try {
      const { autoLinkNode } = await import('./brain/memory-engine')
      await autoLinkNode(entity.id)
    } catch (linkError) {
      console.error('[memories] otomatik ilişki kurulamadı (kayıt korundu):', linkError)
    }

    return { id: memoryId, entitySynced: true }
  } catch (syncError) {
    console.error('[memories] köprü senkronu başarısız (silo kayıt korundu):', syncError)
    return { id: memoryId, entitySynced: false }
  }
}

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

// ─── Brain graf görünümü (roadmap §6.2: tek graf, ayrım erişim yolunda) ───────
// Görsel graf için salt-okunur entities+links dökümü. Sorgu deseni lib/ai/
// retrieval.ts'teki loadSnapshot ile aynı: admin client, entities user_id ile
// filtrelenir, links'te user_id yok (şemada yok) — iki uçtan bu kullanıcının
// entity setine daraltılarak filtrelenir. Embedding okunmaz (retrieval'ın işi
// bu değil, sadece görselleştirme); layout/boyut/etiket hesaplaması
// lib/brain-layout.ts'te (saf, client-safe) yapılır.

export interface BrainGraphNode {
  id: string
  title: string
  content: string | null
  type: EntityType
  createdAt: string
  updatedAt: string
}

export interface BrainGraphEdge {
  source: string
  target: string
  kind: LinkKind
}

export interface BrainGraph {
  nodes: BrainGraphNode[]
  edges: BrainGraphEdge[]
}

export async function getBrainGraph(userId: string): Promise<BrainGraph> {
  const { supabase } = await entityDeps()
  const { data: entityRows, error: entityError } = await supabase
    .from('entities')
    .select('id, title, content, type, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1000)
  if (entityError) throw entityError

  const nodes: BrainGraphNode[] = (entityRows ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    content: (row.content as string | null) ?? null,
    type: row.type as EntityType,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }))
  const ids = new Set(nodes.map((n) => n.id))

  const { data: linkRows, error: linkError } = await supabase
    .from('links')
    .select('source_entity_id, target_entity_id, kind')
    .limit(5000)
  if (linkError) throw linkError

  const edges: BrainGraphEdge[] = (linkRows ?? [])
    .filter((row) => ids.has(row.source_entity_id as string) && ids.has(row.target_entity_id as string))
    .map((row) => ({
      source: row.source_entity_id as string,
      target: row.target_entity_id as string,
      kind: row.kind as LinkKind,
    }))

  return { nodes, edges }
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

  return true
}

// ─── Obsidian vault senkronu (Faz 2, Görev 5) ────────────────────────────────
// Notlar 0001'in NATIVE modunda yaşar (type='note', source_table NULL —
// goals'daki desenle aynı gerekçe, bkz. migration 0002 başlığı). Ama
// Obsidian notlarının esas kaynağı disktir; hangi entity'nin hangi dosyaya
// karşılık geldiği entities.source_table'da DEĞİL, ayrı bir bookkeeping
// tablosunda (obsidian_sync_index, migration 0004) tutulur — böylece
// ileride Obsidian dışı elle oluşturulan bir 'note' entity'si bu senkronun
// silme/güncelleme taramasına hiç girmez.

export interface ObsidianSyncResult {
  created: number
  updated: number
  deleted: number
  linked: number
}

/**
 * Vault dosya listesinden (VaultFile[]) entity+link senkronu — saf DB
 * mantığı, fs'e dokunmaz. syncObsidianVault (aşağıda) bunu gerçek kasadan
 * okuyarak çağırır; testler (lib/obsidian-vault-sync.test.ts) sahte dosya
 * listesiyle doğrudan çağırır.
 *
 * Sıra: (1) her not upsert edilir — içerik değişmediyse embedding yeniden
 * hesaplanmaz ("dosya değişiminde yeniden işlenir" roadmap kriteri), (2)
 * vault'ta artık olmayan yollar silinir, (3) her notun wikilink kenarları
 * o an geçerli haliyle DEĞİŞTİRİLİR (eski kenarlar silinip yeniden yazılır)
 * — idempotent, silinen bir [[link]] bir daha sonraki senkronda düşer.
 */
export async function syncObsidianVaultNotes(
  userId: string,
  files: import('./obsidian-sync').VaultFile[],
): Promise<ObsidianSyncResult> {
  const { parseVaultFiles } = await import('./obsidian-sync')
  const { supabase, embedder } = await entityDeps()
  const notes = parseVaultFiles(files)

  const { data: indexRows, error: indexError } = await supabase
    .from('obsidian_sync_index')
    .select('vault_path, entity_id')
    .eq('user_id', userId)
  if (indexError) throw indexError
  const indexByPath = new Map((indexRows ?? []).map((r) => [r.vault_path as string, r.entity_id as string]))

  const entityIds = (indexRows ?? []).map((r) => r.entity_id as string)
  const { data: entityRows, error: entityFetchError } =
    entityIds.length > 0
      ? await supabase.from('entities').select('id, content').in('id', entityIds)
      : { data: [] as { id: string; content: string | null }[], error: null }
  if (entityFetchError) throw entityFetchError
  const contentById = new Map((entityRows ?? []).map((r) => [r.id as string, r.content as string | null]))

  let created = 0
  let updated = 0
  const idByTitle = new Map<string, string>()
  const currentPaths = new Set<string>()

  for (const note of notes) {
    currentPaths.add(note.relativePath)
    const existingId = indexByPath.get(note.relativePath)

    if (existingId) {
      if (idByTitle.has(note.title)) {
        console.warn(
          `[obsidian-sync] birden fazla not aynı başlığı taşıyor: "${note.title}" — wikilink hedefi belirsiz, son işlenen kazanır.`,
        )
      }
      idByTitle.set(note.title, existingId)

      if (contentById.get(existingId) !== note.content) {
        const [embedding] = await embedder.embed([`${note.title}\n\n${note.content}`])
        const { error: updateError } = await supabase
          .from('entities')
          .update({ title: note.title, content: note.content, embedding, updated_at: new Date().toISOString() })
          .eq('id', existingId)
        if (updateError) throw updateError
        updated++
      }
    } else {
      const entity = await createEntity({ userId, type: 'note', title: note.title, content: note.content })
      const { error: indexInsertError } = await supabase
        .from('obsidian_sync_index')
        .insert({ vault_path: note.relativePath, entity_id: entity.id, user_id: userId })
      if (indexInsertError) throw indexInsertError

      if (idByTitle.has(note.title)) {
        console.warn(
          `[obsidian-sync] birden fazla not aynı başlığı taşıyor: "${note.title}" — wikilink hedefi belirsiz, son işlenen kazanır.`,
        )
      }
      idByTitle.set(note.title, entity.id)
      created++
    }
  }

  // Kasadan silinen dosyalar: indeksteydi, artık bu senkronda görülmedi.
  // deleteEntity FK cascade ile obsidian_sync_index satırını da düşürür.
  const toDelete = (indexRows ?? []).filter((r) => !currentPaths.has(r.vault_path as string))
  for (const row of toDelete) {
    await deleteEntity(row.entity_id as string)
  }

  // Wikilink kenarları: her not için baştan kurulur (idempotent — silinen
  // bir referans bir daha yazılmaz).
  let linked = 0
  for (const note of notes) {
    const sourceId = idByTitle.get(note.title)
    if (!sourceId) continue // aynı başlık çakışmasında ikinci not atlanmış olabilir

    const { error: deleteLinksError } = await supabase
      .from('links')
      .delete()
      .eq('source_entity_id', sourceId)
      .eq('kind', 'wikilink')
    if (deleteLinksError) throw deleteLinksError

    for (const target of note.wikilinks) {
      const targetId = idByTitle.get(target)
      if (!targetId || targetId === sourceId) continue // kasada yok ya da kendine referans
      await createLink({ sourceEntityId: sourceId, targetEntityId: targetId, kind: 'wikilink' })
      linked++
    }
  }

  return { created, updated, deleted: toDelete.length, linked }
}

/** Kasa dizinini özyinelemeli tarar, yalnız .md dosyalarını okur.
 *  relativePath vault köküne göredir (obsidian_sync_index anahtarı). */
async function readVaultFiles(vaultPath: string): Promise<import('./obsidian-sync').VaultFile[]> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const out: import('./obsidian-sync').VaultFile[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = await fs.readFile(full, 'utf-8')
        out.push({ relativePath: path.relative(vaultPath, full), content })
      }
    }
  }

  await walk(vaultPath)
  return out
}

/**
 * Senkronun sunucu ucu: OBSIDIAN_VAULT_PATH'ten kasayı okur, syncObsidianVaultNotes'a
 * devreder. Bağlantı yöntemi olarak dosya sistemi seçildi (Obsidian Local REST
 * API eklentisine karşı) — gerekçe: (1) Next.js API route zaten aynı makinede
 * çalışıyor, dosya okumak ek bir servisin (Obsidian uygulamasının açık ve
 * eklentinin aktif olması) ayakta olmasını gerektirmiyor; (2) tek secret
 * (env path) yeterli, REST API'nin kendi API anahtarı + genelde kendinden
 * imzalı sertifika yönetimi gerekmiyor; (3) "silinen dosya" tespiti dizin
 * taramasıyla doğrudan yapılabiliyor, REST API'de de ayrı bir liste uç
 * noktasına ihtiyaç doğardı — kazanç yok, bağımlılık fazlası var.
 */
export async function syncObsidianVault(userId: string): Promise<ObsidianSyncResult> {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH
  if (!vaultPath) {
    throw new Error('syncObsidianVault: OBSIDIAN_VAULT_PATH env değişkeni tanımlı değil.')
  }
  const files = await readVaultFiles(vaultPath)
  return syncObsidianVaultNotes(userId, files)
}
