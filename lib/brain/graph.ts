// Graph Engine (Sprint 4) — Brain'in graf yüzeyi: komşuluk, çok-adımlı
// traversal ve ilişkili-hafıza keşfi. link-registry'nin (Agent Brain'in 9
// tipiyle sınırlı, 1-hop) ÜSTÜNE değil YANINA kurulur: bu motor 12 kenar
// tipinin TAMAMINI görür (semantic/user/wikilink + 9 Agent tipi) ve iki
// Brain'de de çalışır — ama scope DAİMA açık parametredir ve traversal asla
// scope sınırını AŞMAZ: kenar öbür Brain'in node'una gitse bile o node
// döndürülmez, üzerinden de geçilmez (iki Brain karışmaz ilkesinin graf
// karşılığı).
//
// Relationship Engine = bu dosya: ilişki OKUMA yolları burada; ilişki YAZMA
// grafın mevcut kapılarındadır (linkNodes — Agent tipleri, createLink —
// personal tipleri, autoLinkNode — memory-engine otomatik bağları). İkinci
// bir yazma yolu bilinçli açılmadı.

import 'server-only'
import {
  brainDeps, getNodeEmbedding, getNodesByIds, matchSimilarNodes, NODE_COLUMNS, mapNodeRow,
} from './db'
import { rankItems } from './scoring'
import type { BrainNode, BrainScope } from './types'

/** Grafın tamamının kenar sözlüğü: personal üçlü + Agent Brain 9'lusu. */
export const ALL_EDGE_KINDS = [
  'semantic', 'user', 'wikilink',
  'derived_from', 'validated_by', 'composed_of', 'supersedes', 'contradicts',
  'applies_to', 'enables', 'resulted_in', 'related_to',
] as const
export type EdgeKind = (typeof ALL_EDGE_KINDS)[number]

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  kind: EdgeKind
  label: string | null
  strength: number | null
  createdAt: string
}

export interface GraphNeighbor {
  node: BrainNode
  edge: GraphEdge
  direction: 'outgoing' | 'incoming'
  /** Başlangıç node'undan kaç adım uzakta bulunduğu (traversal'da ≥1). */
  depth: number
}

const EDGE_COLUMNS = 'id, source_entity_id, target_entity_id, kind, label, strength, created_at'

function mapEdgeRow(row: Record<string, unknown>): GraphEdge {
  return {
    id: row.id as string,
    sourceId: row.source_entity_id as string,
    targetId: row.target_entity_id as string,
    kind: row.kind as EdgeKind,
    label: (row.label as string | null) ?? null,
    strength: (row.strength as number | null) ?? null,
    createdAt: row.created_at as string,
  }
}

/** Verilen node kümesinin TÜM kenarları (iki yönde) — tek sorgu. */
async function edgesOf(nodeIds: string[], kinds?: readonly EdgeKind[]): Promise<GraphEdge[]> {
  if (nodeIds.length === 0) return []
  const { supabase } = await brainDeps()
  const idList = `(${nodeIds.join(',')})`
  let query = supabase
    .from('links')
    .select(EDGE_COLUMNS)
    .or(`source_entity_id.in.${idList},target_entity_id.in.${idList}`)
  if (kinds && kinds.length > 0) query = query.in('kind', [...kinds])
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => mapEdgeRow(r as Record<string, unknown>))
}

export interface NeighborOptions {
  scope: BrainScope
  /** Kenar tipi filtresi — verilmezse 12 tipin tamamı. */
  kinds?: readonly EdgeKind[]
  direction?: 'outgoing' | 'incoming' | 'both'
  limit?: number
}

/** 1-hop komşuluk (Neighbour Search): node'un kenar komşuları, scope
 *  filtresiyle. Öbür Brain'e giden kenarların komşuları sonuçta YOKTUR. */
export async function getNeighbors(nodeId: string, opts: NeighborOptions): Promise<GraphNeighbor[]> {
  const direction = opts.direction ?? 'both'
  const edges = (await edgesOf([nodeId], opts.kinds)).filter((edge) => {
    if (direction === 'outgoing') return edge.sourceId === nodeId
    if (direction === 'incoming') return edge.targetId === nodeId
    return true
  })

  const neighborIds = [...new Set(
    edges.map((e) => (e.sourceId === nodeId ? e.targetId : e.sourceId)).filter((id) => id !== nodeId),
  )]
  const nodes = await getNodesByIds(neighborIds, opts.scope)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  const out: GraphNeighbor[] = []
  for (const edge of edges) {
    const dir = edge.sourceId === nodeId ? 'outgoing' as const : 'incoming' as const
    const node = nodeById.get(dir === 'outgoing' ? edge.targetId : edge.sourceId)
    if (node) out.push({ node, edge, direction: dir, depth: 1 })
  }
  return opts.limit !== undefined ? out.slice(0, opts.limit) : out
}

export interface TraverseOptions extends NeighborOptions {
  /** En fazla kaç adım genişlenir (varsayılan 2). */
  maxDepth?: number
  /** Sonuç node tavanı — kaçak genişleme guard'ı (varsayılan 50). */
  maxNodes?: number
}

/**
 * Çok-adımlı BFS traversal: başlangıç node'undan maxDepth adıma kadar
 * genişler; her komşu İLK bulunduğu (en kısa) derinlikle bir kez döner.
 * Scope dışı node'lar hem sonuçtan hem yürüyüşten dışlanır — öbür Brain
 * köprü olarak dahi kullanılamaz. Başlangıç node'u sonuçta yer almaz.
 */
export async function traverse(startId: string, opts: TraverseOptions): Promise<GraphNeighbor[]> {
  const maxDepth = Math.max(1, opts.maxDepth ?? 2)
  const maxNodes = Math.max(1, opts.maxNodes ?? 50)

  const visited = new Set<string>([startId])
  const result: GraphNeighbor[] = []
  let frontier = [startId]

  for (let depth = 1; depth <= maxDepth && frontier.length > 0 && result.length < maxNodes; depth++) {
    const edges = await edgesOf(frontier, opts.kinds)
    const frontierSet = new Set(frontier)

    /** Aday komşu → onu bulduran kenar+yön (aynı derinlikte ilk kenar kazanır). */
    const discovered = new Map<string, { edge: GraphEdge; direction: 'outgoing' | 'incoming' }>()
    for (const edge of edges) {
      for (const [from, to, dir] of [
        [edge.sourceId, edge.targetId, 'outgoing'],
        [edge.targetId, edge.sourceId, 'incoming'],
      ] as const) {
        if (!frontierSet.has(from) || visited.has(to) || discovered.has(to)) continue
        discovered.set(to, { edge, direction: dir })
      }
    }
    if (discovered.size === 0) break

    // Scope filtresi yürüyüşün parçasıdır: scope dışı adaylar visited'a
    // İŞLENMEZ ki başka yoldan da gelinmesin denemesi anlamsızlaşmasın —
    // zaten hiçbir derinlikte döndürülmez; frontier'a da girmedikleri için
    // üzerlerinden geçilmez.
    const nodes = await getNodesByIds([...discovered.keys()], opts.scope)
    const nextFrontier: string[] = []
    for (const node of nodes) {
      if (result.length >= maxNodes) break
      const found = discovered.get(node.id)
      if (!found) continue
      visited.add(node.id)
      result.push({ node, edge: found.edge, direction: found.direction, depth })
      nextFrontier.push(node.id)
    }
    frontier = nextFrontier
  }
  return result
}

export interface RelatedNodesOptions {
  scope: BrainScope
  limit?: number
  /** Semantik adayların benzerlik tabanı (varsayılan 0.4 — gürültü kesici). */
  minSimilarity?: number
}

export interface RelatedNode {
  node: BrainNode
  /** Nereden geldi: graf kenarı mı, semantik benzerlik mi (ikisi de olabilir). */
  via: ('graph' | 'semantic')[]
  similarity?: number
  edge?: GraphEdge
}

/**
 * İlişkili hafıza (Related Memory): graf komşuları + semantik benzerler tek
 * listede. İki kanaldan da gelen node en güçlü sinyaldir (via ikisini de
 * taşır). Sıralama scoring engine'in harman kuralıyla yapılır (benzerlik +
 * decay'li importance); eskimiş node'lar decay üzerinden doğal geriye düşer.
 */
export async function relatedNodes(nodeId: string, opts: RelatedNodesOptions): Promise<RelatedNode[]> {
  const limit = opts.limit ?? 10
  const minSimilarity = opts.minSimilarity ?? 0.4

  const [neighbors, embedding] = await Promise.all([
    getNeighbors(nodeId, { scope: opts.scope }),
    getNodeEmbedding(nodeId),
  ])

  const byId = new Map<string, RelatedNode>()
  for (const neighbor of neighbors) {
    byId.set(neighbor.node.id, { node: neighbor.node, via: ['graph'], edge: neighbor.edge })
  }

  if (embedding) {
    const { supabase } = await brainDeps()
    // Kendisi de sonuç kümesine düşer (benzerlik ~1) — +2 pay bırakılır.
    const owner = await supabase.from('entities').select('user_id').eq('id', nodeId).single()
    if (owner.error) throw owner.error
    const similar = await matchSimilarNodes(owner.data.user_id as string, embedding, {
      scope: opts.scope,
      limit: limit + 2,
    })
    const similarIds = similar
      .filter((s) => s.id !== nodeId && s.similarity >= minSimilarity)
      .map((s) => s.id)
    const nodes = await getNodesByIds(similarIds, opts.scope)
    const simById = new Map(similar.map((s) => [s.id, s.similarity]))
    for (const node of nodes) {
      const existing = byId.get(node.id)
      if (existing) {
        existing.via.push('semantic')
        existing.similarity = simById.get(node.id)
      } else {
        byId.set(node.id, { node, via: ['semantic'], similarity: simById.get(node.id) })
      }
    }
  }

  const ranked = rankItems(
    [...byId.values()].map((related) => ({
      ...related,
      type: related.node.type,
      status: related.node.status,
      freshnessAnchor: related.node.updatedAt,
      confidenceCount: related.node.confidenceCount,
      linkDegree: related.via.includes('graph') ? 1 : 0,
      similarity: related.similarity,
    })),
  )
  return ranked.slice(0, limit).map(({ node, via, similarity, edge }) => ({ node, via, similarity, edge }))
}

/** Tek node okuma — scope'lu (node-repository.getNode'un iki-Brain hali). */
export async function getScopedNode(id: string, scope: BrainScope): Promise<BrainNode | null> {
  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('id', id)
    .eq('scope', scope)
    .maybeSingle()
  if (error) throw error
  return data ? mapNodeRow(data as Record<string, unknown>) : null
}
