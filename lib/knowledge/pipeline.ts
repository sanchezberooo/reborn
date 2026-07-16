// Knowledge Pipeline orkestratörü (Sprint 5) — Source → … → Brain Update
// hattının tek giriş kapısı: ingestKnowledge. 'server-only': DB/bus erişimi
// yalnız bu katmanda; aşama motorları (normalize/parse/chunk/analyze/quality/
// extract) SAF'tır ve buradan sırayla çağrılır.
//
// AŞAMA HARİTASI (sprint sözleşmesi → kod):
//   Source/Fetch        → çağıranın işi (v1: markdown inline, github mevcut
//                         source-fetcher; pipeline HAM İÇERİK alır — bkz.
//                         types.ts KnowledgeSourceInput notu)
//   Normalize           → normalize.ts
//   Parse               → parse.ts
//   Chunk               → chunk.ts
//   Analyze+Deduplicate → analyze.ts (belge-içi dedup; Brain-düzeyi dedup
//                         applyBrainUpdate'in HNSW hattıdır — tek formül)
//   Relationship/Graph  → applyBrainUpdate autoLink + derived_from kenarları
//   Knowledge/Skill/Workflow/Pattern/SOP/Template Extraction → extract.ts
//   Quality Score       → quality.ts (reject → HİÇ yazım yok)
//   Brain Update        → lib/brain/update-engine.ts applyBrainUpdate (TEK
//                         yazma kapısı — ikinci bir insert yolu açılmadı)
//
// GÜVENLİ YAZIM: her node scope='agent', status='aday' doğar (yaşam döngüsü
// korunur — doğrulama Registry inceleme yolunun işidir); extraction'lar
// kaynağa derived_from ile bağlanır (köken şeffaflığı kenarda yaşar);
// çakışma adayları KARAR VERİLMEDEN rapor edilir (update-engine ilkesi).

import 'server-only'
import { applyBrainUpdate } from '../brain/update-engine'
import { linkNodes } from '../brain/link-registry'
import { resolveSingleUserId } from '../db-server'
import { analyzeDocument } from './analyze'
import { chunkDocument } from './chunk'
import { publishKnowledgeEvent } from './events'
import { extractCandidates, EXTRACTION_WRITE_THRESHOLD } from './extract'
import { normalizeSource } from './normalize'
import { parseDocument } from './parse'
import { computeQuality } from './quality'
import { KNOWN_SOURCE_TYPES } from './source-fetcher'
import type {
  ExtractionKind, ExtractionMeta, KnowledgeEventName, KnowledgeItemMeta,
  KnowledgePipelineResult, KnowledgeSourceInput,
} from './types'
import { EXTRACTION_NODE_TYPE } from './types'

export const KNOWLEDGE_PIPELINE_VERSION = 1

/** Sözleşme adları types.ts KNOWLEDGE_EVENT_NAMES'ten; extraction eşlemesi
 *  EXTRACTION_CREATED_EVENT'in PascalCase yüzü. best-practice/anti-pattern
 *  pattern node'u doğurur → PatternCreated; technology metin extraction'ından
 *  gelmez (ingestion.ts bağımlılık envanterinden yazar) ama Record tam
 *  kapsanır — derleyici yeni tür eklendiğinde burayı da zorlar. */
const EXTRACTION_EVENT_NAME: Record<ExtractionKind, KnowledgeEventName> = {
  skill: 'SkillCreated',
  workflow: 'WorkflowCreated',
  pattern: 'PatternCreated',
  sop: 'SOPCreated',
  template: 'TemplateCreated',
  technology: 'KnowledgeExtracted',
  'best-practice': 'PatternCreated',
  'anti-pattern': 'PatternCreated',
}

export interface IngestOptions {
  /** Test izolasyonu; verilmezse tek profil (resolveSingleUserId). */
  userId?: string
  /** Extraction yazım eşiği override'ı (kalibrasyon kanalı). */
  extractionThreshold?: number
}

function assertInput(input: KnowledgeSourceInput): void {
  if (!(KNOWN_SOURCE_TYPES as readonly string[]).includes(input.sourceType)) {
    throw new Error(`ingestKnowledge: '${String(input.sourceType)}' tanımlı bir kaynak türü değil — bilinen türler: ${KNOWN_SOURCE_TYPES.join(', ')}.`)
  }
  if (typeof input.content !== 'string' || !input.content.trim()) {
    throw new Error('ingestKnowledge: content boş olamaz — pipeline ham içerik alır, kaynak çekimi çağıranın işidir.')
  }
}

/**
 * Knowledge Pipeline'ın tek giriş kapısı. Dönen sonuç ŞEFFAFTIR: kalite
 * raporu, yazım kararları (created/confirmed/superseded), yazılmayan adaylar,
 * otomatik bağlar ve çakışma adayları çağırana eksiksiz raporlanır.
 *
 * reject yolunda Brain'e HİÇBİR yazım olmaz; yalnız knowledge_rejected olayı
 * düşer (iz kalır, veri kalmaz — kalite kapısının anlamı budur).
 */
export async function ingestKnowledge(
  input: KnowledgeSourceInput,
  opts: IngestOptions = {},
): Promise<KnowledgePipelineResult> {
  assertInput(input)
  const userId = opts.userId ?? (await resolveSingleUserId())
  const threshold = opts.extractionThreshold ?? EXTRACTION_WRITE_THRESHOLD

  // ── Saf aşamalar ──────────────────────────────────────────────────────────
  const normalized = normalizeSource(input)
  const parsed = parseDocument(normalized)
  const chunks = chunkDocument(parsed)
  const analysis = analyzeDocument({ parsed, chunks, seedTags: normalized.tags })
  const candidates = extractCandidates(parsed)

  const quality = computeQuality({
    sourceType: input.sourceType,
    author: normalized.author,
    version: normalized.version,
    sourceUrl: input.sourceUrl ?? null,
    publishedAt: input.publishedAt ?? null,
    citationCount: parsed.citations.length,
    duplicationRate: analysis.duplicationRate,
    chunkCount: analysis.stats.chunkCount,
    avgChunkChars: analysis.stats.avgChunkChars,
    headingCount: analysis.stats.headingCount,
    codeBlockCount: analysis.stats.codeBlockCount,
    orderedStepSections: analysis.stats.orderedStepSections,
    extractionCandidateCount: candidates.length,
    contentChars: normalized.content.length,
  })

  const analysisReport = {
    tags: analysis.tags,
    category: analysis.category,
    duplicationRate: analysis.duplicationRate,
    stats: analysis.stats,
  }

  // ── Kalite kapısı ─────────────────────────────────────────────────────────
  if (quality.verdict === 'reject') {
    await publishKnowledgeEvent({
      name: 'KnowledgeRejected',
      userId,
      detail: {
        title: normalized.title,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl ?? null,
        trustScore: quality.trustScore,
        reasons: quality.reasons,
      },
    })
    return {
      outcome: 'rejected',
      quality,
      analysis: analysisReport,
      extractions: [],
      skippedExtractions: candidates.map((c) => ({ kind: c.kind, title: c.title, confidence: c.confidence })),
      autoLinked: [],
      conflictCandidates: [],
    }
  }

  // ── Brain Update: knowledge item ──────────────────────────────────────────
  const itemMeta: KnowledgeItemMeta = {
    kind: 'knowledge-item',
    source: {
      type: input.sourceType,
      url: input.sourceUrl ?? null,
      title: normalized.title,
    },
    author: normalized.author,
    version: normalized.version,
    trustScore: quality.trustScore,
    quality: quality.dimensions,
    qualityVerdict: quality.verdict,
    tags: analysis.tags,
    category: analysis.category,
    citations: parsed.citations,
    ingest: {
      pipelineVersion: KNOWLEDGE_PIPELINE_VERSION,
      ingestedAt: new Date().toISOString(),
      chunkCount: analysis.stats.chunkCount,
      duplicateChunkCount: analysis.stats.duplicateChunkCount,
    },
  }

  // github kaynağı 'repository' bilgi kartıdır (Sprint 2 sözlüğü); diğer her
  // kaynak damıtılmış bilgi olarak 'fact' tipinde yaşar.
  const itemType = input.sourceType === 'github' ? 'repository' : 'fact'
  const itemUpdate = await applyBrainUpdate({
    userId,
    scope: 'agent',
    type: itemType,
    title: normalized.title,
    content: normalized.content,
    metadata: itemMeta,
  })

  await publishKnowledgeEvent({
    name: itemUpdate.action === 'created' ? 'KnowledgeAdded' : 'KnowledgeUpdated',
    userId,
    nodeId: itemUpdate.node.id,
    detail: {
      title: normalized.title,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      action: itemUpdate.action,
      trustScore: quality.trustScore,
      category: analysis.category,
      ...(itemUpdate.supersededNodeId ? { supersededNodeId: itemUpdate.supersededNodeId } : {}),
    },
  })

  // ── Brain Update: extraction'lar ──────────────────────────────────────────
  const extractions: KnowledgePipelineResult['extractions'] = []
  const skippedExtractions: KnowledgePipelineResult['skippedExtractions'] = []
  const autoLinked = [...itemUpdate.autoLinked]
  const conflictCandidates = [...itemUpdate.conflictCandidates]

  for (const candidate of candidates) {
    if (candidate.confidence < threshold) {
      skippedExtractions.push({ kind: candidate.kind, title: candidate.title, confidence: candidate.confidence })
      continue
    }

    const extractionMeta: ExtractionMeta = {
      kind: 'knowledge-extraction',
      extractionKind: candidate.kind,
      confidence: candidate.confidence,
      sectionPath: candidate.sectionPath,
      itemNodeId: itemUpdate.node.id,
    }
    const update = await applyBrainUpdate({
      userId,
      scope: 'agent',
      type: EXTRACTION_NODE_TYPE[candidate.kind],
      title: candidate.title,
      content: candidate.content,
      metadata: extractionMeta,
    })

    // Köken kenarı her kararda kurulur (idempotent upsert): CONFIRM'de bile
    // mevcut extraction bu kaynaktan da türedi bilgisi grafa işlenmeli.
    if (update.node.id !== itemUpdate.node.id) {
      await linkNodes(update.node.id, itemUpdate.node.id, 'derived_from')
    }

    autoLinked.push(...update.autoLinked)
    conflictCandidates.push(...update.conflictCandidates)
    extractions.push({
      kind: candidate.kind,
      nodeId: update.node.id,
      title: update.node.title,
      action: update.action,
      confidence: candidate.confidence,
    })

    // *_created olayı yalnız yeni bilgi doğduğunda (created/superseded);
    // CONFIRM tekrar gören doğrulamadır, doğum değil.
    if (update.action !== 'confirmed') {
      await publishKnowledgeEvent({
        name: EXTRACTION_EVENT_NAME[candidate.kind],
        userId,
        nodeId: update.node.id,
        detail: {
          title: update.node.title,
          itemNodeId: itemUpdate.node.id,
          confidence: candidate.confidence,
          action: update.action,
        },
      })
    }
  }

  return {
    outcome: 'stored',
    quality,
    analysis: analysisReport,
    item: {
      nodeId: itemUpdate.node.id,
      nodeType: itemType,
      action: itemUpdate.action,
      ...(itemUpdate.supersededNodeId ? { supersededNodeId: itemUpdate.supersededNodeId } : {}),
    },
    extractions,
    skippedExtractions,
    autoLinked,
    conflictCandidates,
  }
}
