// Agent Brain link registry — 9 tanımlı ilişki tipiyle (types.ts LINK_TYPES)
// node'lar arası kenar yönetimi. Kenarlar links tablosunun kind kolonunda
// yaşar (migration 0005: semantic/user/wikilink üçlüsünün yanına eklendi).
//
// İlke: bilgi SİLİNMEZ — eskiyen node supersede() ile status='eskimiş'
// işaretlenir ve supersedes kenarı kurulur; delete yolu bilinçli olarak yok.

import 'server-only'
import { brainDeps, mapLinkRow, mapNodeRow, LINK_COLUMNS, NODE_COLUMNS } from './db'
import { LINK_TYPES } from './types'
import type { BrainLink, BrainNode, LinkType } from './types'

function assertLinkType(value: string): asserts value is LinkType {
  if (!(LINK_TYPES as readonly string[]).includes(value)) {
    throw new Error(
      `linkNodes: '${value}' tanımlı bir ilişki tipi değil — geçerli tipler: ${LINK_TYPES.join(', ')}.`,
    )
  }
}

/**
 * İki node arasına tipli kenar kurar; 9 tanımlı tip dışını reddeder.
 * Aynı (source, target, type) kenarı varsa günceller (idempotent —
 * lib/db-server.ts createLink deseni).
 */
export async function linkNodes(
  fromId: string,
  toId: string,
  linkType: LinkType,
): Promise<BrainLink> {
  assertLinkType(linkType)
  if (fromId === toId) {
    throw new Error('linkNodes: node kendisine bağlanamaz (şema CHECK\'i).')
  }
  const { supabase } = await brainDeps()
  const { data, error } = await supabase
    .from('links')
    .upsert(
      { source_entity_id: fromId, target_entity_id: toId, kind: linkType },
      { onConflict: 'source_entity_id,target_entity_id,kind' },
    )
    .select(LINK_COLUMNS)
    .single()
  if (error) throw error

  return mapLinkRow(data as Record<string, unknown>)
}

export interface LinkedNode {
  node: BrainNode
  link: BrainLink
  /** Kenar bu node'dan mı çıkıyor (outgoing) yoksa ona mı geliyor (incoming). */
  direction: 'outgoing' | 'incoming'
}

/**
 * Bir node'un kenar komşularını döner (iki yönde de). linkType verilirse o
 * tiple sınırlar; verilmezse Agent Brain'in 9 tipinin tamamını tarar —
 * Personal Brain kenarları (semantic/user/wikilink) bu registry'nin kapsamı
 * dışıdır, döndürülmez.
 */
export async function getLinkedNodes(
  nodeId: string,
  linkType?: LinkType,
): Promise<LinkedNode[]> {
  if (linkType !== undefined) assertLinkType(linkType)
  const { supabase } = await brainDeps()

  let query = supabase
    .from('links')
    .select(LINK_COLUMNS)
    .or(`source_entity_id.eq.${nodeId},target_entity_id.eq.${nodeId}`)
  query = linkType ? query.eq('kind', linkType) : query.in('kind', [...LINK_TYPES])
  const { data: linkRows, error: linkError } = await query
  if (linkError) throw linkError

  const links = (linkRows ?? []).map((r) => mapLinkRow(r as Record<string, unknown>))
  const neighborIds = [
    ...new Set(links.map((l) => (l.sourceId === nodeId ? l.targetId : l.sourceId))),
  ]
  if (neighborIds.length === 0) return []

  const { data: nodeRows, error: nodeError } = await supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .in('id', neighborIds)
  if (nodeError) throw nodeError
  const nodeById = new Map(
    (nodeRows ?? []).map((r) => {
      const node = mapNodeRow(r as Record<string, unknown>)
      return [node.id, node] as const
    }),
  )

  const out: LinkedNode[] = []
  for (const link of links) {
    const direction = link.sourceId === nodeId ? 'outgoing' : 'incoming'
    const node = nodeById.get(direction === 'outgoing' ? link.targetId : link.sourceId)
    if (node) out.push({ node, link, direction })
  }
  return out
}

/**
 * Eski node'u yenisiyle eskitir: SİLMEZ — eski node status='eskimiş' olur ve
 * yeni → eski yönünde supersedes kenarı kurulur (yeni node eskiyi eskitti).
 * Eski node'un içeriği, embedding'i ve diğer kenarları olduğu gibi kalır;
 * geçmiş sorgulanabilir olmaya devam eder.
 */
export async function supersede(oldId: string, newId: string): Promise<BrainLink> {
  const { supabase } = await brainDeps()
  // Önce kenar: kenar kurulamıyorsa (ör. node yok, FK hatası) eski node'un
  // statüsüne hiç dokunulmamış olur — yarım supersede kalmaz.
  const link = await linkNodes(newId, oldId, 'supersedes')

  const { data, error } = await supabase
    .from('entities')
    .update({ status: 'eskimiş', updated_at: new Date().toISOString() })
    .eq('id', oldId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error(`supersede: eskitilecek node bulunamadı (${oldId}).`)
  }

  return link
}

/**
 * İki node'un çeliştiğini kenarla işaretler. Statülere dokunmaz — hangisinin
 * geçerli olduğu kararı (updateNodeStatus / supersede) ayrı ve bilinçli bir
 * adımdır; çelişki tespiti karar değil gözlemdir.
 */
export async function markContradiction(nodeIdA: string, nodeIdB: string): Promise<BrainLink> {
  return linkNodes(nodeIdA, nodeIdB, 'contradicts')
}
