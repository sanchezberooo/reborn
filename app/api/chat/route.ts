import { runSanchezTurn } from '@/lib/sanchez/core'
import type { SanchezTurnRequest } from '@/lib/sanchez/types'
import type { ChatEvent } from '@/lib/chat-events'

// /api/chat — Sanchez'in NDJSON taşıyıcısı. Bu route yalnız HTTP zarfıdır:
// gövdeyi ayrıştırır, olayları NDJSON satırlarına çevirir, stream'i kapatır.
// Orkestrasyonun tamamı (observe → … → brain-update pipeline'ı, tool
// döngüsü, hata sözleşmesi) lib/sanchez/core.ts'tedir — istemci tarafı
// components/chat/useSanchezChat.ts, protokol lib/chat-events.ts.

export async function POST(req: Request) {
  const request = (await req.json()) as SanchezTurnRequest

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: ChatEvent) => controller.enqueue(enc.encode(JSON.stringify(event) + '\n'))
      try {
        // done/error olay garantisi core'dadır; zarfın tek işi kapatmak.
        await runSanchezTurn(request, send)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  })
}
