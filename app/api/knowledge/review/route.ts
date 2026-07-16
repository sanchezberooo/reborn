// Knowledge Review API (Sprint 6) — Review Queue'nun backend yüzü.
//   GET  ?kind=&reviewed=&limit=   → kuyruk / geçmiş listesi
//   POST { nodeId, decision, reviewer?, note? } → karar uygulanır
// Karar bilinçli insan/ajan adımıdır (registry.reviewKnowledgeNode) —
// bu route asla otomatik karar vermez.

import { listReviewQueue } from '@/lib/knowledge/review-queue'
import { reviewKnowledgeNode } from '@/lib/knowledge/registry'
import type { ReviewDecision } from '@/lib/knowledge/registry'
import { EXTRACTION_KINDS } from '@/lib/knowledge/types'
import type { ExtractionKind } from '@/lib/knowledge/types'

const DECISIONS = ['approve', 'trust', 'reject'] as const
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams

  const kindRaw = params.get('kind') ?? undefined
  if (kindRaw !== undefined && !(EXTRACTION_KINDS as readonly string[]).includes(kindRaw)) {
    return Response.json(
      { error: `kind ${EXTRACTION_KINDS.join(' | ')} olmalı — '${kindRaw}' geçersiz.` },
      { status: 400 },
    )
  }
  const limitRaw = Number(params.get('limit') ?? '25')

  try {
    const entries = await listReviewQueue({
      kind: kindRaw as ExtractionKind | undefined,
      reviewed: params.get('reviewed') === 'true',
      limit: Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 25,
    })
    return Response.json({ entries })
  } catch (error) {
    console.error('[api/knowledge/review] GET hata:', error)
    return Response.json({ error: 'İnceleme kuyruğu okunamadı.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Geçerli bir JSON gövdesi gerekli.' }, { status: 400 })
  }

  const { nodeId, decision, reviewer, note } = body
  if (typeof nodeId !== 'string' || !UUID_RE.test(nodeId)) {
    return Response.json({ error: 'nodeId geçerli bir UUID olmalı.' }, { status: 400 })
  }
  if (typeof decision !== 'string' || !(DECISIONS as readonly string[]).includes(decision)) {
    return Response.json({ error: `decision ${DECISIONS.join(' | ')} olmalı.` }, { status: 400 })
  }

  try {
    const node = await reviewKnowledgeNode(nodeId, decision as ReviewDecision, {
      reviewer: typeof reviewer === 'string' ? reviewer : undefined,
      note: typeof note === 'string' ? note : undefined,
    })
    return Response.json({ nodeId: node.id, status: node.status })
  } catch (error) {
    console.error('[api/knowledge/review] POST hata:', error)
    return Response.json({ error: 'İnceleme kararı uygulanamadı.' }, { status: 500 })
  }
}
