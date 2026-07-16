// Agent Brain iç DB katmanı — node-repository ile link-registry'nin
// paylaştığı erişim yardımcıları. Ayrı dosyada yaşamasının nedeni döngüsel
// import'u önlemek: node-repository, derived_from kenarı için link-registry'yi
// çağırır; link-registry de node satırı okuyup zarfa çevirir — ikisi de
// buradaki ortak deps/mapper'ı kullanır, birbirini import etmez (tek yön:
// node-repository → link-registry → db).
//
// Desen lib/db-server.ts entityDeps ile aynı: LocalEmbeddingProvider ve
// service-role admin client yalnız sunucuda yaşar; 'server-only' import'u
// client bundle sızıntısını build-time'da keser, ağır bağımlılıklar dinamik
// import ile yüklenir.

import 'server-only'
import type { BrainLink, BrainNode, BrainScope, LinkType, NodeLayer, NodeStatus, NodeType } from './types'

/** entities satırının Agent Brain zarfına giren kolonları (embedding hariç —
 *  okuma yolları ağır vektörü varsayılan seçmez, bkz. types.ts BrainNode). */
export const NODE_COLUMNS =
  'id, user_id, type, title, content, scope, layer, status, confidence_count, last_verified_at, created_at, updated_at, metadata'

export const LINK_COLUMNS = 'id, source_entity_id, target_entity_id, kind, created_at'

export async function brainDeps() {
  const [{ getSupabaseAdmin }, { getLocalEmbeddingProvider }] = await Promise.all([
    import('../supabase-admin'),
    import('../ai/local-embedding'),
  ])
  return { supabase: getSupabaseAdmin(), embedder: getLocalEmbeddingProvider() }
}

export function mapNodeRow(row: Record<string, unknown>): BrainNode {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as NodeType,
    title: row.title as string,
    content: (row.content as string | null) ?? null,
    scope: row.scope as BrainNode['scope'],
    layer: row.layer as NodeLayer,
    status: row.status as NodeStatus,
    confidenceCount: row.confidence_count as number,
    lastVerifiedAt: row.last_verified_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  }
}

export function mapLinkRow(row: Record<string, unknown>): BrainLink {
  return {
    id: row.id as string,
    sourceId: row.source_entity_id as string,
    targetId: row.target_entity_id as string,
    type: row.kind as LinkType,
    createdAt: row.created_at as string,
  }
}

// ── Sprint 4 (Brain Engine) ortak erişim yardımcıları ───────────────────────
// Graph/Memory/Update/Search motorlarının paylaştığı, scope-parametreli
// alçak-seviye okuma yolları. Motorlar scope'u DAİMA açık parametre alır —
// iki Brain'in karışmaması bu katmanda filtreyle, üst katmanlarda sözleşmeyle
// korunur.

/** PostgREST vector kolonu "[0.1,...]" string'i dönebilir (retrieval.ts deseni). */
export function parseEmbeddingValue(value: unknown): number[] {
  if (Array.isArray(value)) return value as number[]
  if (typeof value === 'string') return JSON.parse(value) as number[]
  throw new Error('brain/db: embedding kolonu beklenmeyen formatta.')
}

/** Node'un embedding vektörü — yoksa null (embedding üretimi başarısız olmuş
 *  satırlar yaşayabilir; çağıran null'u "benzerlik hesaplanamaz" sayar). */
export async function getNodeEmbedding(id: string): Promise<number[] | null> {
  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('entities')
    .select('embedding')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data || data.embedding == null) return null
  return parseEmbeddingValue(data.embedding)
}

/** id listesinden node zarfları — scope filtresi ZORUNLU: motorların hiçbir
 *  yolu istenmeyen Brain'in satırını döndüremez. */
export async function getNodesByIds(ids: string[], scope: BrainScope): Promise<BrainNode[]> {
  if (ids.length === 0) return []
  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .in('id', ids)
    .eq('scope', scope)
  if (error) throw error
  return (data ?? []).map((r) => mapNodeRow(r as Record<string, unknown>))
}

export interface SimilarNodeRow {
  id: string
  type: string
  title: string
  content: string | null
  createdAt: string
  scope: BrainScope
  similarity: number
}

/** match_entities RPC'sinin (migration 0006, HNSW) motor sarmalayıcısı —
 *  hazır embedding ile benzerlik adayları. Sorgu metniyle arama yapan üst
 *  katman (search/update) embedding'i BİR KEZ hesaplar, buraya geçer. */
export async function matchSimilarNodes(
  userId: string,
  embedding: number[],
  opts: { scope?: BrainScope; limit?: number } = {},
): Promise<SimilarNodeRow[]> {
  const { supabase } = await brainDeps()
  const { data, error } = await supabase.rpc('match_entities', {
    p_user_id: userId,
    p_query_embedding: embedding,
    p_match_limit: opts.limit ?? 10,
    p_scope: opts.scope ?? null,
  })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    type: row.type as string,
    title: row.title as string,
    content: (row.content as string | null) ?? null,
    createdAt: row.created_at as string,
    scope: row.scope as BrainScope,
    similarity: row.similarity as number,
  }))
}
