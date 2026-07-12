// Agent Brain node repository — MAXAİ ajanlarının bilgi zarfı (BrainNode)
// yazma/okuma yolu. TÜM fonksiyonlar scope='agent' ile çalışır: Personal
// Brain satırlarına (scope='personal') ne yazar ne dokunur; okuma yolları da
// scope='agent' filtreler — iki mantıksal Brain aynı entities tablosunu
// paylaşır ama bu katmandan yalnız Agent Brain görünür.
//
// Katman modeli:
//   * SICAK (hot): herkes yazabilir — createSignal. Ajanların ham gözlemleri
//     type='signal', status='gözlemlenen' olarak buraya düşer.
//   * SOĞUK (cold): yalnız "privileged" entegrasyon yoluyla yazılır —
//     integrateNode. NOT: bu ayrım yalnız yapısal/isimseldir; gerçek erişim
//     kontrolü (Auth/RLS session'ı) bu fazda YOK, her çağıran her fonksiyonu
//     çağırabilir.

import 'server-only'
import { resolveSingleUserId } from '../db-server'
import { brainDeps, mapNodeRow, NODE_COLUMNS } from './db'
import { linkNodes } from './link-registry'
import { COLD_NODE_TYPES, NODE_STATUSES } from './types'
import type { BrainNode, ColdNodeType, NodeStatus } from './types'

const TITLE_MAX = 80

function deriveTitle(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > TITLE_MAX ? `${flat.slice(0, TITLE_MAX)}…` : flat
}

export interface CreateSignalOptions {
  /** Test izolasyonu için kimlik override'ı; verilmezse tek profil (resolveSingleUserId). */
  userId?: string
}

/**
 * Sıcak katmana sinyal düşürür: layer='hot', type='signal', scope='agent',
 * status='gözlemlenen'. Embedding üretilir — sinyaller de semantik olarak
 * bulunabilir olmalı (Knowledge Agent entegrasyon adayı ararken).
 *
 * Şemada ajan kimliği/bağlam için ayrı kolon yok (source_table/source_id
 * köprü semantiğine ayrılmış + unique); kaynak ajan title'a, bağlam content
 * kuyruğuna kodlanır. Yapılandırılmış metadata kolonu ihtiyacı doğarsa ayrı
 * migration konusudur.
 */
export async function createSignal(
  content: string,
  sourceAgentId: string,
  context?: string,
  opts?: CreateSignalOptions,
): Promise<BrainNode> {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('createSignal: content boş olamaz.')

  const { supabase, embedder } = await brainDeps()
  const userId = opts?.userId ?? (await resolveSingleUserId())
  const title = `Signal(${sourceAgentId}): ${deriveTitle(trimmed)}`
  const fullContent = context?.trim() ? `${trimmed}\n\n[Bağlam] ${context.trim()}` : trimmed
  const [embedding] = await embedder.embed([`${title}\n\n${fullContent}`])

  const { data, error } = await supabase
    .from('entities')
    .insert({
      user_id: userId,
      type: 'signal',
      title,
      content: fullContent,
      embedding,
      scope: 'agent',
      layer: 'hot',
      status: 'gözlemlenen',
    })
    .select(NODE_COLUMNS)
    .single()
  if (error) throw error

  return mapNodeRow(data as Record<string, unknown>)
}

function assertColdNodeType(value: string): asserts value is ColdNodeType {
  if (!(COLD_NODE_TYPES as readonly string[]).includes(value)) {
    throw new Error(
      `integrateNode: '${value}' soğuk katman tipi değil — geçerli tipler: ${COLD_NODE_TYPES.join(', ')}.`,
    )
  }
}

/**
 * Sıcak katmandaki bir sinyali soğuk katman bilgisine damıtır: yeni node
 * (scope='agent', layer='cold', status='aday') yaratılır ve kaynağa
 * derived_from kenarı otomatik kurulur (yeni → sinyal). Sinyal SİLİNMEZ ve
 * statüsü değişmez — köken şeffaflığı kenarda yaşar.
 *
 * PRIVILEGED YOL: İleride sadece Knowledge Agent'ın çağırabileceği
 * entegrasyon kapısıdır; bu fazda gerçek yetkilendirme YOK — ayrım yalnız
 * yapısal/isimseldir, her çağıran çağırabilir.
 */
export async function integrateNode(
  signalId: string,
  targetType: ColdNodeType,
  content: string,
): Promise<BrainNode> {
  assertColdNodeType(targetType)
  const trimmed = content.trim()
  if (!trimmed) throw new Error('integrateNode: content boş olamaz.')

  const signal = await getNode(signalId)
  if (!signal) throw new Error(`integrateNode: sinyal bulunamadı (${signalId}).`)
  if (signal.type !== 'signal') {
    throw new Error(`integrateNode: kaynak node 'signal' tipinde değil ('${signal.type}').`)
  }

  const { supabase, embedder } = await brainDeps()
  const title = deriveTitle(trimmed)
  const [embedding] = await embedder.embed([`${title}\n\n${trimmed}`])

  const { data, error } = await supabase
    .from('entities')
    .insert({
      user_id: signal.userId, // kimlik sinyalden miras — ayrı kaynak yok
      type: targetType,
      title,
      content: trimmed,
      embedding,
      scope: 'agent',
      layer: 'cold',
      status: 'aday', // damıtıldı ama henüz doğrulanmadı; terfi updateNodeStatus ile
    })
    .select(NODE_COLUMNS)
    .single()
  if (error) throw error
  const node = mapNodeRow(data as Record<string, unknown>)

  await linkNodes(node.id, signalId, 'derived_from')

  return node
}

/** Node'u id ile okur — yalnız Agent Brain (scope='agent'); Personal Brain
 *  satırları bu katmandan görünmez. Bulunamazsa null. */
export async function getNode(id: string): Promise<BrainNode | null> {
  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('id', id)
    .eq('scope', 'agent')
    .maybeSingle()
  if (error) throw error
  return data ? mapNodeRow(data as Record<string, unknown>) : null
}

/**
 * Node yaşam döngüsü geçişi (gözlemlenen → aday → doğrulanmış → güvenilir →
 * eskimiş). Doğrulama anlamı taşıyan geçişlerde ('doğrulanmış'/'güvenilir')
 * confidence_count artar ve last_verified_at tazelenir.
 */
export async function updateNodeStatus(id: string, newStatus: NodeStatus): Promise<BrainNode> {
  if (!(NODE_STATUSES as readonly string[]).includes(newStatus)) {
    throw new Error(
      `updateNodeStatus: '${newStatus}' geçerli bir statü değil — geçerli: ${NODE_STATUSES.join(', ')}.`,
    )
  }
  const existing = await getNode(id)
  if (!existing) throw new Error(`updateNodeStatus: node bulunamadı (${id}).`)

  const patch: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === 'doğrulanmış' || newStatus === 'güvenilir') {
    patch.confidence_count = existing.confidenceCount + 1
    patch.last_verified_at = new Date().toISOString()
  }

  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('entities')
    .update(patch)
    .eq('id', id)
    .eq('scope', 'agent')
    .select(NODE_COLUMNS)
    .single()
  if (error) throw error

  return mapNodeRow(data as Record<string, unknown>)
}
