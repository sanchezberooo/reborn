import { runAgent } from '@/lib/agents/runner'

export async function POST(req: Request) {
  const { agentName, input } = (await req.json()) as {
    agentName: string
    input: Record<string, unknown>
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: profile } = await supabase.from('profiles').select('id').limit(1).single()
  const userId = (profile?.id as string) ?? ''

  const result = await runAgent(agentName, input, userId)

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.notFound ? 404 : 500 })
  }

  const { data: finalRun } = await supabase.from('agent_runs').select('*').eq('id', result.runId).single()
  return Response.json(finalRun)
}
