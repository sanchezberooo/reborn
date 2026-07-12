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

/**
 * hybridRetrieve'in scope'lu sarmalayıcısı: scope, match_entities RPC'sine
 * (migration 0006) doğrudan parametre olarak iner — benzerlik sıralaması
 * DB'de istenen scope İÇİNDE yapılır. Eski over-fetch + JS post-filter
 * yaklaşımına gerek kalmadı; onun "istenen scope'ta yeterli aday yoksa sonuç
 * limit'ten kısa dönebilir" zafiyeti de bununla kapandı.
 */
export async function hybridRetrieveScoped(
  query: string,
  scope: BrainScope,
  opts: RetrieveOptions,
): Promise<RetrievedEntity[]> {
  if (scope !== 'personal' && scope !== 'agent') {
    throw new Error(`hybridRetrieveScoped: geçersiz scope '${scope}' — 'personal' | 'agent'.`)
  }
  return hybridRetrieve(query, { ...opts, scope })
}
