// Global semantik arama (Faz 3) — app/api/goals/route.ts deseniyle tutarlı:
// doğrulama route'ta, iş mantığı lib katmanında (searchEntities →
// lib/ai/retrieval.ts, hybridRetrieve'in ince sarmalayıcısı). Salt okunur;
// yazma katmanına dokunmaz.

import { resolveSingleUserId } from '@/lib/db-server'
import { searchEntities } from '@/lib/ai/retrieval'

const MAX_LIMIT = 10

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? ''

  try {
    const userId = await resolveSingleUserId()
    const results = await searchEntities(q, { userId, limit: MAX_LIMIT })
    return Response.json({ results })
  } catch (error) {
    console.error('[api/search] GET hata:', error)
    return Response.json({ error: 'Arama başarısız.' }, { status: 500 })
  }
}
