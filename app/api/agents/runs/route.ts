import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const agent = searchParams.get('agent')

  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('agent_runs')
    .select('id, agent_name, status, input, output, module_target, error, started_at, finished_at')
    .order('started_at', { ascending: false })
    .limit(20)

  if (agent) query = query.eq('agent_name', agent)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
