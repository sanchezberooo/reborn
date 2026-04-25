import { supabase } from '@/lib/supabase'

const BERO_ID = process.env.NEXT_PUBLIC_BERO_ID ?? '00000000-0000-0000-0000-000000000001'

// Checks each table and inserts the default profile row if missing
export async function POST() {
  const results: Record<string, string> = {}

  // 1. Profile row
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: BERO_ID }, { onConflict: 'id' })
    results['profiles:seed'] = error ? `❌ ${error.message}` : '✅ OK'
  } catch (e) {
    results['profiles:seed'] = `❌ ${String(e)}`
  }

  return Response.json({ results })
}

export async function GET() {
  return Response.json({ message: 'POST to this endpoint to seed default data.' })
}
