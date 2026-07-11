// Agent Brain tip sözlüğü (migration 0005 — iki-mantıksal-Brain kararı).
// Personal Brain (scope='personal') ve Agent Brain (scope='agent') aynı
// fiziksel altyapıyı (entities + links) paylaşır; bu dosya o altyapının
// Agent Brain tarafından görülen zarfını (Node/Link envelope) tanımlar.
// Yalnız tip + sabit içerir — runtime bağımlılığı yok, her yerden import
// edilebilir ('server-only' değil; DB erişimi node-repository/link-registry/
// query katmanlarındadır).

import type { EntityType } from '../db-server'

export type BrainScope = 'personal' | 'agent'

// Sıcak katman (hot): herkes yazabilir — Signal girişi. Soğuk katman (cold):
// yalnız "privileged" entegrasyon yoluyla yazılır. NOT: bu ayrım yapısal/
// isimseldir; gerçek erişim kontrolü (Auth/RLS) bu fazda YOK.
export type NodeLayer = 'hot' | 'cold'

// Node yaşam döngüsü: gözlemlenen → aday → doğrulanmış → güvenilir.
// 'eskimiş' = supersedes kenarıyla işaretlenmiş node — bilgi SİLİNMEZ.
export const NODE_STATUSES = [
  'gözlemlenen', 'aday', 'doğrulanmış', 'güvenilir', 'eskimiş',
] as const
export type NodeStatus = (typeof NODE_STATUSES)[number]

// Soğuk katman node tipleri: yalnız privileged entegrasyon (integrateNode)
// yoluyla doğar.
export const COLD_NODE_TYPES = [
  'fact', 'skill', 'pattern', 'workflow', 'standard',
  'tool_reference', 'learning_record',
] as const
export type ColdNodeType = (typeof COLD_NODE_TYPES)[number]

/** Agent Brain'e özgü tipler: soğuk tipler + sıcak katman girişi 'signal'. */
export type AgentNodeType = ColdNodeType | 'signal'

/** Tüm node tipleri: Personal Brain'in mevcut 10 tipi + Agent Brain tipleri
 *  (entities.type CHECK listesinin TypeScript karşılığı). */
export type NodeType = EntityType | AgentNodeType

// Agent Brain'in 9 ilişki tipi. Şemada links.kind kolonunda yaşarlar
// (semantic/user/wikilink üçlüsünün yanında — migration 0005 notu).
// Const dizi, link-registry'nin runtime doğrulaması içindir: 9 tip dışını
// reddet.
export const LINK_TYPES = [
  'derived_from', 'validated_by', 'composed_of', 'supersedes', 'contradicts',
  'applies_to', 'enables', 'resulted_in', 'related_to',
] as const
export type LinkType = (typeof LINK_TYPES)[number]

/** Agent Brain link zarfı — links satırının Agent Brain görünümü
 *  (sourceId/targetId/type ↔ source_entity_id/target_entity_id/kind). */
export interface BrainLink {
  id: string
  sourceId: string
  targetId: string
  type: LinkType
  createdAt: string
}

/** Agent Brain node zarfı — entities satırının Agent Brain görünümü.
 *  embedding ve links opsiyoneldir: okuma yolları varsayılan olarak bu
 *  ağır alanları seçmez, isteyen katman ayrıca yükler. */
export interface BrainNode {
  id: string
  userId: string
  type: NodeType
  title: string
  content: string | null
  scope: BrainScope
  layer: NodeLayer
  status: NodeStatus
  confidenceCount: number
  lastVerifiedAt: string
  createdAt: string
  updatedAt: string
  embedding?: number[]
  links?: BrainLink[]
}
