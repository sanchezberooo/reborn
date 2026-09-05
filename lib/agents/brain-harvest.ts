// Brain hasadı — ajan çıktısından Agent Brain'e NE yazılacağının KURALLARI
// (Paket C1 / TASK C1.3).
//
// NEDEN ÖNEMLİ: Brain'e giren her alakasız kayıt retrieval'ı bozar ve
// Sanchez'in her cevabı biraz daha kötüleşir. Hacim değil DAMITMA değerlidir.
// Bu yüzden kurallar prompt talimatı DEĞİL koddur: model "şunu yaz" diyebilir,
// yazılıp yazılmayacağına burası karar verir.
//
// ── Karar hattı (sırayla, ilk düşen keser) ─────────────────────────────────
//  1. Run VERIFY'ı geçti mi?  Geçmediyse HİÇBİR aday değerlendirilmez.
//  2. Ajanın departmanı brain.contribute taşıyor mu?  (default-deny)
//  3. Aday şekli geçerli mi?  (tip + içerik)
//  4. Kalite kapısı (lib/knowledge/quality.ts computeAgentOutputQuality):
//     accept → yazılır · review → YAZILIR ama inceleme işaretiyle ·
//     reject → YAZILMAZ.
//
// ── Neden 'review' de yazılıyor ────────────────────────────────────────────
// Bu depoda inceleme kuyruğu AYRI BİR TABLO DEĞİLDİR (lib/knowledge/
// review-queue.ts): kuyruk, status='aday' olan ve tanınan bir metadata zarfı
// taşıyan entities satırlarının GÖRÜNÜMÜDÜR. quality.ts'in kendi notu da
// bunu söyler: "review — Brain'e YİNE yazılır". Yani "review-queue'ya düşsün"
// = "aday statüsünde yaz ve işaretle", "Brain'in dışında bir yere koy" değil.
// Zaten Agent Brain'e bu kapıdan giren her node status='aday' doğar: güvenilir
// bilgi DEĞİLDİR, scoring'de düşük ağırlık taşır ve terfisi insan kararıdır.
//
// ── Reddedilen aday nereye gider ───────────────────────────────────────────
// Brain'e HİÇBİR ŞEY yazılmaz; sessizce de düşmez: sonuçta gerekçesiyle
// döner (çağıran raporlar) ve knowledge_rejected olayı yayınlanır — mevcut
// olay sözlüğü, yeni tablo yok.
//
// SAF KATMAN / YAZMA KATMANI ayrımı bilinçlidir: kararı veren fonksiyonlar
// (decideHarvest, parseCandidates) DB'siz test edilir; harvestToBrain yalnız
// o kararı uygular.

import type { AgentDefinition } from './types'
import type { QualityReport } from '../knowledge/types'
import { computeAgentOutputQuality } from '../knowledge/quality'
import { departmentEffect, getDepartment } from '../departments/registry'
import { COLD_NODE_TYPES } from '../brain/types'
import type { ColdNodeType } from '../brain/types'

/** Ajanın "bunu Brain'e yaz" niyetini bildirdiği ÜST SEVİYE çıktı alanı.
 *
 *  NEDEN ALAN, NEDEN YENİ TOOL DEĞİL:
 *   * Kural seti kod olmalı: alan, VERIFY'dan GEÇMİŞ çıktının parçasıdır ve
 *     hasat run bittikten sonra tek yerde deterministik işler. Tool ise
 *     modelin istediği an tetiklediği, doğrulanmamış bir yan etkidir.
 *   * brain_integrate genişletilemez: validateRoster (lib/departments/
 *     registry.ts) 'brain.integrate' yeteneğini yalnız knowledge
 *     departmanında izinli sayar; başka ajana vermek o değişmezi kırardı.
 *   * Alan outputSchema ile doğrulanabilir — sözleşmenin bir parçası olur.
 */
export const BRAIN_CANDIDATES_FIELD = 'brainCandidates'

/** Tek bir aday için üst sınır — model keyfi uzun metin gönderemesin. */
export const CANDIDATE_CONTENT_MAX = 4000
/** Bir run'dan en fazla kaç aday alınır (damıtma disiplini). */
export const MAX_CANDIDATES_PER_RUN = 5

export interface BrainCandidate {
  type: ColdNodeType
  title: string
  content: string
  /** Ajanın beyanı: bu bilgi başka görevlerde de işe yarar mı? Beyan tek
   *  başına yeterli DEĞİLDİR — kalite kapısı metin sinyalleriyle harmanlar. */
  reusable: boolean
}

export interface HarvestOrigin {
  runId: string
  agentName: string
  taskId?: string
}

/** Node'un metadata zarfı — köken burada yaşar.
 *
 *  NEDEN KENAR DEĞİL METADATA: links iki entities satırını bağlar; agent_run
 *  ve agent_task entity DEĞİLDİR, dolayısıyla köken graf kenarı olarak
 *  ifade EDİLEMEZ (yeni tablo açmadan). metadata containment ile
 *  sorgulanabilir ve knowledge zarflarının (knowledge-item/-extraction)
 *  deseniyle aynıdır. Semantik komşuluk bağları ayrıca autoLinkNode'dan
 *  gelir — applyBrainUpdate onu zaten çağırır. */
export type AgentOutputMeta = {
  kind: 'agent-output'
  origin: HarvestOrigin
  trustScore: number
  qualityVerdict: QualityReport['verdict']
  quality: QualityReport['dimensions']
  reusableClaim: boolean
  harvestedAt: string
}

export type CandidateDecision =
  | { accepted: true; candidate: BrainCandidate; quality: QualityReport }
  | { accepted: false; candidate: BrainCandidate | null; reason: string; quality?: QualityReport }

export interface HarvestPlan {
  /** Ajanın departmanı katkı yetkisi taşıyor mu. */
  allowed: boolean
  /** allowed=false ise gerekçe. */
  deniedReason?: string
  accepted: { candidate: BrainCandidate; quality: QualityReport }[]
  rejected: { candidate: BrainCandidate | null; reason: string; quality?: QualityReport }[]
}

/** Departman katkı yetkisi — default-deny, mevcut izin modelinin üstünde.
 *  İKİNCİ BİR İZİN SİSTEMİ DEĞİL: karar aynı DEPARTMENTS tablosundan çıkar. */
export function canContributeToBrain(agent: Pick<AgentDefinition, 'name' | 'department'>): boolean {
  const department = agent.department ? getDepartment(agent.department) : null
  if (!department) return false
  return departmentEffect(department, 'brain.contribute') === 'allowed'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Ajan çıktısından aday listesini ayıklar — SAF.
 *
 * Çıktının TAMAMI asla aday değildir: yalnız BRAIN_CANDIDATES_FIELD altındaki
 * açıkça işaretlenmiş parçalar okunur. Alan yoksa aday da yoktur (sessiz,
 * hata değil — ajanların çoğu Brain'e hiç yazmaz).
 *
 * Geçersiz şekilli girişler ATLANIR ve gerekçesiyle raporlanır; tek bozuk
 * eleman diğerlerini düşürmez.
 */
export function parseCandidates(output: unknown): {
  candidates: BrainCandidate[]
  invalid: { reason: string }[]
} {
  const candidates: BrainCandidate[] = []
  const invalid: { reason: string }[] = []

  if (!isRecord(output)) return { candidates, invalid }
  const raw = output[BRAIN_CANDIDATES_FIELD]
  if (raw === undefined || raw === null) return { candidates, invalid }
  if (!Array.isArray(raw)) {
    invalid.push({ reason: `${BRAIN_CANDIDATES_FIELD} bir dizi olmalı.` })
    return { candidates, invalid }
  }

  for (const entry of raw.slice(0, MAX_CANDIDATES_PER_RUN)) {
    if (!isRecord(entry)) {
      invalid.push({ reason: 'Aday bir nesne değil.' })
      continue
    }
    const { type, title, content, reusable } = entry
    if (typeof type !== 'string' || !(COLD_NODE_TYPES as readonly string[]).includes(type)) {
      invalid.push({ reason: `Geçersiz tip '${String(type)}' — geçerli: ${COLD_NODE_TYPES.join(', ')}.` })
      continue
    }
    if (typeof content !== 'string' || !content.trim()) {
      invalid.push({ reason: 'Aday içeriği boş.' })
      continue
    }
    candidates.push({
      type: type as ColdNodeType,
      title: typeof title === 'string' && title.trim() ? title.trim() : '',
      content: content.trim().slice(0, CANDIDATE_CONTENT_MAX),
      reusable: reusable === true,
    })
  }

  if (Array.isArray(raw) && raw.length > MAX_CANDIDATES_PER_RUN) {
    invalid.push({ reason: `Bir run'dan en fazla ${MAX_CANDIDATES_PER_RUN} aday alınır — fazlası atlandı.` })
  }
  return { candidates, invalid }
}

export interface HarvestDecisionInput {
  agent: Pick<AgentDefinition, 'name' | 'department'>
  output: unknown
  verifyPassed: boolean
  failedToolCallCount: number
  /** Aday başına Brain'deki benzerlik oranı [0,1]; bilinmiyorsa 0. */
  duplicationRateByIndex?: number[]
}

/**
 * Hasat kararı — SAF, DB'siz test edilebilir. Hiçbir şey YAZMAZ; ne
 * yazılacağını ve nelerin neden elendiğini döndürür.
 */
export function decideHarvest(input: HarvestDecisionInput): HarvestPlan {
  const plan: HarvestPlan = { allowed: true, accepted: [], rejected: [] }

  // 1. VERIFY kapısı — doğrulanmamış çalıştırmanın çıktısı ASLA yazılmaz.
  //    Bu, kalite kapısından ÖNCE gelir: puan hesaplamaya bile gerek yok.
  if (!input.verifyPassed) {
    plan.allowed = false
    plan.deniedReason = 'Çalıştırma VERIFY\'ı geçmedi — verify_failed run\'ın çıktısı Brain\'e yazılmaz.'
    return plan
  }

  // 2. Departman yetkisi (default-deny).
  if (!canContributeToBrain(input.agent)) {
    plan.allowed = false
    plan.deniedReason = `'${input.agent.name}' ajanının departmanı brain.contribute yeteneğine sahip değil.`
    return plan
  }

  // 3. Aday ayıklama.
  const { candidates, invalid } = parseCandidates(input.output)
  for (const bad of invalid) plan.rejected.push({ candidate: null, reason: bad.reason })

  // 4. Kalite kapısı — aday başına.
  candidates.forEach((candidate, index) => {
    const quality = computeAgentOutputQuality({
      content: candidate.content,
      title: candidate.title || candidate.content.slice(0, 60),
      verifyPassed: input.verifyPassed,
      failedToolCallCount: input.failedToolCallCount,
      claimedReusable: candidate.reusable,
      duplicationRate: input.duplicationRateByIndex?.[index] ?? 0,
    })

    if (quality.verdict === 'reject') {
      plan.rejected.push({
        candidate,
        reason: quality.reasons.join(' ') || 'Kalite kapısı reddetti.',
        quality,
      })
      return
    }
    // accept VE review yazılır — review zaten 'aday' statüsünün kendisidir
    // (dosya başı notu); ayrım metadata.qualityVerdict'te yaşar ve inceleme
    // kuyruğu onunla filtrelenir.
    plan.accepted.push({ candidate, quality })
  })

  return plan
}

/** Node'un metadata zarfını kurar — köken + kalite kararı tek yerde. */
export function buildAgentOutputMeta(
  origin: HarvestOrigin,
  candidate: BrainCandidate,
  quality: QualityReport,
  harvestedAt: string,
): AgentOutputMeta {
  return {
    kind: 'agent-output',
    origin,
    trustScore: quality.trustScore,
    qualityVerdict: quality.verdict,
    quality: quality.dimensions,
    reusableClaim: candidate.reusable,
    harvestedAt,
  }
}
