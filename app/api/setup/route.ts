import { supabase } from '@/lib/supabase'

export async function POST() {
  // Check if a profile already exists
  const { data: existing, error: selectErr } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single()

  if (selectErr && selectErr.code !== 'PGRST116') {
    return Response.json({ ok: false, error: selectErr.message }, { status: 500 })
  }

  if (existing?.id) {
    return Response.json({ ok: true, userId: existing.id, note: 'already seeded' })
  }

  // No profile — create one with a fresh UUID
  const { data: created, error: insertErr } = await supabase
    .from('profiles')
    .insert({})
    .select('id')
    .single()

  if (insertErr) {
    return Response.json({ ok: false, error: insertErr.message }, { status: 500 })
  }

  return Response.json({ ok: true, userId: created.id, note: 'created' })
}

export async function GET() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .single()

  if (error || !data) {
    return Response.json({ seeded: false, note: 'POST /api/setup to seed.' })
  }

  return Response.json({ seeded: true, userId: data.id })
}
