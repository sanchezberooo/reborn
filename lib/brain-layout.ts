// Brain graf düzeni — gerçek entities/links'i (lib/db-server.ts getBrainGraph)
// KnowledgeGraph'ın beklediği Note[] + edges şekline (id/label/x/y/size/tags/
// updated/body/links) dönüştürür. Saf fonksiyonlar, DB/embedding erişimi yok —
// components/brain/Brain.tsx (client) ve app/brain/page.tsx (server) ikisi de
// güvenle çağırabilir. KnowledgeGraph.tsx'in görselleştirme mantığına dokunmaz;
// yalnızca onun tükettiği veriyi üretir.

import type { BrainGraph, EntityType } from './db-server'
import type { Note } from './brain-data'

const TYPE_TAG: Record<EntityType, string> = {
  journal: '#günlük',
  goal: '#hedef',
  note: '#not',
  project: '#proje',
  person: '#kişi',
  task: '#görev',
  essay: '#essay',
  habit: '#alışkanlık',
  resource: '#kaynak',
  event: '#etkinlik',
}

function relativeTimeTR(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'şimdi'
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} sa önce`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} gün önce`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ay önce`
  return `${Math.floor(months / 12)} yıl önce`
}

/**
 * Yalıtılmış (0 bağlantılı) düğüm her zaman leaf. Geri kalanlar derece
 * sırasına göre orantılı dilimlenir (sabit eşik değil) — böylece hem küçük
 * hem büyük graf'ta "hub" anlamlı bir üst küme olarak kalır.
 */
function classifySizes(degree: Map<string, number>): Map<string, Note['size']> {
  const ranked = [...degree.entries()].sort((a, b) => b[1] - a[1])
  const hubCut = Math.max(1, Math.ceil(ranked.length * 0.12))
  const midCut = Math.max(hubCut, Math.ceil(ranked.length * 0.45))
  const sizes = new Map<string, Note['size']>()
  ranked.forEach(([id, deg], i) => {
    if (deg === 0) sizes.set(id, 'leaf')
    else if (i < hubCut) sizes.set(id, 'hub')
    else if (i < midCut) sizes.set(id, 'mid')
    else sizes.set(id, 'leaf')
  })
  return sizes
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * Merkezden dışa phyllotaxis (ayçiçeği) düzeni — 1000x680 SVG viewBox'a göre
 * ölçeklenir. orderedIds derece azalan sırada verilir, böylece en bağlantılı
 * düğümler merkeze yakın oturur (görsel "hub" hissi).
 */
function computeLayout(orderedIds: string[]): Map<string, { x: number; y: number }> {
  const n = orderedIds.length
  const radiusX = 430
  const radiusY = 260
  const map = new Map<string, { x: number; y: number }>()
  orderedIds.forEach((id, i) => {
    const t = n <= 1 ? 0 : Math.sqrt(i / (n - 1))
    const angle = i * GOLDEN_ANGLE
    map.set(id, {
      x: 500 + radiusX * t * Math.cos(angle),
      y: 340 + radiusY * t * Math.sin(angle),
    })
  })
  return map
}

export interface BrainView {
  notes: Note[]
  edges: { source: string; target: string }[]
  noteById: Record<string, Note>
}

export function buildBrainView(graph: BrainGraph): BrainView {
  const degree = new Map<string, number>()
  const adjacency = new Map<string, Set<string>>()
  for (const n of graph.nodes) {
    degree.set(n.id, 0)
    adjacency.set(n.id, new Set())
  }

  const edges: { source: string; target: string }[] = []
  const seenPairs = new Set<string>()
  for (const e of graph.edges) {
    if (e.source === e.target) continue
    if (!adjacency.has(e.source) || !adjacency.has(e.target)) continue
    const key = [e.source, e.target].sort().join('|')
    if (seenPairs.has(key)) continue
    seenPairs.add(key)
    edges.push({ source: e.source, target: e.target })
    adjacency.get(e.source)!.add(e.target)
    adjacency.get(e.target)!.add(e.source)
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
  }

  const sizeById = classifySizes(degree)
  const orderedByDegree = [...graph.nodes].sort(
    (a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0),
  )
  const posById = computeLayout(orderedByDegree.map((n) => n.id))

  const notes: Note[] = graph.nodes.map((n) => {
    const pos = posById.get(n.id) ?? { x: 500, y: 340 }
    return {
      id: n.id,
      label: n.title,
      x: pos.x,
      y: pos.y,
      size: sizeById.get(n.id) ?? 'leaf',
      tags: [TYPE_TAG[n.type] ?? `#${n.type}`],
      updated: relativeTimeTR(n.updatedAt),
      body: n.content?.trim() || 'Bu kayıt için henüz içerik yok.',
      links: [...(adjacency.get(n.id) ?? [])],
      entityType: n.type,
    }
  })

  return { notes, edges, noteById: Object.fromEntries(notes.map((n) => [n.id, n])) }
}
