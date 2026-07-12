import { beforeEach, describe, expect, it, vi } from 'vitest'

// brain-relation birim testleri — DB'ye/embedding'e ÇIKMAZ: hybridRetrieveScoped
// mock'lanır. Odak: eşik-tabanlı seviye eşlemesi (sayısal skor sızmaz),
// RELATED_NODE_FLOOR süzmesi, boş sorgu / arama hatası nazik yolları.

vi.mock('@/lib/brain/query', () => ({
  hybridRetrieveScoped: vi.fn(),
}))

import { hybridRetrieveScoped } from '@/lib/brain/query'
import {
  buildBrainRelation,
  mapConfidence,
  mapSimilarityLevel,
  RELATED_NODE_FLOOR,
  SIMILARITY_HIGH_THRESHOLD,
  SIMILARITY_MEDIUM_THRESHOLD,
} from './brain-relation'

const retrieveMock = vi.mocked(hybridRetrieveScoped)

beforeEach(() => {
  retrieveMock.mockReset()
})

function hit(id: string, similarity: number, content = 'içerik') {
  return {
    id,
    type: 'note' as const,
    title: `node-${id}`,
    content,
    createdAt: '2026-07-01T00:00:00Z',
    similarity,
    recencyBoost: 0,
    graphBoost: 0,
    score: similarity,
  }
}

describe('mapSimilarityLevel / mapConfidence (eşik-tabanlı, sayı sızdırmaz)', () => {
  it('similarity eşikleri Low/Medium/High üretir', () => {
    expect(mapSimilarityLevel(null)).toBe('Low')
    expect(mapSimilarityLevel(SIMILARITY_MEDIUM_THRESHOLD - 0.01)).toBe('Low')
    expect(mapSimilarityLevel(SIMILARITY_MEDIUM_THRESHOLD)).toBe('Medium')
    expect(mapSimilarityLevel(SIMILARITY_HIGH_THRESHOLD - 0.01)).toBe('Medium')
    expect(mapSimilarityLevel(SIMILARITY_HIGH_THRESHOLD)).toBe('High')
  })

  it('confidence node sayısından türetilir — az içerik → Low', () => {
    expect(mapConfidence(0)).toBe('Low')
    expect(mapConfidence(1)).toBe('Low')
    expect(mapConfidence(2)).toBe('Medium')
    expect(mapConfidence(4)).toBe('Medium')
    expect(mapConfidence(5)).toBe('High')
  })
})

describe('buildBrainRelation', () => {
  it('boş sorgu → aramasız Low/Low + note', async () => {
    const rel = await buildBrainRelation('   \n  ', 'user-1')
    expect(rel).toMatchObject({ similarityLevel: 'Low', confidence: 'Low', relatedNodes: [] })
    expect(rel.note).toContain('Karşılaştırılacak')
    expect(retrieveMock).not.toHaveBeenCalled()
  })

  it('floor altındaki eşleşmeler ilgili sayılmaz; sonuçta sayısal skor taşınmaz', async () => {
    retrieveMock.mockResolvedValue([
      hit('a', 0.8, 'çok ilgili node içeriği'),
      hit('b', 0.5),
      hit('c', RELATED_NODE_FLOOR - 0.05), // floor altı — elenir
    ])

    const rel = await buildBrainRelation('test sorgusu', 'user-1')
    expect(rel.relatedNodes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(rel.similarityLevel).toBe('High') // en yüksek: 0.8
    expect(rel.confidence).toBe('Medium') // 2 ilgili node
    expect(rel.relatedNodes[0]).not.toHaveProperty('similarity')
    expect(JSON.stringify(rel)).not.toContain('0.8')
  })

  it('hiç eşleşme yoksa Low/Low, boş liste', async () => {
    retrieveMock.mockResolvedValue([])
    const rel = await buildBrainRelation('alakasız konu', 'user-1')
    expect(rel).toMatchObject({ similarityLevel: 'Low', confidence: 'Low', relatedNodes: [] })
  })

  it('arama hatası fırlatılmaz — Low/Low + note ile döner', async () => {
    retrieveMock.mockRejectedValue(new Error('embedding servisi kapalı'))
    const rel = await buildBrainRelation('test', 'user-1')
    expect(rel).toMatchObject({ similarityLevel: 'Low', confidence: 'Low' })
    expect(rel.note).toContain('Brain araması yapılamadı')
  })

  it('uzun node içeriği ~200 karakterde kırpılır (snippet)', async () => {
    retrieveMock.mockResolvedValue([hit('a', 0.9, 'X'.repeat(500))])
    const rel = await buildBrainRelation('test', 'user-1')
    expect(rel.relatedNodes[0].snippet.length).toBeLessThanOrEqual(201) // 200 + '…'
  })
})
