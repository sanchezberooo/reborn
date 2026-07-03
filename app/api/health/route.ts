import { createClient } from '@supabase/supabase-js'

const BERO_ID = process.env.NEXT_PUBLIC_BERO_ID ?? '00000000-0000-0000-0000-000000000001'

// Use server-side env vars directly (not the cached client)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET() {
  const report: Record<string, unknown> = {
    env: {
      url: supabaseUrl ?? '❌ boş',
      key: supabaseKey ? supabaseKey.slice(0, 30) + '...' : '❌ boş',
      bero_id: BERO_ID,
    },
  }

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ ...report, status: '❌ Env değişkenleri eksik' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // ─── Table checks ──────────────────────────────────────────────────────────
  const tables: Record<string, unknown> = {}

  for (const table of ['profiles', 'memories', 'conversations', 'modules']) {
    const { data, error, status } = await supabase
      .from(table)
      .select('*')
      .limit(1)

    if (error) {
      tables[table] = { ok: false, status, code: error.code, message: error.message, hint: error.hint }
    } else {
      tables[table] = { ok: true, status, sample_row: data?.[0] ?? null }
    }
  }

  report['tables'] = tables

  // ─── Write test ────────────────────────────────────────────────────────────
  const { error: writeErr, status: writeStatus } = await supabase
    .from('profiles')
    .upsert({ id: BERO_ID }, { onConflict: 'id' })

  report['write_test'] = writeErr
    ? { ok: false, status: writeStatus, code: writeErr.code, message: writeErr.message }
    : { ok: true, status: writeStatus }

  // ─── Overall status ────────────────────────────────────────────────────────
  const allTablesOk = Object.values(tables).every((t) => (t as { ok: boolean }).ok)
  const writeOk = !(report['write_test'] as { ok: boolean }).ok === false

  report['status'] = allTablesOk && writeOk ? '✅ Tamam' : '❌ Sorun var'

  return Response.json(report, {
    status: allTablesOk ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  })
}
