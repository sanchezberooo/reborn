// Hibrit retrieval (Faz 1) — roadmap: "Semantik arama + link grafı + recency
// ağırlığı". Skor üç bileşenin toplamıdır:
//   score = similarity + recencyBoost + graphBoost
//   * similarity  : sorgu embedding'i ile entity embedding'inin kosinüs
//                   benzerliği. DB'de hesaplanır: match_entities RPC'si
//                   (migration 0006) HNSW indeksiyle 1 - cosine_distance
//                   döndürür; bge-m3 vektörleri L2-normalize olduğundan bu,
//                   eski süreç-içi dot product ile aynı ölçektir.
//   * recencyBoost: küçük bir tazelik katkısı — RECENCY_WEIGHT * exp(-yaş/30gün).
//                   Amaç eşit benzerlikte yeniyi öne almak, alakasız-ama-yeniyi
//                   öne çekmek değil; o yüzden ağırlık bilinçli küçük.
//   * graphBoost  : en güçlü ilk GRAPH_EXPAND_TOP sonucun 1-hop komşuları,
//                   kaynağın benzerliğiyle orantılı bir katkı alır — journal
//                   bulununca bağlı goal da birlikte gelir (roadmap Faz 1
//                   başarı kriteri).
//
// MİMARİ (CTO raporu ölçeklenebilirlik düzeltmesi): Benzerlik sıralaması
// artık DB'dedir. Eski tasarım tüm embedding'leri belleğe çekip (.limit(1000))
// JS'te dot product yapıyordu — 1000 entity üstünde limit sonrası satırlar hiç
// skorlanmadan sessizce kayboluyordu. match_entities RPC'si HNSW indeksini
// kullanır ve sonuç kümesinde satır tavanı yoktur. Recency ve graf genişletme
// skorlaması uygulama katmanında kalır: RPC'den bilinçli fazla aday çekilir
// (over-fetch), skorlar adaylar üzerinde hesaplanır. Over-fetch payı,
// recency'nin (maks +0.08) benzerlik sırasını yalnız yakın komşuluk içinde
// oynatabilmesinden yeterlidir; graf komşuları aday kümesinde değilse ayrıca
// çekilip skora katılır — eski "tüm entity'ler bellekte" davranışıyla aynı
// gözlemlenen sonucu verir. Süreç-içi snapshot/cache YOKTUR: her sorgu DB'ye
// gider, çok-instance senaryosunda her instance aynı gerçeği görür.

import 'server-only'
import { getSupabaseAdmin } from '../supabase-admin'
import { getLocalEmbeddingProvider } from './local-embedding'
import type { EntityType } from '../db-server'

const RECENCY_WEIGHT = 0.08
const RECENCY_DECAY_DAYS = 30
const GRAPH_BOOST_WEIGHT = 0.15
const GRAPH_EXPAND_TOP = 5
/** Bu benzerliğin altındaki sonuçlar komşularına boost yayamaz (gürültü kesici). */
const GRAPH_MIN_SIMILARITY = 0.35
/** user/wikilink kenarları elle kurulmuştur — semantik strength'ten güçlü sayılır. */
const CURATED_LINK_WEIGHT = 0.9
const DEFAULT_SEMANTIC_STRENGTH = 0.5
/** limit'in kaç katı aday çekilir (recency/graf yeniden sıralaması için pay). */
const RPC_OVERFETCH_FACTOR = 3
const RPC_OVERFETCH_MIN = 30

export interface RetrievedEntity {
  id: string
  type: EntityType
  title: string
  content: string | null
  createdAt: string
  /** Sorguyla kosinüs benzerliği. */
  similarity: number
  recencyBoost: number
  /** 0'dan büyükse entity link grafı üzerinden güçlendirilmiş demektir. */
  graphBoost: number
  /** graphBoost > 0 ise boost'u yayan komşu entity'nin id'si (şeffaflık). */
  boostedBy?: string
  /** Sıralama skoru = similarity + recencyBoost + graphBoost. */
  score: number
}

export interface RetrieveOptions {
  userId: string
  /** Döndürülecek sonuç sayısı (varsayılan 10). */
  limit?: number
  /** Link grafı genişletmesi (varsayılan true) — testte izole ölçüm için kapatılabilir. */
  graph?: boolean
  /** Verilirse yalnız o scope'un entity'leri aday olur (RPC'de filtrelenir);
   *  verilmezse tüm scope'lar — mevcut çağıranlar için davranış değişmez.
   *  Agent Brain sarmalayıcısı (lib/brain/query.ts) bu kanalı kullanır. */
  scope?: 'personal' | 'agent'
}

/** match_entities RPC'sinin satır şekli (migration 0006 RETURNS TABLE). */
interface MatchRow {
  id: string
  type: string
  title: string
  content: string | null
  created_at: string
  scope: string
  similarity: number
}

interface Scored {
  id: string
  type: EntityType
  title: string
  content: string | null
  createdAt: string
  similarity: number
  recencyBoost: number
  graphBoost: number
  boostedBy?: string
}

/** PostgREST vector kolonunu "[0.1,0.2,...]" string'i olarak döndürür. */
function parseEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) return value as number[]
  if (typeof value === 'string') return JSON.parse(value) as number[]
  throw new Error('retrieval: embedding kolonu beklenmeyen formatta.')
}

/** Vektörler L2-normalize (bge-m3 + normalize:true) → dot product = cosine. */
function dot(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

function recencyBoostOf(createdAt: string, nowMs: number): number {
  const ageDays = Math.max(0, (nowMs - new Date(createdAt).getTime()) / 86_400_000)
  return RECENCY_WEIGHT * Math.exp(-ageDays / RECENCY_DECAY_DAYS)
}

function edgeWeight(kind: string, strength: number | null): number {
  return kind === 'semantic' ? (strength ?? DEFAULT_SEMANTIC_STRENGTH) : CURATED_LINK_WEIGHT
}

export async function hybridRetrieve(
  query: string,
  opts: RetrieveOptions,
): Promise<RetrievedEntity[]> {
  const limit = opts.limit ?? 10
  const [queryVec] = await getLocalEmbeddingProvider().embed([query])
  const supabase = getSupabaseAdmin()
  const now = Date.now()

  const overfetch = Math.max(limit * RPC_OVERFETCH_FACTOR, RPC_OVERFETCH_MIN)
  const { data: rows, error } = await supabase.rpc('match_entities', {
    p_user_id: opts.userId,
    p_query_embedding: queryVec,
    p_match_limit: overfetch,
    p_scope: opts.scope ?? null,
  })
  if (error) throw error

  const scored: Scored[] = ((rows ?? []) as MatchRow[]).map((row) => ({
    id: row.id,
    type: row.type as EntityType,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    similarity: row.similarity,
    recencyBoost: recencyBoostOf(row.created_at, now),
    graphBoost: 0,
    boostedBy: undefined,
  }))

  if (opts.graph !== false && scored.length > 0) {
    await applyGraphBoost(scored, queryVec, opts, now)
  }

  return scored
    .map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      content: s.content,
      createdAt: s.createdAt,
      similarity: s.similarity,
      recencyBoost: s.recencyBoost,
      graphBoost: s.graphBoost,
      boostedBy: s.boostedBy,
      score: s.similarity + s.recencyBoost + s.graphBoost,
    }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}

/**
 * 1-hop graf genişletmesi: en güçlü ilk GRAPH_EXPAND_TOP adayın kenarları
 * çekilir, komşulara kaynağın benzerliğiyle orantılı boost yayılır (aynı
 * komşuya birden çok kaynak boost yayarsa en büyüğü kazanır — eski davranış).
 * Aday kümesinde OLMAYAN komşular DB'den ayrıca alınır ve gerçek
 * benzerlikleriyle skora katılır: eski full-scan'de tüm entity'ler bellekte
 * olduğundan her komşu boost alabiliyordu; RPC yalnız top-K getirdiği için
 * bu ek çekim davranış eşitliğini korur. `scored` yerinde genişletilir.
 */
async function applyGraphBoost(
  scored: Scored[],
  queryVec: number[],
  opts: RetrieveOptions,
  now: number,
): Promise<void> {
  const supabase = getSupabaseAdmin()

  // RPC benzerliğe göre sıralı döndürür; ilk GRAPH_EXPAND_TOP aday yayıcıdır.
  const spreaders = scored
    .slice(0, GRAPH_EXPAND_TOP)
    .filter((s) => s.similarity >= GRAPH_MIN_SIMILARITY)
  if (spreaders.length === 0) return

  const spreaderIds = spreaders.map((s) => s.id)
  const idList = `(${spreaderIds.join(',')})`
  const { data: linkRows, error: linkError } = await supabase
    .from('links')
    .select('source_entity_id, target_entity_id, kind, strength')
    .or(`source_entity_id.in.${idList},target_entity_id.in.${idList}`)
  if (linkError) throw linkError
  if (!linkRows || linkRows.length === 0) return

  const byId = new Map(scored.map((s) => [s.id, s]))
  const spreaderById = new Map(spreaders.map((s) => [s.id, s]))
  /** Aday kümesi dışındaki komşular: id → en güçlü boost ve kaynağı. */
  const outside = new Map<string, { boost: number; boostedBy: string }>()

  for (const row of linkRows) {
    const a = row.source_entity_id as string
    const b = row.target_entity_id as string
    const weight = edgeWeight(row.kind as string, row.strength as number | null)
    // Kenarlar yönsüz yayılır (eski adjacency iki yönde kayıtlıydı): kenarın
    // hangi ucu yayıcıysa boost öbür uca akar; iki uç da yayıcıysa iki yönde.
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const spreader = spreaderById.get(from)
      if (!spreader || to === from) continue
      const boost = GRAPH_BOOST_WEIGHT * spreader.similarity * weight
      const neighbor = byId.get(to)
      if (neighbor) {
        if (boost > neighbor.graphBoost) {
          neighbor.graphBoost = boost
          neighbor.boostedBy = spreader.id
        }
      } else {
        const prev = outside.get(to)
        if (!prev || boost > prev.boost) outside.set(to, { boost, boostedBy: spreader.id })
      }
    }
  }

  if (outside.size === 0) return

  // Küme dışı komşuların gerçek benzerliği için embedding'leri çekilir —
  // yayıcı başına birkaç kenar mertebesinde satır; sorgu şekli hafiftir.
  let neighborQuery = supabase
    .from('entities')
    .select('id, type, title, content, created_at, embedding')
    .in('id', [...outside.keys()])
    .eq('user_id', opts.userId)
    .not('embedding', 'is', null)
  if (opts.scope) neighborQuery = neighborQuery.eq('scope', opts.scope)
  const { data: neighborRows, error: neighborError } = await neighborQuery
  if (neighborError) throw neighborError

  for (const row of neighborRows ?? []) {
    const info = outside.get(row.id as string)
    if (!info) continue
    scored.push({
      id: row.id as string,
      type: row.type as EntityType,
      title: row.title as string,
      content: (row.content as string | null) ?? null,
      createdAt: row.created_at as string,
      similarity: dot(queryVec, parseEmbedding(row.embedding)),
      recencyBoost: recencyBoostOf(row.created_at as string, now),
      graphBoost: info.boost,
      boostedBy: info.boostedBy,
    })
  }
}

// ─── Global semantik arama (Faz 3) — hybridRetrieve'in UI'a bağlanan salt-
// okunur ucu. Ayrı fonksiyon olmasının nedeni: arama sonucu kartı tam içerik
// değil kısa bir özet ister; skor bileşenlerini (similarity/recencyBoost/
// graphBoost) değil yalnız sıralama sonucu + kısa metni döner.

const SEARCH_SNIPPET_LENGTH = 160
const SEARCH_DEFAULT_LIMIT = 10

export interface SearchResult {
  id: string
  type: EntityType
  title: string
  /** content'ten türetilmiş kısa özet; içerik yoksa null. */
  snippet: string | null
  score: number
}

function toSnippet(content: string | null): string | null {
  if (!content) return null
  const flat = content.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  return flat.length > SEARCH_SNIPPET_LENGTH ? `${flat.slice(0, SEARCH_SNIPPET_LENGTH)}…` : flat
}

/** Boş sorguda embed çağrısı yapmadan erken döner (gereksiz iş yapmama). */
export async function searchEntities(
  query: string,
  opts: RetrieveOptions,
): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const limit = opts.limit ?? SEARCH_DEFAULT_LIMIT
  const results = await hybridRetrieve(trimmed, { ...opts, limit })

  return results.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    snippet: toSnippet(r.content),
    score: r.score,
  }))
}
