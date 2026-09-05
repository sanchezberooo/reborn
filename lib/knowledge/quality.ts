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

// ── Ajan çıktısı kalite kapısı (Paket C1 / TASK C1.3) ───────────────────────
//
// NEDEN AYRI GİRİŞ, NEDEN YENİ SİSTEM DEĞİL: computeQuality DIŞ KAYNAK
// yutumu için tasarlandı — girdisi sourceType/publishedAt/citationCount/
// chunkCount'tur ve SOURCE_TYPE_RELIABILITY anahtarı KnownSourceType'tır
// (github/pdf/website…). Ajan çıktısında bunların hiçbiri yok; oraya
// 'agent' diye bir kaynak türü eklemek onu FETCH EDİLEBİLİR kaynaklar
// sözlüğüne (source-fetcher) sokardı ve publishedAt/citationCount gibi
// alanlar uydurma değerlerle doldurulurdu.
//
// Bu yüzden ikinci bir GİRİŞ açıldı, ikinci bir sistem değil: aynı boyutlar
// (QualityDimensions), aynı ağırlıklar (QUALITY_WEIGHTS), aynı eşikler
// (REJECT/REVIEW), aynı çıktı tipi (QualityReport). Değişen tek şey
// boyutların NEREDEN okunduğu — dış kaynağın üst-verisi yerine
// çalıştırmanın kendi gerçekleri.
//
// TAMAMEN SAF: DB, env, LLM yok — karar DB'siz test edilebilir.

/** Yeniden kullanılabilirlik kapısının alt sınırı: bu değerin altındaki aday
 *  Brain'e HİÇ girmez. Ajan çıktısında 'tek seferlik durum bilgisi' en sık
 *  çöp kaynağıdır (bkz. applicability).
 *
 *  0.5 kalibre edildi: ajanın reusable işaretini KOYMADIĞI aday bu sınırın
 *  altında kalır. Alan tam olarak "yazılacak parça açıkça işaretlenmeli"
 *  ilkesi için var — işaretlenmemiş aday, ağırlıklı puanı ne olursa olsun
 *  girmemeli. */
export const AGENT_REUSABILITY_FLOOR = 0.5

/** Bu uzunluğun altındaki içerik tek başına yeniden kullanılabilir bilgi
 *  TAŞIYAMAZ (bir cümlelik durum notu). Ağırlıklı puanın kurtarmasına izin
 *  verilmez — kesin ret. */
export const AGENT_CONTENT_MIN_CHARS = 80

export interface AgentOutputQualityInput {
  /** Brain'e aday gösterilen metin. */
  content: string
  /** Adayın başlığı — boş/çok kısa başlık kullanılabilirliği düşürür. */
  title: string
  /** Çalıştırmanın VERIFY sonucu. false ise çağıran zaten yazmamalı; burada
   *  ikinci savunma hattıdır (reject'e zorlar). */
  verifyPassed: boolean
  /** Bu run'da hata dönen tool çağrısı sayısı — çıktının dayandığı zeminin
   *  ne kadar sağlam olduğunun ölçüsü. */
  failedToolCallCount: number
  /** Ajanın kendi beyanı: bu bilgi başka görevlerde de işe yarar mı?
   *  Beyan TEK BAŞINA yeterli değildir — metin sinyalleriyle harmanlanır. */
  claimedReusable: boolean
  /** Adayın Brain'de zaten benzeri var mı [0,1]; çağıran ölçemiyorsa 0. */
  duplicationRate: number
}

/** Tek seferlik durum bildiren kalıplar: "bu run'da şu oldu" cümleleri
 *  Brain'e değil agent_runs'a aittir. Küçük ve OKUNUR tutuldu — niyet,
 *  kapsamlı bir dil modeli değil, bariz olanı kesmek. */
const ONE_OFF_MARKERS = [
  'bu çalıştırmada', 'bu run', 'bu görevde', 'şu an', 'şimdilik',
  'bugün itibarıyla', 'geçici olarak', 'test amaçlı',
]

/**
 * Ajan çıktısından doğan bir Brain adayının kalite kararı.
 *
 * Boyutların ajan tarafındaki karşılıkları:
 *  * reliability   — çalıştırmanın sağlamlığı (verify + tool hataları).
 *  * currency      — her zaman 1: aday ŞU AN üretildi, eskime yok.
 *  * repetition    — 1 − duplicationRate (dış kaynakla aynı).
 *  * usability     — metin yapısı (uzunluk, başlık, satır düzeni).
 *  * sourceQuality — köken bütünlüğü (başlık var mı, içerik anlamlı mı).
 *  * applicability — YENİDEN KULLANILABİLİRLİK: beyan + tek-seferlik dil
 *    işaretlerinin yokluğu. Kapının asıl ağırlığı burada.
 */
export function computeAgentOutputQuality(input: AgentOutputQualityInput): QualityReport {
  const reasons: string[] = []
  const content = input.content.trim()
  const title = input.title.trim()
  const lower = content.toLocaleLowerCase('tr')

  // Güvenilirlik: doğrulanmış çalıştırma tabanı; her hatalı tool çağrısı düşürür.
  let reliability = input.verifyPassed ? 0.8 : 0
  reliability = clamp01(reliability - Math.min(0.4, input.failedToolCallCount * 0.15))
  if (!input.verifyPassed) {
    reasons.push('Çalıştırma VERIFY\'ı geçmedi — doğrulanmamış çıktı Brain\'e aday olamaz.')
  } else if (input.failedToolCallCount > 0) {
    reasons.push(`${input.failedToolCallCount} tool çağrısı hata döndü — güvenilirlik düştü.`)
  }

  // Güncellik: ajan çıktısının yayın tarihi YOKTUR — bu boyut burada
  // ölçülemez. 1.0 vermek her adaya koşulsuz 0.15 puan hediye ederdi ve
  // ağırlıklı harmanı yukarı kaydırırdı; modülün kendi sözleşmesi bu durum
  // için zaten nötr değeri tanımlıyor (CURRENCY_UNKNOWN — "bilinmeyen tarih
  // ceza değildir"). Aynı sabit kullanılıyor, ikinci bir kural icat edilmiyor.
  const currency = CURRENCY_UNKNOWN

  const repetition = clamp01(1 - input.duplicationRate)
  if (input.duplicationRate > 0.5) {
    reasons.push(`Brain'de %${Math.round(input.duplicationRate * 100)} benzer kayıt var — tekrar boyutu düşük.`)
  }

  // Kullanılabilirlik: çok kısa metin bilgi taşımaz, yapı sinyali artırır.
  const lineCount = content.split('\n').filter((l) => l.trim()).length
  const usability = clamp01(
    (content.length >= 120 ? 0.45 : content.length >= 40 ? 0.25 : 0)
    + (title.length >= 8 ? 0.2 : 0)
    + (lineCount > 1 ? 0.15 : 0)
    + saturating(Math.floor(content.length / 200), 0.2),
  )
  if (content.length < 40) reasons.push('İçerik çok kısa — tek başına bilgi taşımıyor.')

  // Kaynak kalitesi: köken bütünlüğü (başlık + anlamlı gövde).
  const sourceQuality = clamp01(
    0.4 + (title.length >= 8 ? 0.3 : 0) + (content.length >= 120 ? 0.3 : 0),
  )

  // Uygulanabilirlik = yeniden kullanılabilirlik testi.
  const oneOffHits = ONE_OFF_MARKERS.filter((marker) => lower.includes(marker)).length
  const applicability = clamp01(
    (input.claimedReusable ? 0.6 : 0.2)
    + (content.length >= 120 ? 0.2 : 0)
    - Math.min(0.5, oneOffHits * 0.25),
  )
  if (oneOffHits > 0) {
    reasons.push('Metin tek seferlik durum bildiriyor — bu bilgi agent_runs\'ta kalmalı, Brain\'e girmemeli.')
  }
  if (!input.claimedReusable) {
    reasons.push('Ajan bu kaydı yeniden kullanılabilir olarak işaretlemedi.')
  }

  const dimensions: QualityDimensions = {
    reliability, currency, repetition, usability, sourceQuality, applicability,
  }
  const trustScore = clamp01(
    (Object.keys(QUALITY_WEIGHTS) as (keyof QualityDimensions)[])
      .reduce((sum, key) => sum + QUALITY_WEIGHTS[key] * dimensions[key], 0),
  )

  // Karar: aynı eşikler, iki ek KESİN ret koşuluyla — doğrulanmamış
  // çalıştırma ve yeniden kullanılamaz bilgi puanı ne olursa olsun girmez.
  let verdict: QualityVerdict
  if (!content) {
    verdict = 'reject'
    reasons.push('İçerik boş.')
  } else if (!input.verifyPassed) {
    verdict = 'reject'
  } else if (content.length < AGENT_CONTENT_MIN_CHARS) {
    verdict = 'reject'
    reasons.push(`İçerik ${content.length} karakter < ${AGENT_CONTENT_MIN_CHARS} — tek başına yeniden kullanılabilir bilgi taşımıyor.`)
  } else if (applicability < AGENT_REUSABILITY_FLOOR) {
    verdict = 'reject'
    reasons.push(`Yeniden kullanılabilirlik ${applicability.toFixed(2)} < ${AGENT_REUSABILITY_FLOOR} — tek seferlik bilgi Brain'e girmez.`)
  } else if (trustScore < REJECT_THRESHOLD) {
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
