// Scoring Engine (Sprint 4) — Brain Engine'in ortak puanlama katmanı:
// Importance / Freshness / Decay / Ranking. TAMAMEN SAF fonksiyonlar —
// DB ve runtime bağımlılığı yok, her yerden import edilebilir ve env'siz
// test edilir. Search/Context/Update motorları puanı BURADAN alır; ikinci
// bir puanlama formülü başka dosyada yaşayamaz (tek doğruluk kaynağı).
//
// DECAY STRATEJİSİ (mimari karar): decay VERİYİ DEĞİŞTİRMEZ — hiçbir node
// silinmez, statüsü otomatik düşürülmez ("bilgi silinmez, eskitilir"
// ilkesi). Decay yalnız SIRALAMA anında uygulanır: eskiyen ve doğrulanmayan
// bilgi retrieval'da geriye düşer ama sorgulanabilir kalır. Tabanı (DECAY_FLOOR)
// sıfır değildir — çok eski bilgi bile asla tamamen görünmez olmaz.

import type { NodeStatus, NodeType } from './types'

// ── Importance ──────────────────────────────────────────────────────────────

/** Tip ağırlıkları [0,1] — "bu tür bilgi ne kadar merkezi". Kimlik/tercih/
 *  hedef Reborn'un temel sorusunun çekirdeğidir (en yüksek); ham sinyal ve
 *  serbest not en düşüktür. Yeni tip eklemek = burada ağırlık seçmek
 *  (Record derleyici tarafından tam kapsanmaya zorlanır). */
export const TYPE_IMPORTANCE: Record<NodeType, number> = {
  // Personal çekirdek:
  identity: 1.0,
  goal: 0.95,
  preference: 0.9,
  decision: 0.85,
  project: 0.8,
  person: 0.75,
  reflection: 0.75,
  habit: 0.7,
  journal: 0.65,
  essay: 0.6,
  event: 0.6,
  task: 0.55,
  resource: 0.5,
  note: 0.5,
  // Agent Brain:
  standard: 0.9,
  skill: 0.85,
  workflow: 0.85,
  pattern: 0.8,
  template: 0.8,
  fact: 0.75,
  repository: 0.7,
  tool_reference: 0.7,
  learning_record: 0.6,
  signal: 0.35,
}

/** Statü ağırlıkları — yaşam döngüsünde yükseldikçe bilgi güçlenir;
 *  'eskimiş' bilinçli sert düşer (yerini alan node zincirde, bkz. supersedes). */
export const STATUS_WEIGHT: Record<NodeStatus, number> = {
  güvenilir: 1.0,
  doğrulanmış: 0.9,
  aday: 0.7,
  gözlemlenen: 0.5,
  eskimiş: 0.15,
}

/** Bağ/doğrulama katkılarının üst sınırları — importance [0,1] kalır. */
const DEGREE_BONUS_MAX = 0.15
const CONFIDENCE_BONUS_MAX = 0.1

export interface ImportanceInput {
  type: NodeType
  status: NodeStatus
  /** Node'un graf derecesi (kenar sayısı) — bağlantılı bilgi önemlidir. */
  linkDegree?: number
  confidenceCount?: number
}

/**
 * importance = tipAğırlığı × statüAğırlığı + bağBonusu + doğrulamaBonusu, [0,1].
 * Bonuslar logaritmik doyar: 3 kenar ile 30 kenar arasında uçurum olmaz —
 * "çok bağlantılı" sinyali erken doyuma ulaşır, spam-bağ importance şişiremez.
 */
export function computeImportance(input: ImportanceInput): number {
  const base = TYPE_IMPORTANCE[input.type] * STATUS_WEIGHT[input.status]
  const degree = Math.max(0, input.linkDegree ?? 0)
  const confidence = Math.max(0, input.confidenceCount ?? 0)
  const degreeBonus = DEGREE_BONUS_MAX * (1 - 1 / (1 + Math.log1p(degree)))
  const confidenceBonus = CONFIDENCE_BONUS_MAX * (1 - 1 / (1 + Math.log1p(confidence)))
  return Math.min(1, base + degreeBonus + confidenceBonus)
}

// ── Freshness ───────────────────────────────────────────────────────────────

/** Yarı ömür: 45 günde tazelik yarıya iner. Chat retrieval'ın 30 günlük
 *  recency'sinden (lib/ai/retrieval.ts) bilinçli daha yavaş: retrieval "yeni
 *  olanı öne al" der, Brain decay'i "eskiyen bilgiyi yavaşça geriye düşür". */
export const FRESHNESS_HALF_LIFE_DAYS = 45

/** exp decay [0,1]: anchor (last_verified_at ya da updated_at — çağıran
 *  seçer) şimdiyse 1, her yarı ömürde yarıya iner. Geçersiz tarih 0 sayılır. */
export function computeFreshness(anchorIso: string, nowMs: number = Date.now()): number {
  const anchor = Date.parse(anchorIso)
  if (Number.isNaN(anchor)) return 0
  const ageDays = Math.max(0, (nowMs - anchor) / 86_400_000)
  return 2 ** (-ageDays / FRESHNESS_HALF_LIFE_DAYS)
}

// ── Decay (ranking-time) ────────────────────────────────────────────────────

/** Decay tabanı: tazelik 0'a gitse bile skor importance'ın bu oranının
 *  altına inmez — hiçbir bilgi tamamen görünmez olmaz. */
export const DECAY_FLOOR = 0.2

/** Sıralama skoru: importance, tazelikle DECAY_FLOOR..1 aralığında ölçeklenir. */
export function decayedScore(importance: number, freshness: number): number {
  return importance * (DECAY_FLOOR + (1 - DECAY_FLOOR) * freshness)
}

// ── Ranking ─────────────────────────────────────────────────────────────────

/** Benzerlik ve kalıcı skoru birleştiren ağırlıklar: benzerlik esas sinyaldir
 *  (sorguya cevap), decay'li importance ikincil düzelticidir. */
export const RANK_SIMILARITY_WEIGHT = 0.7
export const RANK_NODE_WEIGHT = 0.3

export interface RankableItem {
  type: NodeType
  status: NodeStatus
  /** Tazelik çapası — last_verified_at (Agent) ya da updated_at (Personal). */
  freshnessAnchor: string
  linkDegree?: number
  confidenceCount?: number
  /** Sorgulu bağlamda kosinüs benzerliği; sorgusuz sıralamada verilmez. */
  similarity?: number
}

/** Tek kalemin sıralama skoru: sorgulu bağlamda benzerlik + decay'li
 *  importance harmanı; sorgusuz bağlamda yalnız decay'li importance. */
export function rankScore(item: RankableItem, nowMs: number = Date.now()): number {
  const importance = computeImportance(item)
  const nodeScore = decayedScore(importance, computeFreshness(item.freshnessAnchor, nowMs))
  if (item.similarity === undefined) return nodeScore
  return RANK_SIMILARITY_WEIGHT * item.similarity + RANK_NODE_WEIGHT * nodeScore
}

/** Kalemleri rankScore'a göre (büyükten küçüğe) sıralar — kararlı kopya döner. */
export function rankItems<T extends RankableItem>(items: T[], nowMs: number = Date.now()): T[] {
  return items
    .map((item) => ({ item, score: rankScore(item, nowMs) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item)
}
