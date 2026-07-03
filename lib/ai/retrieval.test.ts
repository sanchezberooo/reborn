import { beforeAll, describe, expect, it } from 'vitest'
import { hybridRetrieve } from './retrieval'
import { FIXTURE_USER_ID, fixtureTitle } from '../../scripts/fixture-data'

// NOT: Bu test canlı Supabase'e ve gerçek bge-m3 modeline karşı koşar.
// Önkoşullar:
//   1. .env.local'da NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//      (yoksa suite tamamen skip edilir).
//   2. Fixture seti import edilmiş olmalı: npx tsx scripts/import-fixtures.ts
//      (değilse beforeAll açık bir hatayla durdurur).
// Env vitest.setup.ts'te yüklenir (test modülü importlarından önce).

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// lib/db-server.ts dinamik import edilir: modül zinciri env ister;
// env'siz ortamda suite'in skip yerine patlamasına yol açardı.
async function dbApi() {
  return import('../db-server')
}

describe.skipIf(!hasEnv)('hybridRetrieve (canlı Supabase + gerçek bge-m3)', () => {
  beforeAll(async () => {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    const { count, error } = await getSupabaseAdmin()
      .from('entities')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', FIXTURE_USER_ID)
    if (error) throw error
    if ((count ?? 0) < 100) {
      throw new Error(
        `Fixture seti eksik (${count ?? 0} kayıt, 100+ bekleniyor) — önce çalıştır: npx tsx scripts/import-fixtures.ts`,
      )
    }
    // Isınma: model yüklemesi + ilk snapshot çekimi burada ödenir ki asıl
    // testler (özellikle performans) sıcak durumu ölçsün.
    await hybridRetrieve('ısınma sorgusu', { userId: FIXTURE_USER_ID })
  }, 600_000)

  // ── Doğruluk: beklenen entity'ler ilk 5 sonuçta ─────────────────────────
  // Roadmap Faz 1 kriteri: "ilgili sorguda doğru hafızalar ilk 5 sonuçta".
  // En az bir senaryo Türkçe→İngilizce, biri İngilizce→Türkçe çapraz.
  const scenarios: Array<{ name: string; query: string; expectKeys: string[] }> = [
    {
      name: 'TR→EN çapraz: IELTS hedefi',
      query: 'IELTS sınavına hazırlığım nasıl gidiyor, band hedefim neydi?',
      expectKeys: ['goal-ielts', 'journal-ielts-reading'],
    },
    {
      name: 'EN→TR çapraz: burs başvurusu',
      query: 'full scholarship application deadlines for studying abroad',
      expectKeys: ['goal-scholarship', 'note-deadlines'],
    },
    {
      name: 'TR: spor ve antrenman',
      query: 'spor salonunda antrenman ve koşu rutinim',
      expectKeys: ['journal-gym', 'goal-fitness'],
    },
    {
      name: 'TR: Reborn vizyonu',
      query: "Reborn projesinin nihai amacı nedir, Life OS vizyonu ne diyor?",
      expectKeys: ['vision-01', 'project-reborn'],
    },
    {
      name: 'TR: tasarım prensipleri',
      query: 'tasarım prensipleri: tek muhatap Sanchez ve sadelik ilkesi',
      expectKeys: ['vision-03'],
    },
  ]

  it.each(scenarios)('ilk 5 sonuç doğru: $name', async ({ query, expectKeys }) => {
    const results = await hybridRetrieve(query, { userId: FIXTURE_USER_ID, limit: 5 })
    const titles = results.map((r) => r.title)
    // Log — roadmap kriteri "ölçülür, log'lanır".
    console.log(`[retrieval] "${query}" →`, results.map((r) => `${r.title} (${r.score.toFixed(3)})`))
    for (const key of expectKeys) {
      expect(titles).toContain(fixtureTitle(key))
    }
  }, 60_000)

  // ── Link grafı: bağlantılı entity birlikte gelir ─────────────────────────
  it('link grafı: journal bulununca bağlı proje de sonuçlara katılıyor', async () => {
    // Sorgu journal-reborn-dev'i ('pgvector üzerinde embedding saklama...')
    // güçlü yakalar; project-reborn ona user-link'le bağlı.
    const query = 'bugün pgvector ve embedding pipeline üzerinde çalıştım'
    const withGraph = await hybridRetrieve(query, { userId: FIXTURE_USER_ID, limit: 10 })
    const withoutGraph = await hybridRetrieve(query, { userId: FIXTURE_USER_ID, limit: 10, graph: false })

    const projectTitle = fixtureTitle('project-reborn')
    const rankWith = withGraph.findIndex((r) => r.title === projectTitle)
    const rankWithout = withoutGraph.findIndex((r) => r.title === projectTitle)

    expect(rankWith).toBeGreaterThanOrEqual(0)
    expect(rankWith).toBeLessThan(5)
    const project = withGraph[rankWith]
    expect(project.graphBoost).toBeGreaterThan(0)
    // Graf katkısı sırayı kötüleştiremez: grafsız listede ya yok ya daha geride.
    expect(rankWithout === -1 || rankWith <= rankWithout).toBe(true)
  }, 60_000)

  // ── Silme: silinen entity retrieval'a bir daha çıkmaz ────────────────────
  it("silinen entity retrieval'a çıkmıyor", async () => {
    const { createEntity, deleteEntity } = await dbApi()
    const temp = await createEntity({
      userId: FIXTURE_USER_ID,
      type: 'note',
      title: 'Kapadokya balon festivalinde origami atölyesi',
      content:
        'Sıcak hava balonunda zebra desenli origami katlama atölyesine katıldım — fixture setinde eşi olmayan benzersiz test içeriği.',
    })

    const query = 'balonda zebra origami katlamak'
    const before = await hybridRetrieve(query, { userId: FIXTURE_USER_ID, limit: 5 })
    expect(before.some((r) => r.id === temp.id)).toBe(true)

    await deleteEntity(temp.id)

    const after = await hybridRetrieve(query, { userId: FIXTURE_USER_ID, limit: 5 })
    expect(after.some((r) => r.id === temp.id)).toBe(false)
  }, 120_000)

  // ── Performans: ortalama < 500ms (roadmap kriteri) ───────────────────────
  it('performans: ortalama retrieval süresi < 500ms', async () => {
    const queries = [
      'IELTS speaking pratiği',
      'burs için motivasyon mektubu',
      'sabah koşusu ve antrenman',
      'Sanchez karakter tasarımı',
      'hafıza katmanı ve semantik arama',
      'aile ile akşam yemeği',
      'scholarship requirements in Europe',
      'identity-based habits',
    ]
    const times: number[] = []
    for (const q of queries) {
      const t0 = performance.now()
      await hybridRetrieve(q, { userId: FIXTURE_USER_ID, limit: 10 })
      times.push(performance.now() - t0)
    }
    const avg = times.reduce((s, t) => s + t, 0) / times.length
    const max = Math.max(...times)
    console.log(
      `[perf] retrieval: ortalama ${avg.toFixed(0)} ms, max ${max.toFixed(0)} ms (${times.length} sorgu: ${times.map((t) => t.toFixed(0)).join(', ')} ms)`,
    )
    expect(avg).toBeLessThan(500)
  }, 120_000)
})
