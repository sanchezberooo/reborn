// Brain hasadının YAZMA katmanı (Paket C1 / TASK C1.3). Karar katmanı
// lib/agents/brain-harvest.ts'tedir ve SAFTIR; burası yalnız o kararı uygular.
// Ayrım bilinçli: "ne yazılmalı" DB'siz test edilebilmeli, "nasıl yazılır"
// ayrı bir kaygı olmalı.
//
// YENİ DEPOLAMA YOK: node'lar mevcut tek kapıdan (lib/brain/update-engine
// applyBrainUpdate) geçer — dedup/supersede/autoLink/çakışma tespiti oradan
// gelir. İkinci bir yazma yolu, ikinci bir dedup formülü açılmadı.
//
// Reddedilen adaylar SESSİZCE DÜŞMEZ: her biri için knowledge_rejected
// olayı yayınlanır (mevcut olay sözlüğü — migration 0011) ve sonuçta
// gerekçesiyle döner.

import 'server-only'
import { applyBrainUpdate } from '../brain/update-engine'
import { getAgent } from './registry'
import { buildAgentOutputMeta, decideHarvest } from './brain-harvest'
import type { BrainCandidate, HarvestOrigin } from './brain-harvest'
import type { QualityReport } from '../knowledge/types'

export interface HarvestWriteResult {
  /** Departman yetkisi veya VERIFY kapısı yüzünden hiç denenmediyse false. */
  attempted: boolean
  deniedReason?: string
  written: {
    nodeId: string
    type: string
    action: 'created' | 'confirmed' | 'superseded'
    verdict: QualityReport['verdict']
    trustScore: number
    /** review → inceleme kuyruğunda görünür (status='aday' + zarf). */
    needsReview: boolean
  }[]
  rejected: { title: string; reason: string }[]
}

export interface HarvestInput {
  agentName: string
  userId: string
  output: unknown
  verifyPassed: boolean
  failedToolCallCount: number
  origin: HarvestOrigin
}

/**
 * Ajan çıktısını Brain'e hasat eder. ASLA FIRLATMAZ: hasat, çalıştırmanın
 * yan ürünüdür — bir adayın yazılamaması run'ı düşürmemelidir (tool hata
 * sözleşmesiyle aynı ilke, lib/agents/tool-loop.ts).
 */
export async function harvestToBrain(input: HarvestInput): Promise<HarvestWriteResult> {
  const result: HarvestWriteResult = { attempted: false, written: [], rejected: [] }

  const agent = getAgent(input.agentName)
  if (!agent) {
    result.deniedReason = `Ajan bulunamadı: ${input.agentName}`
    return result
  }

  const plan = decideHarvest({
    agent,
    output: input.output,
    verifyPassed: input.verifyPassed,
    failedToolCallCount: input.failedToolCallCount,
  })

  if (!plan.allowed) {
    result.deniedReason = plan.deniedReason
    return result
  }
  result.attempted = true

  for (const entry of plan.rejected) {
    result.rejected.push({ title: entry.candidate?.title ?? '(geçersiz aday)', reason: entry.reason })
    await publishRejected(input, entry.candidate, entry.reason)
  }

  const harvestedAt = new Date().toISOString()
  for (const { candidate, quality } of plan.accepted) {
    try {
      const update = await applyBrainUpdate({
        userId: input.userId,
        scope: 'agent',
        type: candidate.type,
        title: candidate.title || undefined,
        content: candidate.content,
        // status verilmez: Agent Brain varsayılanı 'aday'dır — hasat edilen
        // bilgi güvenilir DEĞİLDİR, terfi ayrı ve bilinçli bir karardır.
        metadata: buildAgentOutputMeta(input.origin, candidate, quality, harvestedAt),
      })
      result.written.push({
        nodeId: update.node.id,
        type: update.node.type,
        action: update.action,
        verdict: quality.verdict,
        trustScore: quality.trustScore,
        needsReview: quality.verdict === 'review',
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.error(`[Reborn brain-harvest] '${candidate.title}' yazılamadı:`, reason)
      result.rejected.push({ title: candidate.title, reason: `Yazma hatası: ${reason}` })
    }
  }

  return result
}

/** Reddedilen aday izi — mevcut olay omurgasından, yeni tablo yok. */
async function publishRejected(
  input: HarvestInput,
  candidate: BrainCandidate | null,
  reason: string,
): Promise<void> {
  try {
    const { getRuntime } = await import('../runtime/manager')
    await getRuntime().bus.publish({
      type: 'knowledge_rejected',
      agentName: input.agentName,
      taskId: input.origin.taskId,
      userId: input.userId,
      detail: {
        runId: input.origin.runId,
        title: candidate?.title ?? null,
        candidateType: candidate?.type ?? null,
        reason,
      },
    })
  } catch (err) {
    // İz yazımı hasadı düşürmez (audit deseni).
    console.error('[Reborn brain-harvest] red olayı yayınlanamadı:', err)
  }
}
