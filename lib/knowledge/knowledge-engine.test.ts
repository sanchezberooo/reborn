import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Knowledge Department testi (Sprint 5). İki katman (brain-engine.test.ts
// deseni):
// 1. Saf sözleşme testleri (env'siz her yerde koşar): normalize/parse/chunk/
//    analyze/quality/extract motorları + sözlük bütünlüğü (olay eşlemesi
//    RUNTIME_EVENT_TYPES'a, extraction eşlemesi COLD_NODE_TYPES'a oturur).
// 2. Canlı Supabase + lokal embedding testleri (env yoksa skip): pipeline
//    uçtan uca — markdown ingest → item + extraction node'ları + derived_from
//    kenarı + registry okuma + knowledge search.

import { COLD_NODE_TYPES } from '../brain/types'
import { RUNTIME_EVENT_TYPES } from '../runtime/types'
import { analyzeDocument, chunkDedupKey, classifyCategory, extractTags } from './analyze'
import { chunkDocument, splitParagraphsFenceSafe } from './chunk'
import { extractCandidates, EXTRACTION_WRITE_THRESHOLD, MAX_CANDIDATES_PER_KIND } from './extract'
import { normalizeSource, parseFrontmatter, parseTagList } from './normalize'
import { extractCitations, parseDocument } from './parse'
import {
  computeQuality, REJECT_THRESHOLD, REVIEW_THRESHOLD, SOURCE_TYPE_RELIABILITY,
} from './quality'
import type { QualityInput } from './quality'
import {
  EXTRACTION_CREATED_EVENT, EXTRACTION_KINDS, EXTRACTION_NODE_TYPE,
  KNOWLEDGE_EVENT_NAMES, KNOWLEDGE_SOURCE_TYPES,
} from './types'
import type { KnowledgeSourceInput } from './types'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi sentinel — diğer setlerle (…0011/…0012) çakışmaz. */
const KNOWLEDGE_USER_ID = '00000000-0000-4000-a000-000000000014'

const SAMPLE_MARKDOWN = `---
title: Reborn Deploy Rehberi
author: Bero
version: 1.2.0
tags: [deploy, ops]
---

# Reborn Deploy Rehberi

Bu rehber deploy sürecinin standardıdır. Kaynak: [Next.js docs](https://nextjs.org/docs).

## How to deploy

Deploy süreci şu adımlardan oluşur ve her adım zorunludur:

1. \`npm run build\` çalıştır ve hataları temizle
2. Migration'ları Supabase'e uygula
3. Environment değişkenlerini doğrula
4. Vercel'e push et ve smoke test yap

## Kurallar (SOP)

Deploy sırasında şu kurallara uyulması zorunlu:

- Asla cuma akşamı deploy yapma, her zaman rollback planı hazırla
- Secret'lar asla koda yazılmaz, policy gereği env üzerinden gelir
- Checklist tamamlanmadan production'a çıkılması yasak

## Config template

Aşağıdaki şablon (template) yeni ortam için başlangıç yapılandırmasıdır:

\`\`\`json
{ "region": "eu-central-1", "runtime": "nodejs20" }
\`\`\`
`

// ── 1. Sözlük bütünlüğü ─────────────────────────────────────────────────────

describe('sözlük bütünlüğü', () => {
  it('extraction eşlemesi soğuk katman tiplerine oturur (SOP → standard)', () => {
    for (const kind of EXTRACTION_KINDS) {
      expect(COLD_NODE_TYPES).toContain(EXTRACTION_NODE_TYPE[kind])
    }
    expect(EXTRACTION_NODE_TYPE.sop).toBe('standard')
  })

  it('extraction olayları runtime olay sözlüğünde tanımlı (migration 0011)', () => {
    for (const kind of EXTRACTION_KINDS) {
      expect(RUNTIME_EVENT_TYPES).toContain(EXTRACTION_CREATED_EVENT[kind])
    }
  })

  it('13 knowledge olayı sözleşmede (9 Sprint 5 + 4 Sprint 6), kaynak sözlüğü tam', () => {
    expect(KNOWLEDGE_EVENT_NAMES).toHaveLength(13)
    for (const required of [
      'github', 'pdf', 'markdown', 'website', 'youtube', 'rss', 'research',
      'docs', 'notion', 'gdrive', // Sprint 6 gelecek kanalları — sözlükte hazır
    ]) {
      expect(KNOWLEDGE_SOURCE_TYPES).toContain(required)
    }
  })

  it('PascalCase→snake_case olay eşlemesi tam ve runtime sözlüğüne oturur', async () => {
    const { KNOWLEDGE_EVENT_TYPE } = await import('./events')
    for (const name of KNOWLEDGE_EVENT_NAMES) {
      expect(RUNTIME_EVENT_TYPES).toContain(KNOWLEDGE_EVENT_TYPE[name])
    }
  })
})

// ── 2. Normalize ────────────────────────────────────────────────────────────

describe('normalize engine', () => {
  it('frontmatter ayrıştırır ve üst-veriyi damıtır', () => {
    const doc = normalizeSource({ sourceType: 'markdown', content: SAMPLE_MARKDOWN })
    expect(doc.title).toBe('Reborn Deploy Rehberi')
    expect(doc.author).toBe('Bero')
    expect(doc.version).toBe('1.2.0')
    expect(doc.tags).toContain('deploy')
    expect(doc.tags).toContain('ops')
    expect(doc.content.startsWith('# Reborn Deploy Rehberi')).toBe(true)
  })

  it('çağıran girdisi frontmatter\'dan önceliklidir', () => {
    const doc = normalizeSource({
      sourceType: 'markdown',
      content: SAMPLE_MARKDOWN,
      title: 'Override Başlık',
      author: 'Sanchez',
    })
    expect(doc.title).toBe('Override Başlık')
    expect(doc.author).toBe('Sanchez')
  })

  it('CRLF ve boş satır koşularını normalize eder, içerik metnini korur', () => {
    const doc = normalizeSource({
      sourceType: 'markdown',
      content: 'Satır bir\r\n\r\n\r\n\r\nSatır iki  \r\n',
    })
    expect(doc.content).toBe('Satır bir\n\nSatır iki')
  })

  it('frontmatter yoksa ilk başlıktan başlık türetir', () => {
    const doc = normalizeSource({ sourceType: 'markdown', content: 'Giriş.\n\n# Asıl Başlık\n\nMetin.' })
    expect(doc.title).toBe('Asıl Başlık')
  })

  it('parseFrontmatter/parseTagList sınır durumları', () => {
    expect(parseFrontmatter('içerik').frontmatter).toEqual({})
    expect(parseFrontmatter('---\nbozuk').body).toBe('---\nbozuk')
    expect(parseTagList('[a, b]')).toEqual(['a', 'b'])
    expect(parseTagList('a, b')).toEqual(['a', 'b'])
    expect(parseTagList(undefined)).toEqual([])
  })
})

// ── 3. Parse ────────────────────────────────────────────────────────────────

describe('parse engine', () => {
  const parsed = parseDocument(normalizeSource({ sourceType: 'markdown', content: SAMPLE_MARKDOWN }))

  it('başlık ağacından bölümler kurar (path breadcrumb dahil)', () => {
    const howTo = parsed.sections.find((s) => s.heading === 'How to deploy')
    expect(howTo).toBeDefined()
    expect(howTo!.level).toBe(2)
    expect(howTo!.path).toBe('Reborn Deploy Rehberi > How to deploy')
    expect(howTo!.orderedSteps).toBe(4)
  })

  it('kod bloklarını dile göre çıkarır, fence içini başlık sanmaz', () => {
    expect(parsed.codeBlockCount).toBe(1)
    const block = parsed.sections.flatMap((s) => s.codeBlocks)[0]
    expect(block.language).toBe('json')
    expect(block.code).toContain('eu-central-1')

    const tricky = parseDocument(normalizeSource({
      sourceType: 'markdown',
      content: 'Önce\n\n```\n# başlık değil\n1. adım değil\n```\n\nSonra',
    }))
    expect(tricky.headingCount).toBe(0)
    expect(tricky.sections[0].orderedSteps).toBe(0)
  })

  it('atıfları toplar: markdown linki + çıplak URL, URL bazında tekil', () => {
    expect(parsed.citations).toEqual([{ text: 'Next.js docs', url: 'https://nextjs.org/docs' }])
    const citations = extractCitations('Bkz [A](https://a.dev) ve https://a.dev ve https://b.dev.')
    expect(citations).toEqual([
      { text: 'A', url: 'https://a.dev' },
      { text: 'https://b.dev', url: 'https://b.dev' },
    ])
  })
})

// ── 4. Chunk ────────────────────────────────────────────────────────────────

describe('chunk engine', () => {
  it('küçük bölümler tek chunk olur, bölümler karışmaz', () => {
    const parsed = parseDocument(normalizeSource({ sourceType: 'markdown', content: SAMPLE_MARKDOWN }))
    const chunks = chunkDocument(parsed)
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    const paths = new Set(chunks.map((c) => c.sectionPath))
    expect(paths.size).toBeGreaterThanOrEqual(3)
  })

  it('büyük bölüm paragraf sınırından bölünür ve tavana uyar', () => {
    const bigSection = `# Büyük\n\n${Array.from({ length: 40 }, (_, i) => `Paragraf ${i} — ${'x'.repeat(120)}`).join('\n\n')}`
    const parsed = parseDocument(normalizeSource({ sourceType: 'markdown', content: bigSection }))
    const chunks = chunkDocument(parsed, { maxChars: 800 })
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) expect(chunk.chars).toBeLessThanOrEqual(800)
  })

  it('fenced kod bloğu boş satır içerse de bölünmez', () => {
    const paragraphs = splitParagraphsFenceSafe('Önce\n\n```ts\nconst a = 1\n\nconst b = 2\n```\n\nSonra')
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[1]).toContain('const a = 1\n\nconst b = 2')
  })
})

// ── 5. Analyze + belge-içi dedup ────────────────────────────────────────────

describe('analyze engine', () => {
  it('normalize-eşit chunk\'ları tekrar sayar ve süzer', () => {
    const doc = normalizeSource({
      sourceType: 'markdown',
      content: '# A\n\nAynı içerik burada.\n\n# B\n\nAYNI  içerik   burada.\n\n# C\n\nFarklı içerik.',
    })
    const parsed = parseDocument(doc)
    const chunks = chunkDocument(parsed)
    const analysis = analyzeDocument({ parsed, chunks, seedTags: [] })
    expect(analysis.stats.duplicateChunkCount).toBeGreaterThanOrEqual(1)
    expect(analysis.duplicationRate).toBeGreaterThan(0)
    expect(analysis.uniqueChunks.length).toBe(chunks.length - analysis.stats.duplicateChunkCount)
    expect(chunkDedupKey('  Aynı   metin ') ).toBe(chunkDedupKey('aynı metin'))
  })

  it('etiketler: tohum + kod dili + frekans kelimeleri, tavanlı', () => {
    const tags = extractTags('deploy deploy migration migration supabase supabase kelime', ['seed'])
    expect(tags[0]).toBe('seed')
    expect(tags).toContain('deploy')
    expect(tags).toContain('migration')
    expect(tags).not.toContain('kelime') // tek geçiş — frekans eşiği altı
  })

  it('kategori kural sözlüğü: ai > engineering önceliği, eşleşmezse general', () => {
    expect(classifyCategory('llm prompt embedding ile ajan kurduk', [])).toBe('ai')
    expect(classifyCategory('typescript api migration deploy', [])).toBe('engineering')
    expect(classifyCategory('bugün hava güzeldi', [])).toBe('general')
  })
})

// ── 6. Quality engine ───────────────────────────────────────────────────────

const QUALITY_BASE: QualityInput = {
  sourceType: 'markdown',
  author: 'Bero',
  version: '1.0',
  sourceUrl: null,
  publishedAt: null,
  citationCount: 2,
  duplicationRate: 0,
  chunkCount: 5,
  avgChunkChars: 700,
  headingCount: 4,
  codeBlockCount: 1,
  orderedStepSections: 1,
  extractionCandidateCount: 3,
  contentChars: 3500,
}

describe('quality engine', () => {
  it('yapılı, atıflı, yazarı belli belge accept alır', () => {
    const report = computeQuality(QUALITY_BASE)
    expect(report.verdict).toBe('accept')
    expect(report.trustScore).toBeGreaterThanOrEqual(REVIEW_THRESHOLD)
    for (const value of Object.values(report.dimensions)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('boş içerik ve çöp girdi reject alır', () => {
    const report = computeQuality({
      ...QUALITY_BASE,
      author: null, version: null, citationCount: 0, duplicationRate: 0.9,
      headingCount: 0, codeBlockCount: 0, orderedStepSections: 0,
      extractionCandidateCount: 0, avgChunkChars: 5000, contentChars: 0,
      sourceType: 'rss',
    })
    expect(report.verdict).toBe('reject')
    expect(report.reasons.length).toBeGreaterThan(0)
  })

  it('tekrar oranı boyutu tersine ölçeklenir', () => {
    const clean = computeQuality(QUALITY_BASE)
    const dupey = computeQuality({ ...QUALITY_BASE, duplicationRate: 0.8 })
    expect(dupey.dimensions.repetition).toBeCloseTo(0.2, 5)
    expect(dupey.trustScore).toBeLessThan(clean.trustScore)
  })

  it('kaynak türü tabanı sıralıdır (research > github > rss) ve eşikler tutarlı', () => {
    expect(SOURCE_TYPE_RELIABILITY.research).toBeGreaterThan(SOURCE_TYPE_RELIABILITY.github)
    expect(SOURCE_TYPE_RELIABILITY.github).toBeGreaterThan(SOURCE_TYPE_RELIABILITY.rss)
    expect(REJECT_THRESHOLD).toBeLessThan(REVIEW_THRESHOLD)
  })

  it('eski publishedAt güncelliği düşürür, bilinmeyen tarih nötr kalır', () => {
    const now = Date.now()
    const fresh = computeQuality({ ...QUALITY_BASE, publishedAt: new Date(now).toISOString() }, now)
    const stale = computeQuality({ ...QUALITY_BASE, publishedAt: new Date(now - 400 * 86_400_000).toISOString() }, now)
    const unknown = computeQuality({ ...QUALITY_BASE, publishedAt: null }, now)
    expect(fresh.dimensions.currency).toBeCloseTo(1, 2)
    expect(stale.dimensions.currency).toBeLessThan(0.2)
    expect(unknown.dimensions.currency).toBeCloseTo(0.7, 5)
  })
})

// ── 7. Extraction engine ────────────────────────────────────────────────────

describe('extraction engine', () => {
  const parsed = parseDocument(normalizeSource({ sourceType: 'markdown', content: SAMPLE_MARKDOWN }))
  const candidates = extractCandidates(parsed)

  it('sıralı adımlardan workflow, kural dilinden sop, işaretli koddan template çıkarır', () => {
    const kinds = new Set(candidates.map((c) => c.kind))
    expect(kinds).toContain('workflow')
    expect(kinds).toContain('sop')
    expect(kinds).toContain('template')
  })

  it('adaylar köken bölüm yolu ve [kind] önekli başlık taşır', () => {
    const workflow = candidates.find((c) => c.kind === 'workflow')!
    expect(workflow.title.startsWith('[workflow]')).toBe(true)
    expect(workflow.sectionPath).toContain('How to deploy')
    expect(workflow.confidence).toBeGreaterThanOrEqual(EXTRACTION_WRITE_THRESHOLD)
  })

  it('işaretsiz kod bloğu template SAYILMAZ, işaretli kodsuz metin de sayılmaz', () => {
    const noMarker = parseDocument(normalizeSource({
      sourceType: 'markdown',
      content: '# Örnek\n\nAçıklama metni burada yeterince uzun olsun ki aday eşiğini geçsin.\n\n```ts\nconst a = 1\n```',
    }))
    expect(extractCandidates(noMarker).filter((c) => c.kind === 'template')).toHaveLength(0)

    const noCode = parseDocument(normalizeSource({
      sourceType: 'markdown',
      content: '# Template hakkında\n\nBu bölüm template kelimesini geçirir ama kod bloğu içermez; yeterince uzun bir metin.',
    }))
    expect(extractCandidates(noCode).filter((c) => c.kind === 'template')).toHaveLength(0)
  })

  it('tür başına tavan uygulanır ve çıktı deterministiktir', () => {
    const many = `# Doc\n\n${Array.from({ length: 8 }, (_, i) =>
      `## How to task ${i}\n\nAçıklama yeterince uzun bir metin paragrafı burada durur.\n\n1. adım bir\n2. adım iki\n3. adım üç`,
    ).join('\n\n')}`
    const parsedMany = parseDocument(normalizeSource({ sourceType: 'markdown', content: many }))
    const workflows = extractCandidates(parsedMany).filter((c) => c.kind === 'workflow')
    expect(workflows.length).toBeLessThanOrEqual(MAX_CANDIDATES_PER_KIND)
    expect(extractCandidates(parsedMany)).toEqual(extractCandidates(parsedMany))
  })
})

// ── 8. Canlı pipeline (Supabase + lokal embedding) ──────────────────────────

describe.skipIf(!hasEnv)('knowledge pipeline uçtan uca (canlı Supabase + lokal embedding)', () => {
  async function adminApi() {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    return getSupabaseAdmin()
  }

  async function cleanup() {
    const supabase = await adminApi()
    // entities silinince links FK cascade ile düşer; runtime_events izi de
    // test kullanıcısı için temizlenir (append-only ilkesi üretim izi içindir,
    // test artığı için değil).
    await supabase.from('runtime_events').delete().eq('user_id', KNOWLEDGE_USER_ID)
    await supabase.from('entities').delete().eq('user_id', KNOWLEDGE_USER_ID)
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  const input: KnowledgeSourceInput = {
    sourceType: 'markdown',
    content: SAMPLE_MARKDOWN,
    sourceUrl: null,
    publishedAt: new Date().toISOString(),
  }

  it('markdown ingest: item + extraction node\'ları + derived_from + zarf', async () => {
    const { ingestKnowledge } = await import('./pipeline')
    const result = await ingestKnowledge(input, { userId: KNOWLEDGE_USER_ID })

    expect(result.outcome).toBe('stored')
    expect(result.item).toBeDefined()
    expect(result.item!.nodeType).toBe('fact')
    expect(result.item!.action).toBe('created')
    expect(result.quality.verdict).not.toBe('reject')
    expect(result.extractions.length).toBeGreaterThanOrEqual(2)

    // Zarf ve statü: her node 'aday' doğar, metadata kind taşır.
    const { getScopedNode } = await import('../brain/graph')
    const itemNode = await getScopedNode(result.item!.nodeId, 'agent')
    expect(itemNode).not.toBeNull()
    expect(itemNode!.status).toBe('aday')
    expect(itemNode!.metadata?.kind).toBe('knowledge-item')

    // Köken kenarı: extraction → item derived_from.
    const { getLinkedNodes } = await import('../brain/link-registry')
    const linked = await getLinkedNodes(result.item!.nodeId, 'derived_from')
    const incoming = linked.filter((l) => l.direction === 'incoming')
    expect(incoming.length).toBe(result.extractions.length)
  }, 300_000)

  it('aynı belge ikinci kez: CONFIRM (yeni node yok, doğrulama sayılır)', async () => {
    const { ingestKnowledge } = await import('./pipeline')
    const first = await ingestKnowledge(input, { userId: KNOWLEDGE_USER_ID })
    const again = await ingestKnowledge(input, { userId: KNOWLEDGE_USER_ID })
    expect(again.item!.action).toBe('confirmed')
    expect(again.item!.nodeId).toBe(first.item!.nodeId)
  }, 300_000)

  it('registry: item zarfı okunur, inceleme kararı statü + olay üretir', async () => {
    const { listKnowledgeItems, getKnowledgeItem, listExtractions, reviewKnowledgeNode } = await import('./registry')

    const items = await listKnowledgeItems({ limit: 10 })
    const item = items.find((i) => i.title === 'Reborn Deploy Rehberi')
    expect(item).toBeDefined()
    expect(item!.author).toBe('Bero')
    expect(item!.trustScore).toBeGreaterThan(0)
    expect(item!.freshness).toBeGreaterThan(0.9)
    expect(item!.extractedWorkflows.length + item!.extractedSops.length + item!.extractedTemplates.length)
      .toBeGreaterThanOrEqual(2)

    const full = await getKnowledgeItem(item!.id)
    expect(full!.citations).toEqual([{ text: 'Next.js docs', url: 'https://nextjs.org/docs' }])

    const extractions = await listExtractions({ limit: 20 })
    expect(extractions.some((e) => e.itemNodeId === item!.id)).toBe(true)

    const reviewed = await reviewKnowledgeNode(item!.id, 'approve')
    expect(reviewed.status).toBe('doğrulanmış')
  }, 300_000)

  it('knowledge search: tip filtresiyle Brain Search üzerinden bulur', async () => {
    const { searchKnowledge } = await import('./search')
    const results = await searchKnowledge('deploy süreci adımları', {
      userId: KNOWLEDGE_USER_ID,
      kinds: ['item', 'workflow', 'sop'],
      limit: 5,
    })
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(['item', 'workflow', 'sop']).toContain(r.kind)
    }
  }, 300_000)
})
