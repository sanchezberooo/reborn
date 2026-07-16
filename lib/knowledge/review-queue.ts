// Knowledge Review Queue (Sprint 6) — "her bilgi doğrudan Agent Brain'e
// gitmesin" ilkesinin kod karşılığı. AYRI BİR KUYRUK TABLOSU YOKTUR (tek
// source of truth): ingestion'dan doğan her node zaten status='aday'
// karantinasında doğar — güvenilir bilgi DEĞİLDİR, scoring engine'de düşük
// ağırlık taşır (STATUS_WEIGHT aday=0.7) ve terfisi bilinçli karar bekler.
// Bu dosya o karantinanın YÖNETİM YÜZEYİDİR: bekleyenleri Score/Confidence/
// Reason/Source/Reviewer/Status alanlarıyla listeler; karar uygulaması
// registry.reviewKnowledgeNode'dadır (statü + metadata.review + olaylar).
//
// 'server-only'. Salt okuma — kuyruk listelemek hiçbir şeyi değiştirmez.

import 'server-only'
import { brainDeps, mapNodeRow, NODE_COLUMNS } from '../brain/db'
import type { BrainNode } from '../brain/types'
import type { ExtractionKind, ExtractionMeta, KnowledgeItemMeta, ReviewRecord } from './types'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface ReviewQueueEntry {
  nodeId: string
  entryKind: 'item' | 'extraction'
  /** extraction girişlerinde tür (skill/workflow/…); item'da null. */
  extractionKind: ExtractionKind | null
  nodeType: string
  title: string
  /** Sıralama puanı: item→trustScore, extraction→confidence. */
  score: number
  confidence: number
  /** İnsan-okur gerekçe: item→kalite kararı, extraction→köken bölümü. */
  reason: string
  /** Kaynak: item→kaynak URL/tür, extraction→üretildiği item node id. */
  source: string
  /** Karar işlendiyse kim işledi (metadata.review) — kuyruktaki girişte
   *  normalde null; reviewed=true filtresiyle geçmiş de listelenebilir. */
  reviewer: string | null
  /** Node yaşam döngüsü statüsü — kuyrukta daima 'aday'. */
  status: string
  createdAt: string
}

export interface ReviewQueueOptions {
  /** Yalnız bu extraction türü (item'ları dışlar). */
  kind?: ExtractionKind
  /** true → karar işlenmiş geçmiş (aday OLMAYAN, review kaydı taşıyan). */
  reviewed?: boolean
  limit?: number
}

function toEntry(node: BrainNode): ReviewQueueEntry | null {
  const meta = node.metadata
  if (!meta) return null
  const review = (meta.review as ReviewRecord | undefined) ?? null

  if (meta.kind === 'knowledge-item') {
    const item = meta as KnowledgeItemMeta
    return {
      nodeId: node.id,
      entryKind: 'item',
      extractionKind: null,
      nodeType: node.type,
      title: node.title,
      score: item.trustScore,
      confidence: item.trustScore,
      reason: `kalite: ${item.qualityVerdict} (trust ${item.trustScore.toFixed(2)}) — ${item.category}`,
      source: item.source.url ?? item.source.type,
      reviewer: review?.reviewer ?? null,
      status: node.status,
      createdAt: node.createdAt,
    }
  }
  if (meta.kind === 'knowledge-extraction') {
    const extraction = meta as ExtractionMeta
    return {
      nodeId: node.id,
      entryKind: 'extraction',
      extractionKind: extraction.extractionKind,
      nodeType: node.type,
      title: node.title,
      score: extraction.confidence,
      confidence: extraction.confidence,
      reason: `${extraction.extractionKind} adayı — köken: ${extraction.sectionPath}`,
      source: extraction.itemNodeId,
      reviewer: review?.reviewer ?? null,
      status: node.status,
      createdAt: node.createdAt,
    }
  }
  return null
}

/**
 * İnceleme kuyruğu: bekleyen (status='aday', zarflı) knowledge node'ları —
 * puan büyükten küçüğe (yüksek güvenli bilgi önce incelenir: onay hızlı,
 * şüpheli olan zaten dikkat ister). reviewed=true geçmiş görünümüne çevirir.
 */
export async function listReviewQueue(opts: ReviewQueueOptions = {}): Promise<ReviewQueueEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const { supabase } = await brainDeps()

  let query = supabase
    .from('entities')
    .select(NODE_COLUMNS)
    .eq('scope', 'agent')
    .not('metadata', 'is', null)
  query = opts.reviewed === true
    ? query.neq('status', 'aday').not('metadata->review', 'is', null)
    : query.eq('status', 'aday')
  if (opts.kind) {
    query = query.contains('metadata', { kind: 'knowledge-extraction', extractionKind: opts.kind })
  }

  // Zarf süzmesi (kind alanı) JS'te tamamlanır — iki zarf türü tek sorguda
  // OR containment gerektirir, okunur filtre burada kurulur; pay bırakılır.
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit * 2)
  if (error) throw error

  return (data ?? [])
    .map((r) => toEntry(mapNodeRow(r as Record<string, unknown>)))
    .filter((e): e is ReviewQueueEntry => e !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
