import { dbExecuteAction } from '@/lib/db'
import type { ActionType } from '@/lib/modules'

export async function POST(req: Request) {
  const { actions } = (await req.json()) as { actions: ActionType[] }

  if (!Array.isArray(actions) || actions.length === 0) {
    return Response.json({ ok: true })
  }

  try {
    for (const action of actions) {
      await dbExecuteAction(action)
    }
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[Reborn] /api/action error:', err)
    return Response.json({ ok: false, error: 'Aksiyon çalıştırılamadı.' }, { status: 500 })
  }
}
