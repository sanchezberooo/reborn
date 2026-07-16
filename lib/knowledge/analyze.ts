// Analyze + Deduplicate aşamaları (Knowledge Pipeline 5-6/16) — chunk'lardan
// belge-düzeyi sinyal türetir: etiketler, kategori, tekrar oranı, yapı
// istatistikleri. TAMAMEN SAF ve DETERMİNİSTİK — LLM yok; anlamsal
// derinleştirme (daha iyi etiket/özet) Knowledge Agent'ın ileriki görevi,
// bu katman onun zeminidir.
//
// Dedup İKİ SEVİYELİDİR ve bu dosya yalnız BİRİNCİYİ yapar:
//  1. Belge-içi: normalize-eşit chunk'lar süzülür (duplicationRate → kalite).
//  2. Brain-düzeyi: applyBrainUpdate'in HNSW dedup hattı (CONFIRM/SUPERSEDE)
//     — pipeline.ts oradan geçer, burada İKİNCİ bir benzerlik formülü yok.

import type { DocumentAnalysis, KnowledgeCategory, KnowledgeChunk, ParsedDocument } from './types'

/** Kategori kural sözlüğü — küçük-harf anahtar kelime imzaları. İlk yeterli
 *  imza kazanır; hiçbiri tutmazsa 'general'. Sıra ÖNEMLİDİR: dar imzalar
 *  (ai) geniş imzalardan (engineering) önce denenir. */
const CATEGORY_SIGNATURES: [KnowledgeCategory, string[]][] = [
  ['ai', ['llm', 'prompt', 'embedding', 'agent', 'ajan', 'model', 'anthropic', 'openai', 'rag', 'fine-tun', 'inference', 'yapay zeka']],
  ['research', ['arxiv', 'paper', 'study', 'hypothesis', 'deney', 'araştırma', 'makale', 'abstract', 'methodology', 'dataset']],
  ['engineering', ['api', 'typescript', 'javascript', 'python', 'database', 'migration', 'deploy', 'docker', 'kod', 'fonksiyon', 'repository', 'framework', 'endpoint', 'component']],
  ['process', ['sop', 'süreç', 'checklist', 'onboarding', 'policy', 'prosedür', 'workflow', 'iş akışı', 'toplantı', 'sprint']],
  ['product', ['kullanıcı', 'user', 'ux', 'ui', 'tasarım', 'design', 'feature', 'özellik', 'roadmap', 'mvp', 'persona']],
]

/** Etiket çıkarımında elenecek TR+EN yüksek-frekans kelimeler (dar liste —
 *  amaç mükemmel NLP değil, gürültüsüz anahtar kelime). */
const STOPWORDS = new Set([
  // EN
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'you', 'your',
  'can', 'will', 'not', 'but', 'all', 'use', 'using', 'used', 'have', 'has', 'had', 'its',
  'into', 'when', 'then', 'than', 'they', 'them', 'these', 'those', 'there', 'here', 'how',
  'what', 'which', 'who', 'why', 'more', 'most', 'some', 'any', 'each', 'also', 'only',
  'should', 'would', 'could', 'about', 'after', 'before', 'between', 'over', 'under',
  // TR
  'bir', 'bu', 'şu', 've', 'veya', 'ile', 'için', 'gibi', 'daha', 'çok', 'olarak', 'olan',
  'her', 'ama', 'ancak', 'değil', 'kadar', 'sonra', 'önce', 'ise', 'yani', 'göre', 'eğer',
  'tüm', 'bütün', 'aynı', 'başka', 'diğer', 'nasıl', 'neden', 'niçin', 'hangi', 'nerede',
])

export const MAX_TAGS = 10
const TAG_MIN_LENGTH = 3
const TAG_MIN_COUNT = 2

/** Frekans-tabanlı anahtar kelime etiketleri: küçük harfe indirilmiş,
 *  stopword'süz, en az iki kez geçen kelimelerin en sık MAX_TAGS tanesi.
 *  Kod blokları sayıma girmez (değişken adları etiket değildir). */
export function extractTags(textOutsideCode: string, seedTags: string[] = []): string[] {
  const counts = new Map<string, number>()
  const words = textOutsideCode
    .toLocaleLowerCase('tr')
    .replace(/`[^`]*`/g, ' ')
    .match(/[a-zçğıöşü][a-z0-9çğıöşü+#._-]{2,}/g) ?? []

  for (const word of words) {
    const clean = word.replace(/^[._-]+|[._-]+$/g, '')
    if (clean.length < TAG_MIN_LENGTH || STOPWORDS.has(clean)) continue
    counts.set(clean, (counts.get(clean) ?? 0) + 1)
  }

  const frequent = [...counts.entries()]
    .filter(([, n]) => n >= TAG_MIN_COUNT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .map(([word]) => word)

  return [...new Set([...seedTags, ...frequent])].slice(0, MAX_TAGS)
}

/** Kural-tabanlı kategori: imza sözlüğündeki anahtar kelimeler metin + etiket
 *  havuzunda sayılır; ≥2 eşleşen İLK kategori kazanır, yoksa 'general'. */
export function classifyCategory(text: string, tags: string[]): KnowledgeCategory {
  const haystack = `${text}\n${tags.join(' ')}`.toLocaleLowerCase('tr')
  for (const [category, signatures] of CATEGORY_SIGNATURES) {
    let hits = 0
    for (const signature of signatures) {
      if (haystack.includes(signature)) hits++
      if (hits >= 2) return category
    }
  }
  return 'general'
}

/** Belge-içi dedup anahtarı: boşluk/büyük-küçük farkı tekrar sayılır
 *  (update-engine normalizedEqual ilkesiyle aynı). Chunk'ın başındaki
 *  markdown başlık satırı anahtara GİRMEZ — tekrar, gövde içeriğinin
 *  tekrarıdır; farklı başlık altındaki aynı metin de tekrardır. */
export function chunkDedupKey(content: string): string {
  return content
    .replace(/^#{1,6}\s+.*$/m, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr')
}

export interface AnalyzeInput {
  parsed: ParsedDocument
  chunks: KnowledgeChunk[]
  /** normalize aşamasından gelen tohum etiketler (frontmatter + çağıran). */
  seedTags: string[]
}

/**
 * Belge analizi: dedup + etiket + kategori + yapı istatistikleri tek geçişte.
 * duplicationRate = tekrar chunk / toplam chunk; uniqueChunks pipeline'ın
 * devamının çalıştığı süzülmüş listedir.
 */
export function analyzeDocument({ parsed, chunks, seedTags }: AnalyzeInput): DocumentAnalysis {
  const seen = new Set<string>()
  const uniqueChunks: KnowledgeChunk[] = []
  let duplicateChunkCount = 0

  for (const chunk of chunks) {
    const key = chunkDedupKey(chunk.content)
    if (seen.has(key)) {
      duplicateChunkCount++
      continue
    }
    seen.add(key)
    uniqueChunks.push(chunk)
  }

  // Etiket/kategori taraması kod bloklarının DIŞINDA yapılır.
  const textOutsideCode = parsed.sections
    .map((s) => {
      let body = `${s.heading}\n${s.content}`
      for (const block of s.codeBlocks) body = body.replace(block.code, ' ')
      return body
    })
    .join('\n')

  const codeLanguages = [...new Set(
    parsed.sections.flatMap((s) => s.codeBlocks.map((b) => b.language)).filter((l): l is string => Boolean(l)),
  )].map((l) => l.toLocaleLowerCase('tr'))

  const tags = extractTags(textOutsideCode, [...seedTags, ...codeLanguages])
  const category = classifyCategory(textOutsideCode, tags)

  const avgChunkChars = uniqueChunks.length > 0
    ? Math.round(uniqueChunks.reduce((sum, c) => sum + c.chars, 0) / uniqueChunks.length)
    : 0

  return {
    tags,
    category,
    duplicationRate: chunks.length > 0 ? duplicateChunkCount / chunks.length : 0,
    uniqueChunks,
    stats: {
      chunkCount: chunks.length,
      duplicateChunkCount,
      avgChunkChars,
      headingCount: parsed.headingCount,
      codeBlockCount: parsed.codeBlockCount,
      orderedStepSections: parsed.sections.filter((s) => s.orderedSteps >= 2).length,
      citationCount: parsed.citations.length,
    },
  }
}
