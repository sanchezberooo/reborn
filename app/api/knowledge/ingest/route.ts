// Knowledge Ingestion API (Sprint 6) — app/api/knowledge/search deseniyle
// tutarlı: doğrulama route'ta, iş mantığı lib katmanında (ingestion.ts).
// İki kapı, tek route:
//   POST { sourceType:'github', sourceUrl }             → repo içe alımı
//   POST { sourceType:'markdown', content, format?, … } → inline belge
// Worker/otomasyon YOK — içe alım insan-tetikli bilinçli bir eylemdir
// (Sprint 3 "worker otomatik başlamaz" ilkesiyle aynı damar).

import { ingestGitHubRepository, ingestInlineDocument } from '@/lib/knowledge/ingestion'
import { DOCUMENT_FORMATS } from '@/lib/knowledge/types'
import type { DocumentFormat } from '@/lib/knowledge/types'
import { KNOWN_SOURCE_TYPES } from '@/lib/knowledge/source-fetcher'
import type { KnownSourceType } from '@/lib/knowledge/source-fetcher'

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Geçerli bir JSON gövdesi gerekli.' }, { status: 400 })
  }

  const sourceType = typeof body.sourceType === 'string' ? body.sourceType : 'github'
  if (!(KNOWN_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    return Response.json(
      { error: `sourceType ${KNOWN_SOURCE_TYPES.join(' | ')} olmalı — '${sourceType}' geçersiz.` },
      { status: 400 },
    )
  }
  if (body.format !== undefined
    && (typeof body.format !== 'string' || !(DOCUMENT_FORMATS as readonly string[]).includes(body.format))) {
    return Response.json(
      { error: `format ${DOCUMENT_FORMATS.join(' | ')} olmalı.` },
      { status: 400 },
    )
  }

  try {
    if (sourceType === 'github') {
      if (typeof body.sourceUrl !== 'string' || !body.sourceUrl.trim()) {
        return Response.json({ error: 'github içe alımı için sourceUrl zorunlu.' }, { status: 400 })
      }
      const result = await ingestGitHubRepository(body.sourceUrl)
      if ('ok' in result) return Response.json({ error: result.error }, { status: 422 })
      return Response.json({ result })
    }

    if (typeof body.content !== 'string' || !body.content.trim()) {
      return Response.json({ error: `${sourceType} içe alımı için content zorunlu.` }, { status: 400 })
    }
    const result = await ingestInlineDocument({
      sourceType: sourceType as KnownSourceType,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : null,
      content: body.content,
      format: body.format as DocumentFormat | undefined,
      language: typeof body.language === 'string' ? body.language : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
      author: typeof body.author === 'string' ? body.author : undefined,
      version: typeof body.version === 'string' ? body.version : undefined,
      publishedAt: typeof body.publishedAt === 'string' ? body.publishedAt : undefined,
      tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : undefined,
    })
    if ('ok' in result) return Response.json({ error: result.error }, { status: 422 })
    return Response.json({ result })
  } catch (error) {
    console.error('[api/knowledge/ingest] POST hata:', error)
    return Response.json({ error: 'İçe alım başarısız.' }, { status: 500 })
  }
}
