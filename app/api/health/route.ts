import { createClient } from '@supabase/supabase-js'

// Minimal sağlık kontrolü — SADECE okur, veri sızdırmaz:
//   * GET hiçbir şey YAZMAZ (eski sürümdeki profiles upsert'i kaldırıldı).
//   * Satır içeriği döndürmez (eski sample_row alanları kaldırıldı).
//   * Key'in hiçbir parçasını basmaz (eski slice(0,30) kaldırıldı).
// Bağlantı probe'u head:true ile koşar: PostgREST yalnız durum/sayım döner,
// satır verisi ağdan hiç geçmez. İstemci bilinçli olarak cache'siz kuruluyor
// (lib/supabase.ts'e bağımlı olmadan env + bağlantının kendisini sınar).

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { ok: false, db: false, error: 'Supabase env değişkenleri eksik' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return Response.json(
      { ok: false, db: false, error: error.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, db: true })
}
