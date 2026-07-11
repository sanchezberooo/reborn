// Agent Brain sorgu katmanı — Agent Brain'e ÖZEL okuma yolları: tüm doğrudan
// sorgular DAİMA scope='agent' filtresiyle koşar (entities(scope, type)
// bileşik indeksi bu deseni karşılar, migration 0005). Personal Brain'in
// okuma yolları (lib/ai/retrieval.ts, lib/db-server.ts getBrainGraph)
// değişmeden kalır.

import 'server-only'
import { hybridRetrieve } from '../ai/retrieval'
import type { RetrievedEntity, RetrieveOptions } from '../ai/retrieval'
import { brainDeps, mapNodeRow, NODE_COLUMNS } from './db'
import type { BrainNode, BrainScope, NodeLayer, NodeType } from './types'

const DEFAULT_LIMIT = 50

export interface BrainQueryOptions {
  /** Test izolasyonu / ileride çok-kullanıcı için; verilmezse kullanıcı filtrelenmez
   *  (tek kullanıcılı fazda tüm agent node'ları zaten tek kimliğin altında). */
  userId?: string
  limit?: number
}

/** Tipe (ve istenirse katmana) göre Agent Brain node'ları — en yeniden eskiye. */
export async function getNodesByType(
  type: NodeType,
  layer?: NodeLayer,
  opts?: BrainQueryOptions,
): Promise<BrainNode[]> {
  const { supabase } = await brainDeps()
  let query = supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('scope', 'agent')
    .eq('type', type)
  if (layer) query = query.eq('layer', layer)
  if (opts?.userId) query = query.eq('user_id', opts.userId)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? DEFAULT_LIMIT)
  if (error) throw error
  return (data ?? []).map((r) => mapNodeRow(r as Record<string, unknown>))
}

/** Katmana göre Agent Brain node'ları (hot = sinyal kuyruğu, cold = damıtılmış bilgi). */
export async function getNodesByLayer(
  layer: NodeLayer,
  opts?: BrainQueryOptions,
): Promise<BrainNode[]> {
  const { supabase } = await brainDeps()
  let query = supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('scope', 'agent')
    .eq('layer', layer)
  if (opts?.userId) query = query.eq('user_id', opts.userId)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? DEFAULT_LIMIT)
  if (error) throw error
  return (data ?? []).map((r) => mapNodeRow(r as Record<string, unknown>))
}

/** limit'in kaç katı aday çekilir: post-filter sonrası limit'i doldurabilmek
 *  için pay (retrieval motoru scope bilmez, eleme burada yapılır). */
const SCOPED_OVERFETCH_FACTOR = 3
const SCOPED_OVERFETCH_MIN = 30

/**
 * hybridRetrieve'in scope'lu sarmalayıcısı — motorun KENDİSİNE DOKUNMAZ:
 * mevcut hybridRetrieve aynen çağrılır, sonuç entities.scope'a göre süzülür
 * (post-filter). RetrievedEntity zarfında scope alanı olmadığından dönen
 * id'lerin scope'u tek ek sorguyla okunur. limit'in altına düşmemek için
 * motor bilinçli fazla aday getirir (over-fetch) — yine de istenen scope'ta
 * yeterli aday yoksa sonuç limit'ten kısa dönebilir; bu, motoru değiştirmeme
 * kararının kabul edilmiş bedelidir.
 */
export async function hybridRetrieveScoped(
  query: string,
  scope: BrainScope,
  opts: RetrieveOptions,
): Promise<RetrievedEntity[]> {
  if (scope !== 'personal' && scope !== 'agent') {
    throw new Error(`hybridRetrieveScoped: geçersiz scope '${scope}' — 'personal' | 'agent'.`)
  }
  const limit = opts.limit ?? 10
  const overfetch = Math.max(limit * SCOPED_OVERFETCH_FACTOR, SCOPED_OVERFETCH_MIN)
  const results = await hybridRetrieve(query, { ...opts, limit: overfetch })
  if (results.length === 0) return []

  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('entities')
    .select('id, scope')
    .in('id', results.map((r) => r.id))
  if (error) throw error
  const scopeById = new Map((data ?? []).map((r) => [r.id as string, r.scope as BrainScope]))

  return results.filter((r) => scopeById.get(r.id) === scope).slice(0, limit)
}
