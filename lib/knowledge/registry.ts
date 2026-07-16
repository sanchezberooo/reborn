// Knowledge Registry (Sprint 5) — departmanın ürettiği TÜM çıktıların
// yönetim yüzeyi: item/extraction listeleme, tam zarf okuma (ilişkiler +
// extraction referansları + hesaplanan tazelik), inceleme kararları.
// 'server-only'. Depolama Brain'dir (entities/links) — Registry ayrı tablo
// TUTMAZ, yalnız okur ve yaşam döngüsünü yönetir.
//
// İNCELEME MODELİ: pipeline her şeyi 'aday' doğurur. Registry kararları:
//   approve → 'doğrulanmış'   (insan/ajan onayı — confidence artar,
//   trust   → 'güvenilir'      node-repository updateNodeStatus kuralı)
//   reject  → 'eskimiş'        (bilgi SİLİNMEZ — emekli edilir; decay
//                               sıralamada geriye düşürür ama iz kalır)

import 'server-only'
import { brainDeps, mapNodeRow, NODE_COLUMNS } from '../brain/db'
import { getLinkedNodes } from '../brain/link-registry'
import { updateNodeStatus } from '../brain/node-repository'
import { computeFreshness } from '../brain/scoring'
import type { BrainNode } from '../brain/types'
import { publishKnowledgeEvent } from './events'
import type {
  ExtractionKind, ExtractionMeta, KnowledgeCategory, KnowledgeExtractionRef, KnowledgeItem, KnowledgeItemMeta,
} from './types'
import { EXTRACTION_NODE_TYPE } from './types'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/** Knowledge item taşıyan node tipleri (pipeline itemType kararının aynası). */
const ITEM_NODE_TYPES = ['fact', 'repository'] as const

function itemMetaOf(node: BrainNode): KnowledgeItemMeta | null {
  const meta = node.metadata
  if (!meta || meta.kind !== 'knowledge-item') return null
  return meta as KnowledgeItemMeta
}

function extractionMetaOf(node: BrainNode): ExtractionMeta | null {
  const meta = node.metadata
  if (!meta || meta.kind !== 'knowledge-extraction') return null
  return meta as ExtractionMeta
}

function toExtractionRef(node: BrainNode): KnowledgeExtractionRef {
  const meta = extractionMetaOf(node)
  return {
    nodeId: node.id,
    title: node.title,
    status: node.status,
    confidence: meta?.confidence ?? null,
  }
}

/** Node + meta + kenarlardan tam KnowledgeItem zarfı kurar. */
async function buildItem(node: BrainNode, meta: KnowledgeItemMeta): Promise<KnowledgeItem> {
  const linked = await getLinkedNodes(node.id)

  const relationships = linked.map((l) => ({
    nodeId: l.node.id,
    title: l.node.title,
    linkType: l.link.type,
    direction: l.direction,
  }))

  // Extraction'lar: bu item'a GELEN derived_from kenarlarının sahipleri.
  // Tür çözümü önce metadata.extractionKind'dan (kesin), yoksa node
  // tipinden (pattern tipini üç kutup paylaşır — tip tek başına yetmez).
  const byKind = Object.fromEntries(
    (Object.keys(EXTRACTION_NODE_TYPE) as ExtractionKind[]).map((k) => [k, [] as KnowledgeExtractionRef[]]),
  ) as Record<ExtractionKind, KnowledgeExtractionRef[]>
  for (const l of linked) {
    if (l.link.type !== 'derived_from' || l.direction !== 'incoming') continue
    const metaKind = extractionMetaOf(l.node)?.extractionKind
    const kind = metaKind && byKind[metaKind]
      ? metaKind
      : (Object.keys(EXTRACTION_NODE_TYPE) as ExtractionKind[]).find((k) => l.node.type === EXTRACTION_NODE_TYPE[k])
    if (kind) byKind[kind].push(toExtractionRef(l.node))
  }

  return {
    id: node.id,
    nodeType: node.type,
    title: node.title,
    content: node.content,
    status: node.status,
    source: meta.source,
    author: meta.author,
    version: meta.version,
    trustScore: meta.trustScore,
    // Tazelik OKUMA ANINDA hesaplanır (decay ilkesi — saklanmaz): Agent
    // Brain'in tazelik çapası last_verified_at'tir (search.ts blendedScore
    // ile aynı seçim).
    freshness: computeFreshness(node.lastVerifiedAt),
    tags: meta.tags,
    category: meta.category,
    citations: meta.citations,
    relationships,
    extractedSkills: byKind.skill,
    extractedWorkflows: byKind.workflow,
    extractedPatterns: [...byKind.pattern, ...byKind['best-practice'], ...byKind['anti-pattern']],
    extractedSops: byKind.sop,
    extractedTemplates: byKind.template,
    extractedTechnologies: byKind.technology,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }
}

export interface ListKnowledgeItemsOptions {
  category?: KnowledgeCategory
  tag?: string
  /** Node statü filtresi (örn 'aday' — inceleme kuyruğu). */
  status?: string
  /** Kalite kararı filtresi (review bandını ayıklamak için). */
  qualityVerdict?: 'accept' | 'review'
  limit?: number
}

/** Knowledge item listesi — en yeniden eskiye. metadata containment filtresi
 *  (migration 0011 GIN indeksi) + isteğe bağlı daraltmalar. */
export async function listKnowledgeItems(opts: ListKnowledgeItemsOptions = {}): Promise<KnowledgeItem[]> {
  const { supabase } = await brainDeps()
  let query = supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('scope', 'agent')
    .in('type', [...ITEM_NODE_TYPES])
    .contains('metadata', { kind: 'knowledge-item' })
  if (opts.category) query = query.contains('metadata', { category: opts.category })
  if (opts.qualityVerdict) query = query.contains('metadata', { qualityVerdict: opts.qualityVerdict })
  if (opts.status) query = query.eq('status', opts.status)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT))
  if (error) throw error

  let nodes = (data ?? []).map((r) => mapNodeRow(r as Record<string, unknown>))
  if (opts.tag) {
    const tag = opts.tag.toLocaleLowerCase('tr')
    nodes = nodes.filter((n) => itemMetaOf(n)?.tags.includes(tag))
  }

  const items: KnowledgeItem[] = []
  for (const node of nodes) {
    const meta = itemMetaOf(node)
    if (meta) items.push(await buildItem(node, meta))
  }
  return items
}

/** Tek item'ın tam zarfı — knowledge item değilse null (yanlış id'ye zarf uydurulmaz). */
export async function getKnowledgeItem(nodeId: string): Promise<KnowledgeItem | null> {
  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('id', nodeId)
    .eq('scope', 'agent')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const node = mapNodeRow(data as Record<string, unknown>)
  const meta = itemMetaOf(node)
  return meta ? buildItem(node, meta) : null
}

export interface ListExtractionsOptions {
  kind?: ExtractionKind
  status?: string
  limit?: number
}

export interface KnowledgeExtraction extends KnowledgeExtractionRef {
  kind: ExtractionKind
  content: string | null
  sectionPath: string | null
  itemNodeId: string | null
  createdAt: string
}

/** Üretilen extraction envanteri — pipeline'dan doğan (metadata zarflı)
 *  skill/workflow/pattern/standard/template node'ları. */
export async function listExtractions(opts: ListExtractionsOptions = {}): Promise<KnowledgeExtraction[]> {
  const types = opts.kind
    ? [EXTRACTION_NODE_TYPE[opts.kind]]
    : [...new Set(Object.values(EXTRACTION_NODE_TYPE))]

  const { supabase } = await brainDeps()
  let query = supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('scope', 'agent')
    .in('type', types)
    // Tür filtresi node tipiyle yetmez (pattern tipini üç kutup paylaşır) —
    // extractionKind zarfa da uygulanır.
    .contains('metadata', opts.kind
      ? { kind: 'knowledge-extraction', extractionKind: opts.kind }
      : { kind: 'knowledge-extraction' })
  if (opts.status) query = query.eq('status', opts.status)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT))
  if (error) throw error

  return (data ?? []).flatMap((r) => {
    const node = mapNodeRow(r as Record<string, unknown>)
    const meta = extractionMetaOf(node)
    if (!meta) return []
    return [{
      ...toExtractionRef(node),
      kind: meta.extractionKind,
      content: node.content,
      sectionPath: meta.sectionPath ?? null,
      itemNodeId: meta.itemNodeId ?? null,
      createdAt: node.createdAt,
    }]
  })
}

// ── İnceleme kararları (Sprint 6: Review Queue sözleşmesi) ──────────────────

export type ReviewDecision = 'approve' | 'trust' | 'reject'

const DECISION_STATUS: Record<ReviewDecision, 'doğrulanmış' | 'güvenilir' | 'eskimiş'> = {
  approve: 'doğrulanmış',
  trust: 'güvenilir',
  reject: 'eskimiş',
}

export interface ReviewOptions {
  /** Kararı veren kimlik — insan ('bero') ya da ajan adı; verilmezse 'insan'. */
  reviewer?: string
  note?: string
}

/**
 * İnceleme kararını uygular:
 *  1. metadata.review kaydı (kim/ne/ne zaman — Review Queue'nun Reviewer
 *     alanı) node zarfına işlenir,
 *  2. statü geçişi (node-repository updateNodeStatus — doğrulama
 *     geçişlerinde confidence/last_verified_at oradan işlenir),
 *  3. olaylar: her incelemede knowledge_reviewed + karara göre
 *     knowledge_approved (approve/trust) ya da knowledge_rejected (reject).
 * Karar bilinçli İNSAN/AJAN adımıdır — pipeline asla kendi kendini onaylamaz.
 */
export async function reviewKnowledgeNode(
  nodeId: string,
  decision: ReviewDecision,
  opts: ReviewOptions = {},
): Promise<BrainNode> {
  const reviewer = opts.reviewer?.trim() || 'insan'

  // Önce zarf: statü geçişi başarısız olursa (node yok, geçersiz geçiş)
  // review kaydı da yazılmamış olmalı — sıralama updateNodeStatus'un node
  // varlığı doğrulamasına yaslanarak ters kurulamaz; bu yüzden node önce
  // okunur, zarf ve statü ondan sonra işlenir.
  const { supabase } = await brainDeps()
  const { data: row, error: readError } = await supabase
    .from('entities')
    .select('id, metadata')
    .eq('id', nodeId)
    .eq('scope', 'agent')
    .maybeSingle()
  if (readError) throw readError
  if (!row) throw new Error(`reviewKnowledgeNode: node bulunamadı (${nodeId}).`)

  const review = {
    reviewer,
    decision,
    ...(opts.note ? { note: opts.note } : {}),
    reviewedAt: new Date().toISOString(),
  }
  const { error: metaError } = await supabase
    .from('entities')
    .update({ metadata: { ...((row.metadata as Record<string, unknown> | null) ?? {}), review } })
    .eq('id', nodeId)
    .eq('scope', 'agent')
  if (metaError) throw metaError

  const node = await updateNodeStatus(nodeId, DECISION_STATUS[decision])

  const detail = {
    decision,
    reviewer,
    newStatus: node.status,
    title: node.title,
    ...(opts.note ? { note: opts.note } : {}),
  }
  await publishKnowledgeEvent({ name: 'KnowledgeReviewed', userId: node.userId, nodeId: node.id, detail })
  await publishKnowledgeEvent({
    name: decision === 'reject' ? 'KnowledgeRejected' : 'KnowledgeApproved',
    userId: node.userId,
    nodeId: node.id,
    detail,
  })
  return node
}
