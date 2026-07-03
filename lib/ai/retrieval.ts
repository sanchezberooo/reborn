// Hibrit retrieval (Faz 1) — roadmap: "Semantik arama + link grafı + recency
// ağırlığı". Skor üç bileşenin toplamıdır:
//   score = similarity + recencyBoost + graphBoost
//   * similarity  : sorgu embedding'i ile entity embedding'inin kosinüs
//                   benzerliği (bge-m3 vektörleri L2-normalize → dot product).
//   * recencyBoost: küçük bir tazelik katkısı — RECENCY_WEIGHT * exp(-yaş/30gün).
//                   Amaç eşit benzerlikte yeniyi öne almak, alakasız-ama-yeniyi
//                   öne çekmek değil; o yüzden ağırlık bilinçli küçük.
//   * graphBoost  : en güçlü ilk GRAPH_EXPAND_TOP sonucun 1-hop komşuları,
//                   kaynağın benzerliğiyle orantılı bir katkı alır — journal
//                   bulununca bağlı goal da birlikte gelir (roadmap Faz 1
//                   başarı kriteri).
//
// UYGULAMA NOTU: Benzerlik hesabı DB'de değil süreç içinde yapılır. pgvector
// HNSW indeksini kullanan bir `match_entities` RPC fonksiyonu daha doğru
// tasarım olurdu; ama SQL fonksiyonu yeni migration demek ve bu görevde şema
// değişikliği kapsam dışı. Tek kullanıcı + yüzler mertebesinde entity için
// snapshot (aşağıda) + JS dot product <500ms bütçesinin rahat içinde kalır;
// veri büyüdüğünde RPC migration'ı Faz 1 devamında eklenir.
//
// SNAPSHOT: entities (embedding'li) + links tek seferde çekilir ve süreç
// içinde tutulur. Bayatlama iki yoldan tetiklenir: yazma yolu (lib/db.ts
// createEntity/createLink/deleteEntity) retrieval-cache sayacını artırır;
// ayrıca TTL süreç dışı yazmalara karşı emniyettir. Silinen entity bu sayede
// bir daha retrieval'a çıkmaz (Faz 1 başarı kriteri).

import { getSupabaseAdmin } from '../supabase-admin'
import { getLocalEmbeddingProvider } from './local-embedding'
import { retrievalCacheVersion } from './retrieval-cache'
import type { EntityType } from '../db'

const SNAPSHOT_TTL_MS = 60_000
const RECENCY_WEIGHT = 0.08
const RECENCY_DECAY_DAYS = 30
const GRAPH_BOOST_WEIGHT = 0.15
const GRAPH_EXPAND_TOP = 5
/** Bu benzerliğin altındaki sonuçlar komşularına boost yayamaz (gürültü kesici). */
const GRAPH_MIN_SIMILARITY = 0.35
/** user/wikilink kenarları elle kurulmuştur — semantik strength'ten güçlü sayılır. */
const CURATED_LINK_WEIGHT = 0.9
const DEFAULT_SEMANTIC_STRENGTH = 0.5

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
}

interface Candidate {
  id: string
  type: EntityType
  title: string
  content: string | null
  createdAt: string
  createdAtMs: number
  embedding: number[]
}

interface LinkEdge {
  a: string
  b: string
  weight: number
}

interface Snapshot {
  userId: string
  version: number
  loadedAt: number
  candidates: Candidate[]
  /** entity id → bağlı kenarlar (yönsüz erişim için iki yönde de kayıtlı). */
  adjacency: Map<string, LinkEdge[]>
}

let snapshot: Snapshot | null = null

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

async function loadSnapshot(userId: string): Promise<Snapshot> {
  const now = Date.now()
  const version = retrievalCacheVersion()
  if (
    snapshot &&
    snapshot.userId === userId &&
    snapshot.version === version &&
    now - snapshot.loadedAt < SNAPSHOT_TTL_MS
  ) {
    return snapshot
  }

  const supabase = getSupabaseAdmin()
  const { data: entityRows, error: entityError } = await supabase
    .from('entities')
    .select('id, type, title, content, created_at, embedding')
    .eq('user_id', userId)
    .not('embedding', 'is', null)
    // PostgREST varsayılan sayfa sınırı 1000; Faz 1 veri hacmi (yüzler) için
    // yeterli. Sınıra yaklaşınca zaten RPC migration'ına geçilmiş olmalı.
    .limit(1000)
  if (entityError) throw entityError

  const candidates: Candidate[] = (entityRows ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as EntityType,
    title: row.title as string,
    content: (row.content as string | null) ?? null,
    createdAt: row.created_at as string,
    createdAtMs: new Date(row.created_at as string).getTime(),
    embedding: parseEmbedding(row.embedding),
  }))
  const ids = new Set(candidates.map((c) => c.id))

  // links tablosunda user_id yok; kenar iki ucundan bu kullanıcının entity
  // setine bağlanarak filtrelenir (tek kullanıcılı Faz 1'de tümü zaten onun).
  const { data: linkRows, error: linkError } = await supabase
    .from('links')
    .select('source_entity_id, target_entity_id, kind, strength')
    .limit(5000)
  if (linkError) throw linkError

  const adjacency = new Map<string, LinkEdge[]>()
  for (const row of linkRows ?? []) {
    const a = row.source_entity_id as string
    const b = row.target_entity_id as string
    if (!ids.has(a) || !ids.has(b)) continue
    const weight =
      row.kind === 'semantic'
        ? ((row.strength as number | null) ?? DEFAULT_SEMANTIC_STRENGTH)
        : CURATED_LINK_WEIGHT
    const edge: LinkEdge = { a, b, weight }
    // Semantik kenarlar kavramsal olarak yönsüz (migration notu); user/wikilink
    // kenarlarında da retrieval iki yönde yayılmalı — journal→goal kenarı goal
    // sorgusunda journal'ı da getirmeli.
    if (!adjacency.has(a)) adjacency.set(a, [])
    if (!adjacency.has(b)) adjacency.set(b, [])
    adjacency.get(a)!.push(edge)
    adjacency.get(b)!.push(edge)
  }

  snapshot = { userId, version, loadedAt: now, candidates, adjacency }
  return snapshot
}

/** Test/araç kullanımı için: snapshot'ı elle düşür (yazma yolları bunu db.ts üzerinden zaten yapar). */
export { invalidateRetrievalCache } from './retrieval-cache'

export async function hybridRetrieve(
  query: string,
  opts: RetrieveOptions,
): Promise<RetrievedEntity[]> {
  const limit = opts.limit ?? 10
  const [queryVec] = await getLocalEmbeddingProvider().embed([query])
  const snap = await loadSnapshot(opts.userId)
  const now = Date.now()

  const scored = snap.candidates.map((c) => {
    const similarity = dot(queryVec, c.embedding)
    const ageDays = Math.max(0, (now - c.createdAtMs) / 86_400_000)
    const recencyBoost = RECENCY_WEIGHT * Math.exp(-ageDays / RECENCY_DECAY_DAYS)
    return { c, similarity, recencyBoost, graphBoost: 0, boostedBy: undefined as string | undefined }
  })
  scored.sort((x, y) => y.similarity - x.similarity)

  if (opts.graph !== false) {
    const byId = new Map(scored.map((s) => [s.c.id, s]))
    for (const hit of scored.slice(0, GRAPH_EXPAND_TOP)) {
      if (hit.similarity < GRAPH_MIN_SIMILARITY) break
      for (const edge of snap.adjacency.get(hit.c.id) ?? []) {
        const otherId = edge.a === hit.c.id ? edge.b : edge.a
        if (otherId === hit.c.id) continue
        const neighbor = byId.get(otherId)
        if (!neighbor) continue
        const boost = GRAPH_BOOST_WEIGHT * hit.similarity * edge.weight
        if (boost > neighbor.graphBoost) {
          neighbor.graphBoost = boost
          neighbor.boostedBy = hit.c.id
        }
      }
    }
  }

  return scored
    .map((s) => ({
      id: s.c.id,
      type: s.c.type,
      title: s.c.title,
      content: s.c.content,
      createdAt: s.c.createdAt,
      similarity: s.similarity,
      recencyBoost: s.recencyBoost,
      graphBoost: s.graphBoost,
      boostedBy: s.boostedBy,
      score: s.similarity + s.recencyBoost + s.graphBoost,
    }))
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
}
