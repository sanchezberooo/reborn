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
// yoluyla doğar. Sprint 2 sözlük eşlemesi: Knowledge→fact, SOP→standard,
// Skill/Workflow/Pattern→aynı ad; 'template' (yeniden kullanılabilir üretim
// şablonu — Pinned Reference karakterli, roadmap §6.3) ve 'repository'
// (dış kod/kaynak deposu bilgi kartı) migration 0007 ile eklendi.
export const COLD_NODE_TYPES = [
  'fact', 'skill', 'pattern', 'workflow', 'standard',
  'tool_reference', 'learning_record', 'template', 'repository',
] as const
export type ColdNodeType = (typeof COLD_NODE_TYPES)[number]

/** Agent Brain'e özgü tipler: soğuk tipler + sıcak katman girişi 'signal'. */
export type AgentNodeType = ColdNodeType | 'signal'

/** Tüm node tipleri: Personal Brain'in 14 tipi + Agent Brain'in 10 tipi
 *  (entities.type CHECK listesinin TypeScript karşılığı — migration 0010). */
export type NodeType = EntityType | AgentNodeType

/** Personal Brain tip envanteri (scope='personal'). Sprint 4 eklemeleri:
 *  identity (kimlik çekirdeği), decision (karar kaydı — Decision History bu
 *  tipin zaman sıralı görünümü), preference (kalıcı tercih), reflection
 *  (dönemsel yansıma — Learning History'nin personal karşılığı). */
export const PERSONAL_NODE_TYPES = [
  'journal', 'goal', 'note', 'project', 'person',
  'task', 'essay', 'habit', 'resource', 'event',
  'identity', 'decision', 'preference', 'reflection',
] as const satisfies readonly EntityType[]
export type PersonalNodeType = (typeof PERSONAL_NODE_TYPES)[number]

/** Agent Brain tip envanteri (scope='agent') — soğuk tipler + sıcak 'signal'. */
export const AGENT_NODE_TYPES = [...COLD_NODE_TYPES, 'signal'] as const

// ── Hafıza sınıflaması (Sprint 4 — Memory Engine sözlüğü) ───────────────────
// Working/Long-Term Memory TİP DEĞİLDİR (migration 0010 üst notu):
//   * long-term  = kalıcı grafın kendisi (hiçbir node silinmez, eskitilir),
//   * working    = recency penceresi sorgusu (memory-engine.getWorkingMemory).
// Episodic/semantic ise SAKLAMA SINIFIDIR ve her tip tam birine eşlenir:
//   * episodic — zamana çakılı yaşantı/olay kaydı ("ne oldu"): timeline bu
//     sınıftan kurulur.
//   * semantic — zamandan bağımsız bilgi/olgu ("ne biliyorum/kimim").

export const MEMORY_CLASSES = ['episodic', 'semantic'] as const
export type MemoryClass = (typeof MEMORY_CLASSES)[number]

/** Tip → hafıza sınıfı — TAM eşleme (Record tüm NodeType'ları kapsamaya
 *  derleyici tarafından zorlanır; yeni tip eklemek = burada sınıf seçmek). */
export const MEMORY_CLASS_BY_TYPE: Record<NodeType, MemoryClass> = {
  // Personal — episodic (zamana çakılı):
  journal: 'episodic',
  event: 'episodic',
  decision: 'episodic',
  reflection: 'episodic',
  task: 'episodic',
  // Personal — semantic (zamandan bağımsız):
  goal: 'semantic',
  note: 'semantic',
  project: 'semantic',
  person: 'semantic',
  essay: 'semantic',
  habit: 'semantic',
  resource: 'semantic',
  identity: 'semantic',
  preference: 'semantic',
  // Agent — episodic:
  signal: 'episodic',
  learning_record: 'episodic',
  // Agent — semantic:
  fact: 'semantic',
  skill: 'semantic',
  pattern: 'semantic',
  workflow: 'semantic',
  standard: 'semantic',
  tool_reference: 'semantic',
  template: 'semantic',
  repository: 'semantic',
}

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
  /** Yapılandırılmış zarf (migration 0011) — v1'de tek yazarı Knowledge
   *  Pipeline'dır; embedding'e girmez, filtre/rapor katmanıdır. */
  metadata?: Record<string, unknown> | null
  embedding?: number[]
  links?: BrainLink[]
}
