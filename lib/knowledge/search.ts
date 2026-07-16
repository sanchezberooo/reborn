// Knowledge Search (Sprint 5) — departmanın arama yüzeyi. İKİNCİ BİR ARAMA
// MOTORU DEĞİLDİR: Sprint 4 Brain Search'ün (lib/brain/search.ts — semantic|
// graph|hybrid tek yüzey) scope='agent' + knowledge tip filtresiyle sarılmış
// halidir; skor/decay/statü matematiği oradan gelir. 'server-only'.

import 'server-only'
import { brainDeps, mapNodeRow, NODE_COLUMNS } from '../brain/db'
import { searchBrain } from '../brain/search'
import type { BrainSearchMode } from '../brain/search'
import { resolveSingleUserId } from '../db-server'
import type { KnowledgeCategory } from './types'
import { EXTRACTION_NODE_TYPE } from './types'

/** Arama hedefi: item (fact/repository) ve/veya extraction türleri.
 *  best-practice/anti-pattern ayrı arama türü DEĞİLDİR — node tipleri
 *  pattern'dir, 'pattern' türü üçünü birden bulur (ayrım metadata'da). */
export type KnowledgeSearchKind = 'item' | 'skill' | 'workflow' | 'pattern' | 'sop' | 'template' | 'technology'

const KIND_NODE_TYPES: Record<KnowledgeSearchKind, string[]> = {
  item: ['fact', 'repository'],
  skill: [EXTRACTION_NODE_TYPE.skill],
  workflow: [EXTRACTION_NODE_TYPE.workflow],
  pattern: [EXTRACTION_NODE_TYPE.pattern],
  sop: [EXTRACTION_NODE_TYPE.sop],
  template: [EXTRACTION_NODE_TYPE.template],
  technology: [EXTRACTION_NODE_TYPE.technology],
}

export const KNOWLEDGE_SEARCH_KINDS = Object.keys(KIND_NODE_TYPES) as KnowledgeSearchKind[]

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 25
/** Tip filtresi sonuç kırptığı için Brain Search'ten pay bırakılarak çekilir. */
const OVERFETCH_FACTOR = 3

export interface KnowledgeSearchOptions {
  kinds?: KnowledgeSearchKind[]
  mode?: BrainSearchMode
  limit?: number
  /** Test izolasyonu; verilmezse tek profil. */
  userId?: string
}

export interface KnowledgeSearchResult {
  nodeId: string
  kind: KnowledgeSearchKind
  nodeType: string
  title: string
  snippet: string | null
  status: string
  score: number
  similarity: number
  mode: BrainSearchMode
  /** Zarftan gelen hızlı bağlam (varsa) — tam zarf için registry.getKnowledgeItem. */
  category: KnowledgeCategory | null
  trustScore: number | null
  tags: string[]
}

function kindOfNodeType(nodeType: string, wanted: KnowledgeSearchKind[]): KnowledgeSearchKind | null {
  for (const kind of wanted) {
    if (KIND_NODE_TYPES[kind].includes(nodeType)) return kind
  }
  return null
}

/**
 * Knowledge Search — tek kapı. Brain Search sonuçları knowledge tiplerine
 * süzülür ve metadata zarfından kategori/trust/tags iliştirilir (tek toplu
 * sorgu — N+1 yok). Boş sorgu boş sonuç (searchBrain sözleşmesi).
 */
export async function searchKnowledge(
  query: string,
  opts: KnowledgeSearchOptions = {},
): Promise<KnowledgeSearchResult[]> {
  const kinds = opts.kinds?.length ? opts.kinds : KNOWLEDGE_SEARCH_KINDS
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const userId = opts.userId ?? (await resolveSingleUserId())

  const raw = await searchBrain(query, {
    userId,
    scope: 'agent',
    mode: opts.mode ?? 'hybrid',
    limit: limit * OVERFETCH_FACTOR,
  })

  const matched = raw.flatMap((r) => {
    const kind = kindOfNodeType(r.type, kinds)
    return kind ? [{ result: r, kind }] : []
  }).slice(0, limit)
  if (matched.length === 0) return []

  // Zarf iliştirme: tek sorguda hepsinin metadata'sı.
  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .in('id', matched.map((m) => m.result.id))
  if (error) throw error
  const metaById = new Map(
    (data ?? []).map((row) => {
      const node = mapNodeRow(row as Record<string, unknown>)
      return [node.id, node.metadata ?? null] as const
    }),
  )

  return matched.map(({ result, kind }) => {
    const meta = metaById.get(result.id) ?? null
    const itemMeta = meta && meta.kind === 'knowledge-item' ? meta : null
    return {
      nodeId: result.id,
      kind,
      nodeType: result.type,
      title: result.title,
      snippet: result.snippet,
      status: result.status,
      score: result.score,
      similarity: result.similarity,
      mode: result.mode,
      category: itemMeta ? (itemMeta.category as KnowledgeCategory) : null,
      trustScore: itemMeta && typeof itemMeta.trustScore === 'number' ? itemMeta.trustScore : null,
      tags: itemMeta && Array.isArray(itemMeta.tags) ? (itemMeta.tags as string[]) : [],
    }
  })
}
