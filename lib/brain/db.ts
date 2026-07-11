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
import type { BrainLink, BrainNode, LinkType, NodeLayer, NodeStatus, NodeType } from './types'

/** entities satırının Agent Brain zarfına giren kolonları (embedding hariç —
 *  okuma yolları ağır vektörü varsayılan seçmez, bkz. types.ts BrainNode). */
export const NODE_COLUMNS =
  'id, user_id, type, title, content, scope, layer, status, confidence_count, last_verified_at, created_at, updated_at'

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
