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
