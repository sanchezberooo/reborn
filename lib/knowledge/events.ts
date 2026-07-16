// Knowledge Events (Sprint 5) — departmanın olay yayın katmanı. İKİNCİ BİR
// OLAY SİSTEMİ DEĞİLDİR: PascalCase Knowledge olay adları (sözleşme:
// lib/knowledge/types.ts KNOWLEDGE_EVENT_NAMES) tek yönlü sabitle runtime
// olay tiplerine (migration 0011 + lib/runtime/types.ts) eşlenir ve mevcut
// RuntimeEventBus'tan yayınlanır — Live State, runtime_events izi ve
// gelecekteki Office akışı knowledge olaylarını otomatik görür.
//
// Dayanıklılık bus'ın kendi sözleşmesidir: DB append hatası yayını düşürmez
// (event-bus üst notu); burada ek try/catch YOK — olay yayını pipeline'ın
// kontrol akışı değildir ama publish edilmiş sayılması bus'a emanettir.

import 'server-only'
import type { RuntimeEvent, RuntimeEventType } from '../runtime/types'
import type { KnowledgeEventName } from './types'

/** PascalCase sözleşme adı → runtime_events tipi (0011 CHECK listesi). */
export const KNOWLEDGE_EVENT_TYPE: Record<KnowledgeEventName, RuntimeEventType> = {
  KnowledgeAdded: 'knowledge_added',
  KnowledgeUpdated: 'knowledge_updated',
  KnowledgeReviewed: 'knowledge_reviewed',
  KnowledgeRejected: 'knowledge_rejected',
  SkillCreated: 'skill_created',
  WorkflowCreated: 'workflow_created',
  PatternCreated: 'pattern_created',
  SOPCreated: 'sop_created',
  TemplateCreated: 'template_created',
  // Sprint 6 (migration 0012):
  RepositoryImported: 'repository_imported',
  RepositoryUpdated: 'repository_updated',
  KnowledgeExtracted: 'knowledge_extracted',
  KnowledgeApproved: 'knowledge_approved',
}

export interface KnowledgeEventInput {
  name: KnowledgeEventName
  userId: string
  /** İlgili Brain node'u (varsa) — runtime_events'in ayrı kolonu yok, detail'de taşınır. */
  nodeId?: string
  detail?: Record<string, unknown>
}

/**
 * Knowledge olayını organizma omurgasına yayınlar. department her zaman
 * 'knowledge' — olayın sahibi departmandır; agentName bilinçli boş (pipeline
 * kod yoludur, bir LLM ajanı değil; Knowledge Agent kendi olaylarını kendi
 * bağlamıyla üretmeye devam eder).
 */
export async function publishKnowledgeEvent(input: KnowledgeEventInput): Promise<RuntimeEvent> {
  const { getRuntime } = await import('../runtime/manager')
  return getRuntime().bus.publish({
    type: KNOWLEDGE_EVENT_TYPE[input.name],
    department: 'knowledge',
    userId: input.userId,
    detail: {
      ...(input.nodeId ? { nodeId: input.nodeId } : {}),
      ...(input.detail ?? {}),
    },
  })
}
