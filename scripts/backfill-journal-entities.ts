// Faz 2, Görev 1 — tek seferlik backfill: mevcut journal_entries kayıtlarını
// entities'e köprüler (embedding lokal bge-m3 ile hesaplanır). İdempotent:
// köprüsü olan kayıt güncellenir, olmayan yaratılır — tekrar çalıştırmak
// güvenlidir; senkron kaçaklarını iyileştirmek için de kullanılır.
//
// Çalıştırma: npx tsx --conditions=react-server scripts/backfill-journal-entities.ts
//   (bayrak, lib/db-server.ts'teki 'server-only' guard'ını Node'da no-op'a
//   çözer — vitest.config.ts'teki alias'ın tsx karşılığı)

import { loadEnvConfig } from '@next/env'

async function main() {
  // Env, lib importlarından ÖNCE yüklenmeli (import-fixtures.ts ile aynı desen).
  loadEnvConfig(process.cwd())
  const { syncJournalEntryEntity } = await import('../lib/db-server')
  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const supabase = getSupabaseAdmin()

  const { data: rows, error } = await supabase
    .from('journal_entries')
    .select('id, user_id, date, mood, day_score, question_1, answer_1, question_2, answer_2, free_write')
    .order('date', { ascending: true })
  if (error) throw error

  if (!rows || rows.length === 0) {
    console.log('journal_entries boş — köprülenecek kayıt yok.')
    return
  }

  const startedAt = Date.now()
  let created = 0
  let updated = 0
  const failures: string[] = []

  for (const row of rows) {
    const date = String(row.date).slice(0, 10)
    try {
      const outcome = await syncJournalEntryEntity(row.user_id as string, row.id as string, {
        date,
        mood: (row.mood as number | null) ?? 5,
        day_score: (row.day_score as number | null) ?? 5,
        question_1: (row.question_1 as string | null) ?? '',
        answer_1: (row.answer_1 as string | null) ?? '',
        question_2: (row.question_2 as string | null) ?? '',
        answer_2: (row.answer_2 as string | null) ?? '',
        free_write: (row.free_write as string | null) ?? '',
      })
      if (outcome === 'created') created += 1
      else updated += 1
      console.log(`${date} → ${outcome}`)
    } catch (err) {
      failures.push(date)
      console.error(`${date} → HATA:`, err)
    }
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log('')
  console.log(`Bitti (${seconds} sn): ${rows.length} journal kaydı → ${created} köprü yaratıldı, ${updated} güncellendi.`)
  if (failures.length > 0) {
    console.error(`${failures.length} kayıt başarısız: ${failures.join(', ')}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('backfill-journal-entities hata:', err)
  process.exitCode = 1
})
