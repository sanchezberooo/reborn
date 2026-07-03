import path from 'node:path'
import { env, pipeline } from '@huggingface/transformers'
import type { AIProvider, AIProviderCapabilities, AIStreamEvent, AITurn } from './provider'

// LocalEmbeddingProvider — Faz 1 embedding pipeline'ı. bge-m3 (çok dilli,
// Türkçe destekli açık model) transformers.js + onnxruntime-node ile tamamen
// lokal ve ücretsiz çalışır; üretken yeteneği YOKTUR.
//
// Çalıştırma yolu kararı: @huggingface/transformers (transformers.js).
// - Next.js'in varsayılan serverExternalPackages listesinde → API route'ta
//   ek config'siz native require ile çalışır.
// - Tokenizer + ONNX runtime tek pakette; Python bağımlılığı yok.
// - Model süreç içinde bir kez yüklenir (aşağıdaki lazy singleton) — soğuk
//   başlatma yalnızca ilk embed çağrısında ödenir.
//
// Model dosyası (q8 kuantize, ~570 MB) ilk çalıştırmada Hugging Face'ten
// indirilir ve .cache/transformers/ altına (gitignore'lu) kaydedilir; sonraki
// açılışlar diskten yükler. q8 seçimi: fp32 (~2.3 GB) yerine bellek/indirme
// bütçesi — kalite farkı testle doğrulanır (local-embedding.test.ts).

/** Boyut sözleşmesi: supabase/migrations/0001_unified_entity_core.sql vector(1024). */
export const EMBEDDING_DIM = 1024
export const EMBEDDING_MODEL = 'Xenova/bge-m3'

// Varsayılan cache node_modules içinde kalıyor (reinstall'da silinir);
// proje köküne sabitle. Gerekirse env ile taşınabilir.
env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR ?? path.join(process.cwd(), '.cache', 'transformers')

/**
 * Basit in-memory LRU — Map ekleme sırasını korur: get'te kaydı sona taşı,
 * kapasite aşımında en baştakini (en eski kullanılanı) düşür. Faz 1 için
 * kalıcı cache gerekmez; 512 kayıt × 1024 float ≈ 4 MB.
 */
export class LruCache<V> {
  private map = new Map<string, V>()

  constructor(private readonly maxSize: number) {}

  get(key: string): V | undefined {
    const value = this.map.get(key)
    if (value !== undefined) {
      this.map.delete(key)
      this.map.set(key, value)
    }
    return value
  }

  set(key: string, value: V): void {
    this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }

  get size(): number {
    return this.map.size
  }
}

// Süreç başına tek model instance'ı; ilk çağrıda yüklenir. Promise saklanır
// ki eşzamanlı ilk istekler ikinci bir yükleme başlatmasın.
function createExtractor() {
  return pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' })
}
let extractorPromise: ReturnType<typeof createExtractor> | null = null
function getExtractor() {
  extractorPromise ??= createExtractor()
  return extractorPromise
}

const embeddingCache = new LruCache<number[]>(512)

// Süreç başına tek provider — model yüklemesi zaten modül seviyesinde tekil
// (extractorPromise); bu erişimci de çağıranların (lib/db.ts createEntity,
// lib/ai/retrieval.ts) her seferinde new'lemesini önler.
let providerSingleton: LocalEmbeddingProvider | null = null
export function getLocalEmbeddingProvider(): LocalEmbeddingProvider {
  providerSingleton ??= new LocalEmbeddingProvider()
  return providerSingleton
}

export class LocalEmbeddingProvider implements AIProvider {
  readonly name = 'local-embedding'
  readonly capabilities: AIProviderCapabilities = { webSearch: false, embeddings: true }

  async complete(): Promise<AITurn> {
    throw new Error('LocalEmbeddingProvider.complete: desteklenmiyor — bu provider yalnızca embedding içindir.')
  }

  async *stream(): AsyncIterable<AIStreamEvent> {
    throw new Error('LocalEmbeddingProvider.stream: desteklenmiyor — bu provider yalnızca embedding içindir.')
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const results = new Array<number[] | undefined>(texts.length)
    const missIndexes: number[] = []
    texts.forEach((text, i) => {
      const hit = embeddingCache.get(text)
      if (hit) results[i] = hit
      else missIndexes.push(i)
    })

    if (missIndexes.length > 0) {
      const extractor = await getExtractor()
      // bge-m3 dense retrieval standardı: CLS pooling + L2 normalizasyon.
      // Normalize vektörlerde dot product = cosine similarity (pgvector
      // hnsw vector_cosine_ops indeksiyle uyumlu kullanım).
      const output = await extractor(
        missIndexes.map((i) => texts[i]),
        { pooling: 'cls', normalize: true },
      )
      const vectors = output.tolist() as number[][]
      missIndexes.forEach((textIndex, j) => {
        const vector = vectors[j]
        if (vector.length !== EMBEDDING_DIM) {
          throw new Error(
            `LocalEmbeddingProvider.embed: beklenen boyut ${EMBEDDING_DIM}, model ${vector.length} döndürdü — ` +
              'model ile migration (vector(1024)) sözleşmesi bozulmuş.',
          )
        }
        embeddingCache.set(texts[textIndex], vector)
        results[textIndex] = vector
      })
    }

    return results as number[][]
  }
}
