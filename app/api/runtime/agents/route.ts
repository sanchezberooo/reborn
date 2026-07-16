// /api/runtime/agents — ajan yaşam döngüsü kontrolü (Sprint 3, madde 3).
//   POST → { agentName, action: 'pause' | 'resume' }
// pause: ajan boştaysa anında paused; çalışma uçuştaysa bayraklanır ve iş
// bitince oturur (zorla kesme yok — yarım LLM çalıştırması tutarsız iz bırakır).

import { getAgent } from '@/lib/agents/registry'
import { getRuntime } from '@/lib/runtime/manager'

export async function POST(req: Request) {
  const { agentName, action } = (await req.json()) as { agentName?: string; action?: string }

  if (!agentName || !getAgent(agentName)) {
    return Response.json(
      { error: `'${String(agentName)}' registry'de kayıtlı bir ajan değil.` },
      { status: 404 },
    )
  }

  const { agentRuntime } = getRuntime()
  try {
    switch (action) {
      case 'pause':
        return Response.json({ agent: await agentRuntime.requestPause(agentName) })
      case 'resume':
        return Response.json({ agent: await agentRuntime.resume(agentName) })
      default:
        return Response.json(
          { error: `Geçersiz action '${String(action)}' — pause | resume bekleniyor.` },
          { status: 400 },
        )
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Ajan aksiyonu başarısız.' },
      { status: 500 },
    )
  }
}
