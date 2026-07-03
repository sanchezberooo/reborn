// Faz 1 fixture importu — vizyon belgeleri + tematik parçalar + dolgu
// kayıtlarını canlı Supabase'e (entities + links) yazar. Embedding'ler
// lokal bge-m3 ile hesaplanır (ilk koşuda model indirme ~570 MB).
//
// Çalıştırma:
//   npx tsx scripts/import-fixtures.ts           → import (idempotent:
//     önce FIXTURE_USER_ID altındaki eski fixture'ları siler, baştan yazar)
//   npx tsx scripts/import-fixtures.ts --clean   → yalnız temizlik
//
// Tüm kayıtlar FIXTURE_USER_ID (sentinel uuid) altında — gerçek kullanıcı
// verisine dokunmaz, tek delete ile geri alınır.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import {
  FIXTURE_USER_ID,
  FIXTURE_LINKS,
  HANDCRAFTED,
  VISION_DOCS,
  generateFiller,
  type FixtureItem,
} from './fixture-data'

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

async function main() {
  // Env, lib importlarından ÖNCE yüklenmeli (lib/supabase.ts modül yüklenirken
  // NEXT_PUBLIC_* okur) — bu yüzden lib modülleri aşağıda dinamik import edilir.
  loadEnvConfig(process.cwd())
  const { createEntity, createLink } = await import('../lib/db-server')
  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const supabase = getSupabaseAdmin()

  // Temizlik: fixture kullanıcısının tüm entity'leri (links FK cascade ile düşer).
  const { error: cleanError, count } = await supabase
    .from('entities')
    .delete({ count: 'exact' })
    .eq('user_id', FIXTURE_USER_ID)
  if (cleanError) throw cleanError
  console.log(`Temizlik: ${count ?? 0} eski fixture entity silindi.`)

  if (process.argv.includes('--clean')) {
    console.log('--clean: yalnız temizlik istendi, çıkılıyor.')
    return
  }

  const startedAt = Date.now()

  // Vizyon belgeleri: gerçek dosya içeriği entity olur.
  const visionItems: FixtureItem[] = VISION_DOCS.map((doc) => ({
    key: doc.key,
    type: 'note',
    title: doc.title,
    content: readFileSync(path.join(process.cwd(), doc.file), 'utf8'),
    daysAgo: doc.daysAgo,
  }))

  const allItems: FixtureItem[] = [...visionItems, ...HANDCRAFTED, ...generateFiller()]

  const idByKey = new Map<string, string>()
  let done = 0
  for (const item of allItems) {
    const entity = await createEntity({
      userId: FIXTURE_USER_ID,
      type: item.type,
      title: item.title,
      content: item.content,
      createdAt: daysAgoIso(item.daysAgo),
    })
    idByKey.set(item.key, entity.id)
    done += 1
    if (done % 20 === 0 || done === allItems.length) {
      console.log(`Entity ${done}/${allItems.length} yazıldı...`)
    }
  }

  let linkCount = 0
  for (const link of FIXTURE_LINKS) {
    const sourceId = idByKey.get(link.source)
    const targetId = idByKey.get(link.target)
    if (!sourceId || !targetId) {
      throw new Error(`Link tanımı bilinmeyen key içeriyor: ${link.source} → ${link.target}`)
    }
    await createLink({
      sourceEntityId: sourceId,
      targetEntityId: targetId,
      kind: link.kind,
      label: link.label,
      strength: link.strength,
    })
    linkCount += 1
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log('')
  console.log(`Bitti (${seconds} sn):`)
  console.log(`  ${visionItems.length} vizyon belgesi + ${HANDCRAFTED.length} tematik parça + ${allItems.length - visionItems.length - HANDCRAFTED.length} dolgu = ${allItems.length} entity`)
  console.log(`  ${linkCount} link`)
  console.log(`  Sahip: FIXTURE_USER_ID=${FIXTURE_USER_ID}`)
  console.log('Temizlemek için: npx tsx scripts/import-fixtures.ts --clean')
}

main().catch((err) => {
  console.error('import-fixtures hata:', err)
  process.exitCode = 1
})
