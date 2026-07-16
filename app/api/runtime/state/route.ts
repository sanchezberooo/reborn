// GET /api/runtime/state — organizmanın canlı durum fotoğrafı (Sprint 3,
// madde 10). Office ekranı (Sprint 4+) bu sözleşmeyi okuyacak; bu sprintte
// yalnız backend yüzeyidir, hiçbir UI buna bağlanmadı.

import { getRuntime } from '@/lib/runtime/manager'

export async function GET() {
  try {
    const snapshot = await getRuntime().snapshot()
    return Response.json(snapshot)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Runtime durumu okunamadı.' },
      { status: 500 },
    )
  }
}
