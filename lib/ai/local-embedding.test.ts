import { beforeAll, describe, expect, it } from 'vitest'
import { EMBEDDING_DIM, LocalEmbeddingProvider, LruCache } from './local-embedding'

// NOT: Bu test gerçek bge-m3 modelini çalıştırır. İlk koşuda model
// (~570 MB) .cache/transformers/ altına indirilir — ilk koşu dakikalar
// sürebilir, sonrakiler diskten yükler (~10-15 sn model yükleme + testler).

/** Vektörler L2-normalize olduğundan dot product = cosine similarity. */
function cosine(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

describe('LruCache', () => {
  it('kapasite aşımında en eski kullanılanı düşürür', () => {
    const cache = new LruCache<number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3) // 'a' düşer
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    expect(cache.size).toBe(2)
  })

  it('get kaydı tazeler — en son kullanılan hayatta kalır', () => {
    const cache = new LruCache<number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a') // 'a' tazelendi, artık 'b' en eski
    cache.set('c', 3) // 'b' düşer
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
  })

  it('aynı anahtara set değeri günceller, boyutu artırmaz', () => {
    const cache = new LruCache<number>(2)
    cache.set('a', 1)
    cache.set('a', 9)
    expect(cache.get('a')).toBe(9)
    expect(cache.size).toBe(1)
  })
})

describe('LocalEmbeddingProvider.embed (gerçek model)', () => {
  const provider = new LocalEmbeddingProvider()

  beforeAll(async () => {
    // Isınma: model yüklemesi (ve ilk koşuda indirme) burada ödenir ki
    // asıl testlerin süreleri anlamlı kalsın.
    await provider.embed(['ısınma cümlesi'])
  }, 600_000)

  it('boş girdi boş sonuç döndürür', async () => {
    expect(await provider.embed([])).toEqual([])
  })

  it(`vektör boyutu migration sözleşmesine uyar (${EMBEDDING_DIM})`, async () => {
    const [vec] = await provider.embed(['Bu bir boyut testi.'])
    expect(vec).toHaveLength(EMBEDDING_DIM)
  }, 60_000)

  it('vektörler L2-normalize (norm ≈ 1) — pgvector cosine indeksiyle uyumlu', async () => {
    const [vec] = await provider.embed(['Norm kontrolü için cümle.'])
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
    expect(norm).toBeCloseTo(1, 3)
  }, 60_000)

  it('aynı metin deterministik aynı vektörü döndürür (cache)', async () => {
    const text = 'Deterministiklik kontrolü.'
    const [first] = await provider.embed([text])
    const [second] = await provider.embed([text])
    expect(second).toEqual(first)
  }, 60_000)

  it('batch çağrı, tekil çağrılarla aynı sırada aynı vektörleri verir', async () => {
    const texts = ['Birinci batch cümlesi.', 'İkinci batch cümlesi.']
    const batch = await provider.embed(texts)
    const [single0] = await provider.embed([texts[0]])
    expect(batch[0]).toEqual(single0)
    expect(batch).toHaveLength(2)
  }, 60_000)

  // Anlamlı benzerlik sırası: her üçlüde cos(a, ilişkili) > cos(a, alakasız)
  // olmalı. TR-TR, EN-EN ve TR-EN çapraz dil durumları kapsanıyor — roadmap
  // Faz 1 kriteri "Türkçe içerikte semantik arama doğru çalışıyor".
  const triplets: Array<{ name: string; a: string; related: string; unrelated: string }> = [
    {
      name: 'TR-TR spor',
      a: 'Bugün spor salonunda ağırlık antrenmanı yaptım.',
      related: 'Dün akşam fitness salonunda egzersiz yaptım.',
      unrelated: 'Ekonomik kriz nedeniyle döviz kurları yükseldi.',
    },
    {
      name: 'TR-TR sınav hedefi',
      a: 'IELTS sınavına hazırlanıyorum, hedefim 7.5 almak.',
      related: 'İngilizce yeterlilik sınavı için her gün pratik yapıyorum.',
      unrelated: 'Kedim bütün gün koltuğun üzerinde uyudu.',
    },
    {
      name: 'TR-EN çapraz dil burs',
      a: 'Tam burslu bilgisayar mühendisliği okumak istiyorum.',
      related: 'I want to study computer science on a full scholarship.',
      unrelated: 'The recipe requires two cups of flour and three eggs.',
    },
    {
      name: 'TR-EN çapraz dil günlük',
      a: 'Bu akşam günlüğüme duygularımı yazdım.',
      related: 'Tonight I wrote about my feelings in my journal.',
      unrelated: 'Yarın araba lastiklerini değiştirmem gerekiyor.',
    },
    {
      name: 'EN-EN hava durumu',
      a: 'The weather is sunny and warm today.',
      related: 'It is a bright and hot summer day outside.',
      unrelated: 'My favorite programming language is TypeScript.',
    },
  ]

  it.each(triplets)('ilişkili > alakasız: $name', async ({ a, related, unrelated }) => {
    const [va, vr, vu] = await provider.embed([a, related, unrelated])
    const simRelated = cosine(va, vr)
    const simUnrelated = cosine(va, vu)
    expect(simRelated).toBeGreaterThan(simUnrelated)
  }, 120_000)

  it('performans: sıcak embed ortalaması raporlanır', async () => {
    const samples = Array.from({ length: 8 }, (_, i) => `Performans ölçüm cümlesi numara ${i} — cache dışı kalsın.`)
    const start = performance.now()
    for (const s of samples) await provider.embed([s])
    const avg = (performance.now() - start) / samples.length
    // eslint-disable-next-line no-console
    console.log(`[perf] sıcak embed ortalaması: ${avg.toFixed(0)} ms/metin (${samples.length} çağrı)`)
    // Makineye bağlı — patolojiyi yakalamak için cömert sınır; gerçek
    // ölçüm yukarıdaki log'da raporlanır (roadmap bütçesi: retrieval <500ms).
    expect(avg).toBeLessThan(5000)
  }, 120_000)
})
