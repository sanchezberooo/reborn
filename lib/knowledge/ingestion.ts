// Knowledge Ingestion Engine orkestratörü (Sprint 6) — dış kaynaktan Brain'e
// giden TAM hattın tek giriş kapısı: kaynak adaptörü (sources.ts) çeker ve
// analiz eder, Sprint 5 pipeline'ı (pipeline.ts ingestKnowledge) her belgeyi
// damıtır, bu katman repo kartını + teknoloji node'larını yazar ve organizma
// olaylarını yayınlar. 'server-only'.
//
// TEK YAZIM NOKTASI KORUNUR: buradaki her node applyBrainUpdate'ten geçer
// (repo kartı ve teknoloji node'ları dahil) — dedup/supersede/auto-link/
// çakışma tespiti Brain Update Engine'in işidir, burada tekrarlanmaz.
//
// REVIEW QUEUE SÖZLEŞMESİ: bu hattan doğan HİÇBİR node doğrudan güvenilir
// bilgi olmaz — hepsi status='aday' doğar (Agent Brain yaşam döngüsü) ve
// lib/knowledge/review-queue.ts yüzeyinde bekler; terfi insan/ajan kararıdır.

import 'server-only'
import { applyBrainUpdate } from '../brain/update-engine'
import { linkNodes } from '../brain/link-registry'
import { resolveSingleUserId } from '../db-server'
import { publishKnowledgeEvent } from './events'
import { ingestKnowledge } from './pipeline'
import type { RepositoryAnalysis } from './repo-analyzer'
import { resolveSource } from './sources'
import type { SourceRequest } from './sources'
import type { SourceFetchError } from './source-fetcher'
import type { ExtractionMeta, KnowledgeItemMeta, KnowledgePipelineResult } from './types'
import { EXTRACTION_NODE_TYPE } from './types'

/** Repo başına yazılacak teknoloji node'u tavanı: framework'ler önce,
 *  kalan kontenjan yüksek-sinyalli runtime bağımlılıklarına. */
export const MAX_TECHNOLOGY_NODES = 8
/** Teknoloji extraction'ının sabit güveni — bağımlılık envanteri metin
 *  heuristiğinden daha kesin bir kanıttır. */
export const TECHNOLOGY_CONFIDENCE = 0.9

export interface IngestSourceOptions {
  /** Test izolasyonu; verilmezse tek profil (resolveSingleUserId). */
  userId?: string
}

export interface IngestedDocumentResult {
  title: string
  result: KnowledgePipelineResult
}

export interface IngestRepositoryResult {
  outcome: 'stored'
  sourceUrl: string
  repoCard: {
    nodeId: string
    action: 'created' | 'confirmed' | 'superseded'
  }
  analysis: RepositoryAnalysis
  documents: IngestedDocumentResult[]
  technologies: { name: string; nodeId: string; action: 'created' | 'confirmed' | 'superseded' }[]
  /** Adaptörün çekemediği parçalar (şeffaflık). */
  skipped: { path: string; reason: string }[]
  totals: {
    documentsStored: number
    documentsRejected: number
    extractions: number
    technologies: number
  }
}

export type IngestRepositoryOutcome = IngestRepositoryResult | SourceFetchError

/** Repo kartının embedding/arama yüzeyi — analizin metinleşmiş özeti.
 *  Deterministiktir: aynı analiz aynı metni üretir (Brain dedup'unun CONFIRM
 *  yolu yeniden içe alımda ancak böyle çalışır). README kartın içine GİRMEZ —
 *  README ayrı bir belge olarak damıtılır, kart repo'nun kimlik özetidir. */
export function buildRepoCardContent(analysis: RepositoryAnalysis): string {
  const lines: string[] = [
    `GitHub repository: ${analysis.owner}/${analysis.name}`,
    analysis.description ? `Açıklama: ${analysis.description}` : null,
    analysis.topics.length > 0 ? `Topics: ${analysis.topics.join(', ')}` : null,
    `Sınıflama: ${analysis.classification.primary} (${analysis.classification.labels.join(', ')})`,
    analysis.primaryLanguage ? `Ana dil: ${analysis.primaryLanguage}` : null,
    Object.keys(analysis.languages).length > 0
      ? `Diller: ${Object.entries(analysis.languages).map(([l, p]) => `${l} %${p}`).join(', ')}`
      : null,
    analysis.frameworks.length > 0 ? `Framework/teknolojiler: ${analysis.frameworks.join(', ')}` : null,
    analysis.license ? `Lisans: ${analysis.license}` : null,
    `Aktivite: ${analysis.activity}`,
    analysis.structure.topLevelDirs.length > 0
      ? `Üst düzey dizinler: ${analysis.structure.topLevelDirs.slice(0, 15).join(', ')}`
      : null,
    `Yapı: ${[
      analysis.structure.isMonorepo ? 'monorepo' : null,
      analysis.structure.hasTests ? 'testli' : 'testsiz',
      analysis.structure.hasDocs ? 'docs/ var' : null,
      analysis.structure.hasCi ? 'CI var' : null,
      analysis.structure.hasExamples ? 'örnekler var' : null,
    ].filter(Boolean).join(', ')}`,
  ].filter((l): l is string => l !== null)
  return lines.join('\n')
}

/** Yazılacak teknoloji listesi: framework etiketleri önce (en güçlü sinyal),
 *  kalan kontenjan runtime (dev olmayan) bağımlılıklardan bilinen imzalılar
 *  DIŞINDA kalanlarla DOLDURULMAZ — tanınmayan paket adı teknoloji bilgisi
 *  değildir (gürültü reddi). */
export function selectTechnologies(analysis: RepositoryAnalysis): string[] {
  return analysis.frameworks.slice(0, MAX_TECHNOLOGY_NODES)
}

/**
 * GitHub reposunu içe alır — Sprint 6'nın ana kapısı. Beklenen kaynak
 * hataları (geçersiz URL, 404, rate limit) fırlatılmaz, { ok:false, error }
 * döner (source-fetcher sözleşmesi); Brain/DB hataları fırlatılır (bunlar
 * beklenmeyen altyapı arızalarıdır, sessizce yutulmaz).
 */
export async function ingestGitHubRepository(
  sourceUrl: string,
  opts: IngestSourceOptions = {},
): Promise<IngestRepositoryOutcome> {
  const resolved = await resolveSource({ sourceType: 'github', sourceUrl })
  if ('ok' in resolved) return resolved
  if (!resolved.repository) {
    return { ok: false, error: 'GitHub adaptörü repository analizi döndürmedi — beklenmeyen adaptör durumu.' }
  }
  const userId = opts.userId ?? (await resolveSingleUserId())
  const analysis = resolved.repository

  // ── 1. Repo kartı (type='repository' — Sprint 2 sözlüğü) ─────────────────
  const cardMeta: KnowledgeItemMeta = {
    kind: 'knowledge-item',
    source: {
      type: 'github',
      url: `https://github.com/${analysis.owner}/${analysis.name}`,
      title: `${analysis.owner}/${analysis.name}`,
    },
    author: analysis.owner,
    version: null,
    // Kartın güveni analizden türetilir: dokümantasyon kalitesi + aktivite.
    // Kart bir BELGE değildir — kalite motorunun metin boyutları (chunk/
    // tekrar) ona uygulanmaz; bu iki sinyal kartın envanter değeridir.
    trustScore: Math.min(1, 0.4 + analysis.documentationQuality * 0.3 + (analysis.activity === 'active' ? 0.2 : analysis.activity === 'maintained' ? 0.15 : 0)),
    quality: {
      reliability: 0.8, // github kaynak tabanı (quality.ts SOURCE_TYPE_RELIABILITY)
      currency: analysis.activity === 'active' ? 1 : analysis.activity === 'maintained' ? 0.8 : analysis.activity === 'stale' ? 0.5 : 0.2,
      repetition: 1,
      usability: analysis.readmeQuality,
      sourceQuality: analysis.documentationQuality,
      applicability: analysis.classification.confidence,
    },
    qualityVerdict: 'accept',
    tags: [...new Set([...analysis.topics, ...analysis.classification.labels])].slice(0, 10),
    category: 'engineering',
    citations: [],
    ingest: {
      pipelineVersion: 1,
      ingestedAt: new Date().toISOString(),
      chunkCount: 0,
      duplicateChunkCount: 0,
    },
    repository: analysis,
  }

  const card = await applyBrainUpdate({
    userId,
    scope: 'agent',
    type: 'repository',
    title: `${analysis.owner}/${analysis.name}`,
    content: buildRepoCardContent(analysis),
    metadata: cardMeta,
  })

  // ── 2. Belgeler (README + docs) — Sprint 5 pipeline'ı yeniden kullanılır ──
  const documents: IngestedDocumentResult[] = []
  let documentsStored = 0
  let documentsRejected = 0
  let extractionCount = 0

  for (const doc of resolved.documents) {
    const result = await ingestKnowledge(doc, { userId })
    documents.push({ title: doc.title ?? '(başlıksız belge)', result })
    if (result.outcome === 'stored' && result.item) {
      documentsStored++
      extractionCount += result.extractions.length
      // Belge repo'dan türedi — kart grafın kökü (kendine bağ kurulmaz:
      // belge içeriği kart içeriğiyle çakışıp CONFIRM'e düşerse id eşitlenir).
      if (result.item.nodeId !== card.node.id) {
        await linkNodes(result.item.nodeId, card.node.id, 'derived_from')
      }
    } else {
      documentsRejected++
    }
  }

  // ── 3. Teknoloji node'ları (tool_reference) ──────────────────────────────
  // İçerik bilinçli repo-bağımsızdır: aynı teknoloji ikinci repodan gelince
  // Brain dedup'u CONFIRM üretir (confidence artar) — teknoloji bilgisi
  // repolar boyunca doğrulanarak güçlenir; köken izi derived_from kenarında.
  const technologies: IngestRepositoryResult['technologies'] = []
  for (const name of selectTechnologies(analysis)) {
    const techMeta: ExtractionMeta = {
      kind: 'knowledge-extraction',
      extractionKind: 'technology',
      confidence: TECHNOLOGY_CONFIDENCE,
      sectionPath: '(dependency-inventory)',
      itemNodeId: card.node.id,
    }
    const update = await applyBrainUpdate({
      userId,
      scope: 'agent',
      type: EXTRACTION_NODE_TYPE.technology,
      title: `[technology] ${name}`,
      content: `${name} — bağımlılık envanterinden tespit edilen teknoloji/framework.`,
      metadata: techMeta,
    })
    if (update.node.id !== card.node.id) {
      await linkNodes(update.node.id, card.node.id, 'derived_from')
    }
    technologies.push({ name, nodeId: update.node.id, action: update.action })
    if (update.action !== 'confirmed') {
      await publishKnowledgeEvent({
        name: 'KnowledgeExtracted',
        userId,
        nodeId: update.node.id,
        detail: { extractionKind: 'technology', name, repoCardNodeId: card.node.id },
      })
    }
  }

  // ── 4. Organizma olayı ────────────────────────────────────────────────────
  const totals = {
    documentsStored,
    documentsRejected,
    extractions: extractionCount,
    technologies: technologies.length,
  }
  await publishKnowledgeEvent({
    name: card.action === 'created' ? 'RepositoryImported' : 'RepositoryUpdated',
    userId,
    nodeId: card.node.id,
    detail: {
      sourceUrl: `https://github.com/${analysis.owner}/${analysis.name}`,
      action: card.action,
      classification: analysis.classification.primary,
      activity: analysis.activity,
      ...totals,
    },
  })

  return {
    outcome: 'stored',
    sourceUrl: `https://github.com/${analysis.owner}/${analysis.name}`,
    repoCard: { nodeId: card.node.id, action: card.action },
    analysis,
    documents,
    technologies,
    skipped: resolved.skipped,
    totals,
  }
}

/** Inline belge içe alımı (markdown/text/json/yaml/code) — adaptör üzerinden
 *  tek belgeye çözülür ve Sprint 5 pipeline'ına verilir. GitHub isteği bu
 *  kapıya gelirse doğru kapıya yönlendirilmez, net hata döner (iki kapının
 *  sözleşmesi farklı — sessiz yönlendirme sürpriz üretir). */
export async function ingestInlineDocument(
  request: SourceRequest,
  opts: IngestSourceOptions = {},
): Promise<KnowledgePipelineResult | SourceFetchError> {
  if (request.sourceType === 'github') {
    return { ok: false, error: 'GitHub içe alımı ingestGitHubRepository kapısını kullanır — inline kapıya github isteği verilemez.' }
  }
  const resolved = await resolveSource(request)
  if ('ok' in resolved) return resolved
  const userId = opts.userId ?? (await resolveSingleUserId())
  // Inline adaptör tek belge üretir (sözleşme) — güvence altına alınır.
  const [doc] = resolved.documents
  if (!doc) return { ok: false, error: 'Kaynak adaptörü belge üretmedi.' }
  return ingestKnowledge(doc, { userId })
}
