import { getSupabaseAdmin } from '@/lib/supabase-admin'

// Agent Intelligence canlı sayım ucu — Agent Brain'in (scope='agent')
// entities satırlarını tipe göre sayar. Kategori→tip eşlemesi istemcide
// (lib/company/intelligence.ts resolveCategoryCounts) yapılır; bu uç yalnız
// ham type→adet döndürür ki eşleme değişince API değişmesin.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    // v1'de Agent Brain küçük (yüzler mertebesi) — tip listesini çekip
    // bellekte saymak, RPC/group-by migration'ı gerektirmeyen en sade yol.
    const { data, error } = await supabase
      .from('entities')
      .select('type')
      .eq('scope', 'agent')
      .limit(5000)
    if (error) throw error

    const nodeCounts: Record<string, number> = {}
    for (const row of data ?? []) {
      const type = (row as { type: string }).type
      nodeCounts[type] = (nodeCounts[type] ?? 0) + 1
    }
    return Response.json({ nodeCounts })
  } catch (err) {
    return Response.json(
      { nodeCounts: null, error: err instanceof Error ? err.message : 'sayım başarısız' },
      { status: 500 },
    )
  }
}
