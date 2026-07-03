// Goals yazma yolunun sunucu ucu (Faz 2, Görev 2) — app/api/journal/route.ts
// deseniyle tutarlı: iş mantığı lib/db-server.ts'tedir (native entity +
// goals uzantı satırı + alt-hedef links kenarı, embedding sunucuda).

import {
  deleteGoal,
  resolveSingleUserId,
  saveGoal,
  type GoalInput,
  type GoalProgressType,
  type GoalStatus,
} from '@/lib/db-server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUSES: GoalStatus[] = ['active', 'paused', 'completed', 'abandoned']
const PROGRESS_TYPES: GoalProgressType[] = ['binary', 'percentage', 'milestone']

/** Gövdeyi GoalInput'a çevirir; geçersiz alanda hata mesajı döner.
 *  Gönderilmeyen alan güncellemede korunur (lib/db-server saveGoal sözleşmesi);
 *  null gönderilebilen alanlar (description, parent_goal_id, target_date)
 *  null ile bilinçli temizlenir. */
function parseGoal(body: unknown): { input: GoalInput } | { error: string } {
  const b = body as Record<string, unknown> | null
  if (!b || typeof b !== 'object') return { error: 'Geçersiz gövde.' }

  const input: GoalInput = {}

  if (b.id !== undefined) {
    if (typeof b.id !== 'string' || !UUID_RE.test(b.id)) return { error: 'id geçersiz (uuid bekleniyor).' }
    input.id = b.id
  }
  if (b.title !== undefined) {
    if (typeof b.title !== 'string' || !b.title.trim()) return { error: 'title boş olamaz.' }
    input.title = b.title
  }
  if (!input.id && !input.title) return { error: 'Yeni hedef için title zorunlu.' }

  if (b.description !== undefined) {
    if (b.description !== null && typeof b.description !== 'string') return { error: 'description geçersiz.' }
    input.description = b.description as string | null
  }
  if (b.parent_goal_id !== undefined) {
    if (b.parent_goal_id !== null && (typeof b.parent_goal_id !== 'string' || !UUID_RE.test(b.parent_goal_id))) {
      return { error: 'parent_goal_id geçersiz (uuid veya null).' }
    }
    input.parentGoalId = b.parent_goal_id as string | null
  }
  if (b.target_date !== undefined) {
    if (b.target_date !== null && (typeof b.target_date !== 'string' || !DATE_RE.test(b.target_date))) {
      return { error: 'target_date geçersiz (YYYY-MM-DD veya null).' }
    }
    input.targetDate = b.target_date as string | null
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status as GoalStatus)) return { error: `status geçersiz (${STATUSES.join('|')}).` }
    input.status = b.status as GoalStatus
  }
  if (b.progress_type !== undefined) {
    if (!PROGRESS_TYPES.includes(b.progress_type as GoalProgressType)) {
      return { error: `progress_type geçersiz (${PROGRESS_TYPES.join('|')}).` }
    }
    input.progressType = b.progress_type as GoalProgressType
  }
  if (b.progress_value !== undefined) {
    if (typeof b.progress_value !== 'number' || b.progress_value < 0 || b.progress_value > 100) {
      return { error: 'progress_value geçersiz (0-100 sayı).' }
    }
    input.progressValue = b.progress_value
  }

  return { input }
}

export async function POST(req: Request) {
  const parsed = parseGoal(await req.json().catch(() => null))
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 })

  try {
    const userId = await resolveSingleUserId()
    const goal = await saveGoal(userId, parsed.input)
    return Response.json(goal)
  } catch (error) {
    console.error('[api/goals] POST hata:', error)
    const message = error instanceof Error ? error.message : 'Hedef kaydedilemedi.'
    // saveGoal'un sözleşme hataları (bulunamadı, döngü, geçersiz parent)
    // istemci hatasıdır; sunucu hatası gibi 500'e gizlenmez.
    const clientFault = message.startsWith('saveGoal:')
    return Response.json(
      { error: clientFault ? message : 'Hedef kaydedilemedi.' },
      { status: clientFault ? 400 : 500 },
    )
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id || !UUID_RE.test(id)) {
    return Response.json({ error: 'id (uuid) query parametresi zorunlu.' }, { status: 400 })
  }

  try {
    const userId = await resolveSingleUserId()
    const deleted = await deleteGoal(userId, id)
    return Response.json({ deleted })
  } catch (error) {
    console.error('[api/goals] DELETE hata:', error)
    return Response.json({ error: 'Hedef silinemedi.' }, { status: 500 })
  }
}
