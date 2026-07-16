// Knowledge Search API (Sprint 5) — app/api/search deseniyle tutarlı:
// doğrulama route'ta, iş mantığı lib katmanında (searchKnowledge →
// lib/knowledge/search.ts, Brain Search sarmalayıcısı). Salt okunur.
//
// GET /api/knowledge/search?q=...&mode=hybrid&kinds=item,skill&limit=10

import { searchKnowledge, KNOWLEDGE_SEARCH_KINDS } from '@/lib/knowledge/search'
import type { KnowledgeSearchKind } from '@/lib/knowledge/search'

const MODES = ['semantic', 'graph', 'hybrid'] as const
type Mode = (typeof MODES)[number]

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const q = params.get('q') ?? ''

  const modeRaw = params.get('mode') ?? 'hybrid'
  if (!(MODES as readonly string[]).includes(modeRaw)) {
    return Response.json(
      { error: `mode ${MODES.join(' | ')} olmalı — '${modeRaw}' geçersiz.` },
      { status: 400 },
    )
  }

  let kinds: KnowledgeSearchKind[] | undefined
  const kindsRaw = params.get('kinds')
  if (kindsRaw) {
    const requested = kindsRaw.split(',').map((k) => k.trim()).filter(Boolean)
    const invalid = requested.filter((k) => !(KNOWLEDGE_SEARCH_KINDS as string[]).includes(k))
    if (invalid.length > 0) {
      return Response.json(
        { error: `kinds ${KNOWLEDGE_SEARCH_KINDS.join(' | ')} olmalı — geçersiz: ${invalid.join(', ')}.` },
        { status: 400 },
      )
    }
    kinds = requested as KnowledgeSearchKind[]
  }

  const limitRaw = Number(params.get('limit') ?? '10')
  const limit = Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 10

  try {
    const results = await searchKnowledge(q, { mode: modeRaw as Mode, kinds, limit })
    return Response.json({ results })
  } catch (error) {
    console.error('[api/knowledge/search] GET hata:', error)
    return Response.json({ error: 'Knowledge araması başarısız.' }, { status: 500 })
  }
}
