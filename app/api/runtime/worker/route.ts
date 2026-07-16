// /api/runtime/worker — Worker Engine kontrol yüzeyi (Sprint 3, madde 1).
// Worker OTOMATİK BAŞLAMAZ: LLM çalıştırmaları maliyetlidir ve kontrol
// kullanıcıdadır (değişmez filtre 4) — start açık insan kararıdır.
//   GET  → worker bilgisi (hiç kurulmadıysa null)
//   POST → { action: 'start' | 'stop' | 'tick' }
//     start: sürekli tick döngüsünü başlatır
//     stop:  nazik durdurma (uçuştaki tick biter, yenisi başlamaz)
//     tick:  tek deterministik adım — worker başlatmadan kuyruğu elle ilerlet

import { getRuntime } from '@/lib/runtime/manager'

export async function GET() {
  return Response.json({ worker: getRuntime().workerInfo() })
}

export async function POST(req: Request) {
  const { action } = (await req.json()) as { action?: string }
  const runtime = getRuntime()

  try {
    switch (action) {
      case 'start':
        return Response.json({ worker: await runtime.startWorker() })
      case 'stop':
        return Response.json({ worker: await runtime.stopWorker() })
      case 'tick': {
        const summary = await runtime.tickOnce()
        return Response.json({ summary, worker: runtime.workerInfo() })
      }
      default:
        return Response.json(
          { error: `Geçersiz action '${String(action)}' — start | stop | tick bekleniyor.` },
          { status: 400 },
        )
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Worker aksiyonu başarısız.' },
      { status: 500 },
    )
  }
}
