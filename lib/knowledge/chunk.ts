// Chunk aşaması (Knowledge Pipeline 4/16) — bölümleri analiz/dedup/extraction
// birimlerine böler. TAMAMEN SAF.
//
// İlkeler:
//  * Bölüm sınırı doğal chunk sınırıdır — küçük bölümler tek chunk olur.
//  * Büyük bölüm paragraf sınırından bölünür; paragraf tek başına sığmıyorsa
//    karakter kesimi son çaredir (bilgi kaybolmaz, yalnız bölünür).
//  * Fenced kod bloğu ASLA ortadan bölünmez: parse aşaması blokları bölüm
//    içeriğinde bıraktığı için paragraf bölme fence çiftlerini korur.
//  * Chunk'lar v1'de KALICI DEĞİLDİR: pipeline-içi analiz birimidir; item
//    node'un content'i normalize belgedir (chunk başına node üretimi Sprint 6
//    kalibrasyonuna bırakıldı — node enflasyonu bilinçli reddedildi).

import type { KnowledgeChunk, ParsedDocument } from './types'

export const DEFAULT_MAX_CHUNK_CHARS = 2000
/** Bu boyutun altındaki ardışık parçalar aynı bölüm içinde birleştirilir. */
export const DEFAULT_MIN_CHUNK_CHARS = 200

export interface ChunkOptions {
  maxChars?: number
  minChars?: number
}

/** Paragraf listesini maxChars tavanlı parçalara paketler (fence-güvenli:
 *  paragraflar boş satırdan bölündüğü için fence blokları bütün kalır). */
function packParagraphs(paragraphs: string[], maxChars: number): string[] {
  const out: string[] = []
  let current = ''
  for (const p of paragraphs) {
    if (p.length > maxChars) {
      if (current) { out.push(current); current = '' }
      // Tek paragraf tavana sığmıyor (dev tablo/paragraf) — karakter kesimi.
      for (let i = 0; i < p.length; i += maxChars) out.push(p.slice(i, i + maxChars))
      continue
    }
    const merged = current ? `${current}\n\n${p}` : p
    if (merged.length > maxChars) {
      out.push(current)
      current = p
    } else {
      current = merged
    }
  }
  if (current) out.push(current)
  return out
}

/** Bölüm içeriğini paragraflara ayırır — fenced kod blokları TEK paragraf
 *  sayılır (boş satır içerse bile bölünmez). */
export function splitParagraphsFenceSafe(content: string): string[] {
  const paragraphs: string[] = []
  let buffer: string[] = []
  let fenceMarker: string | null = null

  const flush = () => {
    const text = buffer.join('\n').trim()
    if (text) paragraphs.push(text)
    buffer = []
  }

  for (const line of content.split('\n')) {
    const fence = /^(```|~~~)/.exec(line)?.[1] ?? null
    if (fenceMarker) {
      buffer.push(line)
      if (fence === fenceMarker) fenceMarker = null
      continue
    }
    if (fence) {
      buffer.push(line)
      fenceMarker = fence
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }
    buffer.push(line)
  }
  flush()
  return paragraphs
}

/**
 * Belgeyi chunk listesine çevirir: bölüm → (gerekirse) paragraf paketleri.
 * Aynı bölümün minChars altındaki ardışık parçaları birleştirilir; farklı
 * bölümler asla tek chunk'ta karışmaz (başlık yolu chunk kimliğidir).
 */
export function chunkDocument(parsed: ParsedDocument, opts: ChunkOptions = {}): KnowledgeChunk[] {
  const maxChars = Math.max(200, opts.maxChars ?? DEFAULT_MAX_CHUNK_CHARS)
  const minChars = Math.max(0, Math.min(opts.minChars ?? DEFAULT_MIN_CHUNK_CHARS, maxChars))

  const chunks: KnowledgeChunk[] = []
  for (const section of parsed.sections) {
    const body = section.heading ? `${'#'.repeat(Math.max(1, section.level))} ${section.heading}\n\n${section.content}` : section.content
    if (!body.trim()) continue

    const pieces = body.length <= maxChars
      ? [body.trim()]
      : packParagraphs(splitParagraphsFenceSafe(body), maxChars)

    // Küçük ardışık parçaları birleştir (aynı bölüm içinde).
    const merged: string[] = []
    for (const piece of pieces) {
      const last = merged[merged.length - 1]
      if (last !== undefined && last.length < minChars && last.length + piece.length + 2 <= maxChars) {
        merged[merged.length - 1] = `${last}\n\n${piece}`
      } else {
        merged.push(piece)
      }
    }

    for (const content of merged) {
      chunks.push({
        index: chunks.length,
        sectionPath: section.path,
        content,
        chars: content.length,
      })
    }
  }
  return chunks
}
