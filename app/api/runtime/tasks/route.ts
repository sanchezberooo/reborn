// /api/runtime/tasks — iş emri operasyon yüzeyi (Sprint 3).
//   GET  → açık görevler (pending|queued|running|blocked|failed)
//   POST → { taskId, action: 'cancel', reason? } — insan iptali
// Görev OLUŞTURMA bilinçli olarak burada değil: iş emri açmanın yolu
// Sanchez'dir (delegate_task) — tek muhatap ilkesi (değişmez filtre 2).

import { getRuntime } from '@/lib/runtime/manager'
import { listOpenTasks } from '@/lib/tasks/repository'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data: profile } = await getSupabaseAdmin().from('profiles').select('id').limit(1).single()
  const userId = (profile?.id as string | undefined) ?? ''
  if (!userId) return Response.json({ tasks: [] })
  return Response.json({ tasks: await listOpenTasks(userId) })
}

export async function POST(req: Request) {
  const { taskId, action, reason } = (await req.json()) as {
    taskId?: string; action?: string; reason?: string
  }

  if (action !== 'cancel') {
    return Response.json(
      { error: `Geçersiz action '${String(action)}' — cancel bekleniyor.` },
      { status: 400 },
    )
  }
  if (!taskId) {
    return Response.json({ error: 'taskId zorunlu.' }, { status: 400 })
  }

  try {
    const task = await getRuntime().cancelTask(taskId, reason)
    return Response.json({ task })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'İptal başarısız.' },
      { status: 500 },
    )
  }
}
