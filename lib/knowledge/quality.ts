// Knowledge Quality Engine (Knowledge Pipeline 15/16) — bilgiyi altı boyutta
// puanlar ve yazma kararını (accept/review/reject) üretir. TAMAMEN SAF ve
// DETERMİNİSTİK. Node tazeliği/decay'i BURANIN İŞİ DEĞİLDİR — o tek kaynak
// lib/brain/scoring.ts'tedir; buradaki 'currency' kaynağın YAYIN tarihine
// bakan yazma-anı boyutudur (farklı soru, farklı yarı ömür).
//
// KARARIN ANLAMI:
//  * accept — Brain'e yazılır (status='aday'; terfi yaşam döngüsünün işi).
//  * review — Brain'e YİNE yazılır ('aday' zaten inceleme bekleyen statüdür)
//    ama zarfa verdict='review' işlenir; Registry inceleme kuyruğu bununla
//    filtrelenir. Yazıp işaretlemek, yazmayıp kaybetmekten iyidir.
//  * reject — Brain'e HİÇBİR ŞEY yazılmaz; knowledge_rejected olayı düşer.
//    Eşik bilinçli DÜŞÜKTÜR: heuristik motor gerçek bilgiyi çöpe atmamalı,
//    yalnız bariz değersiz girdiyi (boş/tekrar yığını) kesmelidir.

import type { KnownSourceType } from './source-fetcher'
import type { QualityDimensions, QualityReport, QualityVerdict } from './types'

// ── Boyut sabitleri ─────────────────────────────────────────────────────────

/** Kaynak türü güven tabanı [0,1] — "bu tür kaynak yapısal olarak ne kadar
 *  güvenilir". Tek kalibrasyon yeri burasıdır. */
export const SOURCE_TYPE_RELIABILITY: Record<KnownSourceType, number> = {
  research: 0.9, // hakem/atıf kültürü
  github: 0.8,   // canlı kod + topluluk gözü
  pdf: 0.7,      // kurumsal belge varsayımı
  docs: 0.7,     // resmi dokümantasyon sitesi varsayımı
  notion: 0.65,  // iç çalışma alanı — yazarına bağlı
  gdrive: 0.6,   // paylaşılan belge — yazarına bağlı
  markdown: 0.6, // iç not/dokümantasyon — yazarına bağlı
  website: 0.5,  // serbest web
  youtube: 0.5,  // transkript kalitesi değişken
  rss: 0.45,     // akış gürültüsü
}

/** Güncellik yarı ömrü: kaynak bilgisi Brain node'larından (45g) daha yavaş
 *  eskir — 120 günde yarıya iner; dış bilgi ("nasıl yapılır") kişisel
 *  bağlamdan daha uzun ömürlüdür. */
export const CURRENCY_HALF_LIFE_DAYS = 120
/** publishedAt bilinmiyorsa nötr güncellik — bilinmeyen tarih ceza değildir. */
export const CURRENCY_UNKNOWN = 0.7

/** Ağırlıklar (toplam 1.0) — güvenilirlik en ağır boyut. */
export const QUALITY_WEIGHTS: Record<keyof QualityDimensions, number> = {
  reliability: 0.25,
  currency: 0.15,
  repetition: 0.15,
  usability: 0.15,
  sourceQuality: 0.15,
  applicability: 0.15,
}

export const REJECT_THRESHOLD = 0.35
export const REVIEW_THRESHOLD = 0.6

export interface QualityInput {
  sourceType: KnownSourceType
  author: string | null
  version: string | null
  sourceUrl: string | null
  publishedAt: string | null
  citationCount: number
  duplicationRate: number
  chunkCount: number
  avgChunkChars: number
  headingCount: number
  codeBlockCount: number
  orderedStepSections: number
  extractionCandidateCount: number
  contentChars: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
/** Logaritmik doyan bonus (scoring.ts degreeBonus deseni): ilk sinyaller
 *  değerli, yığın sinyal şişiremez. */
const saturating = (count: number, max: number) => max * (1 - 1 / (1 + Math.log1p(Math.max(0, count))))

export function computeQuality(input: QualityInput, nowMs: number = Date.now()): QualityReport {
  const reasons: string[] = []

  // Güvenilirlik: tür tabanı + yazar bilinirliği + atıf doygunluğu.
  const reliability = clamp01(
    SOURCE_TYPE_RELIABILITY[input.sourceType]
    + (input.author ? 0.05 : 0)
    + saturating(input.citationCount, 0.1),
  )

  // Güncellik: publishedAt üzerinde exp decay — scoring.computeFreshness ile
  // aynı matematik ama BİLİNÇLİ farklı yarı ömür (üstteki sabit notu); node
  // tazeliği (okuma anı) Registry'de yine scoring motorundan hesaplanır.
  let currency = CURRENCY_UNKNOWN
  if (input.publishedAt) {
    const anchor = Date.parse(input.publishedAt)
    if (!Number.isNaN(anchor)) {
      const ageDays = Math.max(0, (nowMs - anchor) / 86_400_000)
      currency = 2 ** (-ageDays / CURRENCY_HALF_LIFE_DAYS)
    }
  }

  // Tekrar oranı (tersine): tamamı tekrar olan belge 0 alır.
  const repetition = clamp01(1 - input.duplicationRate)
  if (input.duplicationRate > 0.5) reasons.push(`İçeriğin %${Math.round(input.duplicationRate * 100)}'i tekrar — tekrar boyutu düşük.`)

  // Kullanılabilirlik: yapı sinyalleri. Başlıksız/dev tek blok metin düşük.
  const readableChunk = input.avgChunkChars >= 200 && input.avgChunkChars <= 2200
  const usability = clamp01(
    0.3
    + (input.headingCount > 0 ? 0.2 : 0)
    + (readableChunk ? 0.15 : 0)
    + saturating(input.orderedStepSections, 0.2)
    + saturating(input.codeBlockCount, 0.15),
  )
  if (input.headingCount === 0 && input.contentChars > 1500) {
    reasons.push('Uzun içerikte hiç başlık yok — kullanılabilirlik düşük.')
  }

  // Kaynak kalitesi: üst-veri bütünlüğü.
  const sourceQuality = clamp01(
    0.3
    + (input.sourceUrl ? 0.2 : 0)
    + (input.author ? 0.2 : 0)
    + (input.version ? 0.1 : 0)
    + (input.citationCount > 0 ? 0.2 : 0),
  )

  // Uygulanabilirlik: eyleme dönüştürülebilirlik — extraction adayı yoğunluğu
  // + adım/kod varlığı.
  const applicability = clamp01(
    0.25
    + saturating(input.extractionCandidateCount, 0.45)
    + (input.orderedStepSections > 0 ? 0.15 : 0)
    + (input.codeBlockCount > 0 ? 0.15 : 0),
  )
  if (input.extractionCandidateCount === 0) {
    reasons.push('Hiç extraction adayı bulunamadı — uygulanabilirlik sınırlı.')
  }

  const dimensions: QualityDimensions = {
    reliability, currency, repetition, usability, sourceQuality, applicability,
  }

  const trustScore = clamp01(
    (Object.keys(QUALITY_WEIGHTS) as (keyof QualityDimensions)[])
      .reduce((sum, key) => sum + QUALITY_WEIGHTS[key] * dimensions[key], 0),
  )

  let verdict: QualityVerdict
  if (input.contentChars === 0 || trustScore < REJECT_THRESHOLD) {
    verdict = 'reject'
    reasons.push(`Güven puanı ${trustScore.toFixed(2)} < ${REJECT_THRESHOLD} — kalite kapısı reddetti.`)
  } else if (trustScore < REVIEW_THRESHOLD) {
    verdict = 'review'
    reasons.push(`Güven puanı ${trustScore.toFixed(2)} inceleme bandında (${REJECT_THRESHOLD}–${REVIEW_THRESHOLD}).`)
  } else {
    verdict = 'accept'
  }

  return { dimensions, trustScore, verdict, reasons }
}
