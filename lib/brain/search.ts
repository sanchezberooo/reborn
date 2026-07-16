// Search Engine (Sprint 4) — Brain'in tek arama yüzeyi: üç mod, tek sözleşme.
//   * semantic — saf anlamsal benzerlik (HNSW RPC) + scoring engine reranki
//                (statü/decay: eskimiş bilgi geriye düşer ama kaybolmaz).
//   * graph    — anlamsal TOHUMLARDAN graf traversal'ı: sonuç kümesi kenar
//                komşuluğundan gelir; skor tohum benzerliği × kenar ağırlığı
//                × derinlik sönümü ("bununla İLİŞKİLİ ne biliyorum" sorusu).
//   * hybrid   — mevcut hibrit retrieval (lib/ai/retrieval.ts: semantik +
//                recency + 1-hop graf boost) + statü reranki. Chat bağlamının
//                kullandığı yolun arama yüzü — İKİNCİ bir hibrit formül
//                yazılmadı, aynı motor sarıldı.
// Scope her çağrıda açık parametredir; embedding altyapısı gerçektir (bge-m3
// lokal) — "embedding'siz mimari hazırlığı" gereksizdi, gerçeği zaten var.

import 'server-only'
import { hybridRetrieve } from '../ai/retrieval'
import { brainDeps, getNodesByIds, matchSimilarNodes } from './db'
import { traverse } from './graph'
import { rankScore, STATUS_WEIGHT } from './scoring'
import type { BrainNode, BrainScope, NodeStatus, NodeType } from './types'

export type BrainSearchMode = 'semantic' | 'graph' | 'hybrid'

export interface BrainSearchOptions {
  userId: string
  scope: BrainScope
  mode?: BrainSearchMode
  limit?: number
}

export interface BrainSearchResult {
  id: string
  type: NodeType
  title: string
  snippet: string | null
  status: NodeStatus
  /** Sorguya anlamsal benzerlik (graph modunda tohumdan devralınan taban). */
  similarity: number
  /** Nihai sıralama skoru (mod formülü — üst not). */
  score: number
  mode: BrainSearchMode
}

const SNIPPET_LENGTH = 200
/** semantic mod: rerank payı için çekilen aday çarpanı. */
const SEMANTIC_OVERFETCH = 3
/** graph modu tohum sayısı ve derinliği. */
const GRAPH_SEED_COUNT = 4
const GRAPH_SEED_MIN_SIMILARITY = 0.35
const GRAPH_MAX_DEPTH = 2
/** Derinlik sönümü: 2. adım komşusu 1. adımın yarısı kadar katkı alır. */
const GRAPH_DEPTH_DAMPING = 0.5
/** Elle kurulmuş kenar semantik kenardan güçlü (retrieval.ts ile aynı ilke). */
const CURATED_EDGE_WEIGHT = 0.9
const DEFAULT_SEMANTIC_EDGE_STRENGTH = 0.5

function toSnippet(content: string | null): string | null {
  if (!content) return null
  const flat = content.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  return flat.length > SNIPPET_LENGTH ? `${flat.slice(0, SNIPPET_LENGTH)}…` : flat
}

function toResult(node: BrainNode, similarity: number, score: number, mode: BrainSearchMode): BrainSearchResult {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    snippet: toSnippet(node.content),
    status: node.status,
    similarity,
    score,
    mode,
  }
}

/** Node + benzerlikten scoring engine harman skoru (statü/decay dahil). */
function blendedScore(node: BrainNode, similarity: number, nowMs: number): number {
  return rankScore({
    type: node.type,
    status: node.status,
    freshnessAnchor: node.scope === 'agent' ? node.lastVerifiedAt : node.updatedAt,
    confidenceCount: node.confidenceCount,
    similarity,
  }, nowMs)
}

async function searchSemantic(query: string, opts: Required<Pick<BrainSearchOptions, 'userId' | 'scope' | 'limit'>>): Promise<BrainSearchResult[]> {
  const { embedder } = await brainDeps()
  const [embedding] = await embedder.embed([query])
  const rows = await matchSimilarNodes(opts.userId, embedding, {
    scope: opts.scope,
    limit: Math.max(opts.limit * SEMANTIC_OVERFETCH, 15),
  })
  const nodes = await getNodesByIds(rows.map((r) => r.id), opts.scope)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const now = Date.now()

  return rows
    .flatMap((row) => {
      const node = nodeById.get(row.id)
      if (!node) return []
      return [toResult(node, row.similarity, blendedScore(node, row.similarity, now), 'semantic')]
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit)
}

async function searchGraph(query: string, opts: Required<Pick<BrainSearchOptions, 'userId' | 'scope' | 'limit'>>): Promise<BrainSearchResult[]> {
  const { embedder } = await brainDeps()
  const [embedding] = await embedder.embed([query])
  const seeds = (await matchSimilarNodes(opts.userId, embedding, {
    scope: opts.scope,
    limit: GRAPH_SEED_COUNT,
  })).filter((s) => s.similarity >= GRAPH_SEED_MIN_SIMILARITY)
  if (seeds.length === 0) return []

  const seedIds = new Set(seeds.map((s) => s.id))
  /** Komşu → en güçlü katkı (birden çok tohumdan gelirse en büyüğü kazanır). */
  const best = new Map<string, { node: BrainNode; contribution: number; seedSimilarity: number }>()

  for (const seed of seeds) {
    const neighbors = await traverse(seed.id, {
      scope: opts.scope,
      maxDepth: GRAPH_MAX_DEPTH,
      maxNodes: opts.limit * 3,
    })
    for (const neighbor of neighbors) {
      if (seedIds.has(neighbor.node.id)) continue // tohumlar semantic modun işi
      const edgeWeight = neighbor.edge.kind === 'semantic'
        ? (neighbor.edge.strength ?? DEFAULT_SEMANTIC_EDGE_STRENGTH)
        : CURATED_EDGE_WEIGHT
      const contribution = seed.similarity * edgeWeight * GRAPH_DEPTH_DAMPING ** (neighbor.depth - 1)
      const existing = best.get(neighbor.node.id)
      if (!existing || contribution > existing.contribution) {
        best.set(neighbor.node.id, { node: neighbor.node, contribution, seedSimilarity: seed.similarity })
      }
    }
  }

  const now = Date.now()
  return [...best.values()]
    .map(({ node, contribution }) =>
      toResult(node, contribution, blendedScore(node, contribution, now), 'graph'))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit)
}

async function searchHybrid(query: string, opts: Required<Pick<BrainSearchOptions, 'userId' | 'scope' | 'limit'>>): Promise<BrainSearchResult[]> {
  const retrieved = await hybridRetrieve(query, {
    userId: opts.userId,
    scope: opts.scope,
    limit: opts.limit * 2, // statü reranki için pay
  })
  const nodes = await getNodesByIds(retrieved.map((r) => r.id), opts.scope)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  return retrieved
    .flatMap((r) => {
      const node = nodeById.get(r.id)
      if (!node) return []
      // Hibrit skor (similarity+recency+graphBoost) esas; statü ağırlığı
      // çarpan olarak biner — eskimiş node hibritte yüksek çıksa da geriye
      // düşer (recency hibritte zaten var; decay burada tekrarlanmaz).
      const score = r.score * STATUS_WEIGHT[node.status]
      return [toResult(node, r.similarity, score, 'hybrid')]
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit)
}

/** Brain Search — tek kapı. Boş sorgu boş sonuç (embed çağrısı yapılmaz). */
export async function searchBrain(query: string, opts: BrainSearchOptions): Promise<BrainSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const resolved = { userId: opts.userId, scope: opts.scope, limit: opts.limit ?? 10 }

  switch (opts.mode ?? 'hybrid') {
    case 'semantic': return searchSemantic(trimmed, resolved)
    case 'graph': return searchGraph(trimmed, resolved)
    case 'hybrid': return searchHybrid(trimmed, resolved)
  }
}
