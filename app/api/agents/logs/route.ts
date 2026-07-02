import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('run_id')

  if (!runId) return Response.json({ error: 'run_id required' }, { status: 400 })

  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('agent_logs')
    .select('id, action, result, created_at')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
