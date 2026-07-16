// Memory Engine (Sprint 4) — Brain'in hafıza görünümleri ve otomatik ilişki
// kurma. Sözlük lib/brain/types.ts'tedir (MEMORY_CLASS_BY_TYPE): episodic/
// semantic SAKLAMA sınıfıdır; working/long-term ise GETİRİM pencereleridir —
// working memory recency penceresi sorgusudur, long-term memory kalıcı grafın
// kendisidir (hiçbir node silinmez).
//
// "HİÇBİR KAYIT YALNIZ YAŞAMAMALI" (Sprint 4 Memory Engine ilkesi):
// autoLinkNode yeni/mevcut bir node'u aynı scope'taki en benzer node'lara
// otomatik bağlar (kind='semantic', strength=benzerlik — retrieval'ın graf
// genişletmesi bu kenarları zaten okur, lib/ai/retrieval.ts edgeWeight).
// Bağlanacak aday yoksa (ilk kayıt / eşik altı) node bağsız kalabilir —
// ilke "kayıt bağlanabilir olmalı ve yazma yolu bağlamayı DENEMELİ"dir;
// grafın ilk düğümünü zorla bağlayacak ikinci bir düğüm icat edilmez.

import 'server-only'
import { createLink } from '../db-server'
import {
  brainDeps, getNodeEmbedding, mapNodeRow, matchSimilarNodes, NODE_COLUMNS,
} from './db'
import { rankItems } from './scoring'
import type { BrainNode, BrainScope, MemoryClass, NodeType } from './types'
import { MEMORY_CLASS_BY_TYPE } from './types'

/** Tipin saklama sınıfı — TAM eşlemenin (types.ts) fonksiyon yüzü. */
export function memoryClassOf(type: NodeType): MemoryClass {
  return MEMORY_CLASS_BY_TYPE[type]
}

/** Sınıfın tip listesi (timeline episodic tiplerden kurulur). */
export function typesOfMemoryClass(memoryClass: MemoryClass): NodeType[] {
  return (Object.keys(MEMORY_CLASS_BY_TYPE) as NodeType[])
    .filter((type) => MEMORY_CLASS_BY_TYPE[type] === memoryClass)
}

export interface TimelineOptions {
  scope?: BrainScope
  limit?: number
  /** ISO — verilirse yalnız bu andan önce yaratılanlar (sayfalama imleci). */
  before?: string
  /** Episodic tiplerin alt kümesiyle sınırla (örn yalnız 'decision' —
   *  Decision History budur; yalnız 'reflection' — Learning History budur). */
  types?: NodeType[]
}

/**
 * Timeline (Episode Memory görünümü): episodic sınıfın node'ları, yeniden
 * eskiye. types verilirse episodic OLMAYAN tip reddedilir — timeline'a
 * semantic bilgi sızamaz (sınıf ayrımı sorgu anında da korunur).
 */
export async function getTimeline(userId: string, opts: TimelineOptions = {}): Promise<BrainNode[]> {
  const episodicTypes = typesOfMemoryClass('episodic')
  let types = episodicTypes
  if (opts.types) {
    for (const type of opts.types) {
      if (MEMORY_CLASS_BY_TYPE[type] !== 'episodic') {
        throw new Error(`getTimeline: '${type}' episodic bir tip değil — timeline yalnız yaşantı kayıtlarından kurulur.`)
      }
    }
    types = opts.types
  }

  const { supabase } = await brainDeps()
  let query = supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('user_id', userId)
    .eq('scope', opts.scope ?? 'personal')
    .in('type', types)
  if (opts.before) query = query.lt('created_at', opts.before)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 20)
  if (error) throw error
  return (data ?? []).map((r) => mapNodeRow(r as Record<string, unknown>))
}

export interface WorkingMemoryOptions {
  scope?: BrainScope
  /** Pencere genişliği gün cinsinden (varsayılan 7). */
  windowDays?: number
  limit?: number
}

/**
 * Working Memory: son windowDays içinde DOKUNULMUŞ (updated_at — yaratma da
 * güncelleme de dokunuştur) node'lar, scoring engine'in decay'li importance
 * sırasıyla. "Şu an zihinde ne var" penceresi — saklama değil getirim kavramı.
 */
export async function getWorkingMemory(userId: string, opts: WorkingMemoryOptions = {}): Promise<BrainNode[]> {
  const windowDays = opts.windowDays ?? 7
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString()

  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('user_id', userId)
    .eq('scope', opts.scope ?? 'personal')
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(Math.max((opts.limit ?? 20) * 3, 30)) // sıralama importance'la değişir — pay bırak
  if (error) throw error

  const nodes = (data ?? []).map((r) => mapNodeRow(r as Record<string, unknown>))
  const ranked = rankItems(nodes.map((node) => ({
    node,
    type: node.type,
    status: node.status,
    freshnessAnchor: node.updatedAt,
    confidenceCount: node.confidenceCount,
  })))
  return ranked.slice(0, opts.limit ?? 20).map((r) => r.node)
}

// ── Otomatik ilişki kurma ───────────────────────────────────────────────────

/** Otomatik bağ eşiği: bge-m3 kosinüsünde 0.6 civarı "aynı konu komşuluğu"
 *  bandıdır; altı gürültüdür. Çağıran bağlama göre override edebilir. */
export const AUTO_LINK_THRESHOLD = 0.6
export const AUTO_LINK_TOP_K = 5

export interface AutoLinkOptions {
  threshold?: number
  topK?: number
}

export interface AutoLinkResult {
  nodeId: string
  linkedTo: { nodeId: string; similarity: number }[]
}

/**
 * Node'u aynı scope'taki en benzer node'lara semantic kenarla bağlar
 * (strength=benzerlik, idempotent upsert). Eskimiş node'a bağ KURULMAZ
 * (yerini alan zaten benzer çıkacaktır); kendine bağ zaten imkânsız.
 * Embedding'i olmayan node sessizce bağsız döner — hata değil (embedding
 * üretimi ayrı bir kaygıdır, bağ kurulamaması kaydı düşürmez).
 */
export async function autoLinkNode(nodeId: string, opts: AutoLinkOptions = {}): Promise<AutoLinkResult> {
  const threshold = opts.threshold ?? AUTO_LINK_THRESHOLD
  const topK = opts.topK ?? AUTO_LINK_TOP_K

  const { supabase } = await brainDeps()
  const { data: row, error } = await supabase
    .from('entities')
    .select('id, user_id, scope')
    .eq('id', nodeId)
    .maybeSingle()
  if (error) throw error
  if (!row) throw new Error(`autoLinkNode: node bulunamadı (${nodeId}).`)

  const embedding = await getNodeEmbedding(nodeId)
  if (!embedding) return { nodeId, linkedTo: [] }

  // +topK pay: kendisi ve eskimişler süzülünce liste kısalmasın.
  const similar = await matchSimilarNodes(row.user_id as string, embedding, {
    scope: row.scope as BrainScope,
    limit: topK * 2 + 1,
  })
  const candidateIds = similar
    .filter((s) => s.id !== nodeId && s.similarity >= threshold)
    .map((s) => s.id)
  if (candidateIds.length === 0) return { nodeId, linkedTo: [] }

  const { data: statusRows, error: statusError } = await supabase
    .from('entities')
    .select('id, status')
    .in('id', candidateIds)
  if (statusError) throw statusError
  const alive = new Set(
    (statusRows ?? []).filter((r) => r.status !== 'eskimiş').map((r) => r.id as string),
  )

  const simById = new Map(similar.map((s) => [s.id, s.similarity]))
  const targets = candidateIds.filter((id) => alive.has(id)).slice(0, topK)

  const linkedTo: { nodeId: string; similarity: number }[] = []
  for (const targetId of targets) {
    const similarity = simById.get(targetId) ?? threshold
    await createLink({
      sourceEntityId: nodeId,
      targetEntityId: targetId,
      kind: 'semantic',
      strength: Math.min(1, Math.max(0, similarity)),
    })
    linkedTo.push({ nodeId: targetId, similarity })
  }
  return { nodeId, linkedTo }
}
