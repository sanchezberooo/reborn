// Knowledge Department tip sözlüğü (Sprint 5) — pipeline aşama sözleşmeleri,
// Knowledge Item zarfı, extraction/olay sözlükleri. Yalnız tip + sabit içerir;
// runtime bağımlılığı yok, her yerden import edilebilir (lib/brain/types.ts
// deseni). Davranış motor dosyalarındadır: normalize/parse/chunk/analyze/
// quality/extract (SAF — env'siz test edilir) + pipeline/registry/search/
// events ('server-only' — DB/bus erişimi).
//
// MİMARİ İLKE (Sprint 5): Knowledge Department Brain Engine'in ÜZERİNE
// kurulur, yanına değil — bilgi entities/links'te yaşar, yazım tek kapıdan
// (applyBrainUpdate) geçer, olaylar tek omurgadan (RuntimeEventBus) akar.
// İkinci bir depolama, ikinci bir dedup formülü, ikinci bir olay sistemi YOK.

import type { ColdNodeType } from '../brain/types'
import type { RuntimeEventType } from '../runtime/types'
import type { RepositoryAnalysis } from './repo-analyzer'
import type { KnownSourceType } from './source-fetcher'

// ── Kaynak sözlüğü ──────────────────────────────────────────────────────────
// Tek doğruluk kaynağı lib/knowledge/source-fetcher.ts KNOWN_SOURCE_TYPES'tır
// (github/pdf/markdown/website/youtube/rss/research); burada yalnız
// departman-yüzü adıyla yeniden dışa verilir — ikinci liste tutulmaz.

export type { KnownSourceType as KnowledgeSourceType } from './source-fetcher'
export { KNOWN_SOURCE_TYPES as KNOWLEDGE_SOURCE_TYPES } from './source-fetcher'

// ── Kategori sözlüğü ────────────────────────────────────────────────────────
// Rule-based sınıflama (lib/knowledge/analyze.ts) bu dar sözlüğe eşler;
// serbest metin kategorisi bilinçli YOK — filtrelenebilirlik önce gelir.

export const KNOWLEDGE_CATEGORIES = [
  'engineering', // kod, mimari, teknik altyapı
  'ai',          // model, prompt, ajan sistemleri
  'product',     // ürün, tasarım, kullanıcı
  'process',     // süreç, operasyon, yönetim
  'research',    // akademik/deneysel bilgi
  'general',     // sınıflanamayan geri kalan
] as const
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number]

// ── Extraction sözlüğü ──────────────────────────────────────────────────────
// Sprint 2 eşlemesi korunur: SOP → 'standard' cold tipi; skill/workflow/
// pattern/template aynı ad. Sprint 6 eklemeleri: technology → 'tool_reference'
// (bağımlılık/framework envanterinden — repo-analyzer üretir, metin
// heuristiği değil); best-practice / anti-pattern → 'pattern' node'u (aynı
// tip, ayrım metadata.extractionKind'dadır — pattern'in iki kutbu için yeni
// entity tipi açılmadı, tip patlaması reddi). Extraction node'ları
// applyBrainUpdate ile scope='agent', status='aday' doğar ve kaynağa
// derived_from kenarıyla bağlanır.

export const EXTRACTION_KINDS = [
  'skill', 'workflow', 'pattern', 'sop', 'template',
  'technology', 'best-practice', 'anti-pattern',
] as const
export type ExtractionKind = (typeof EXTRACTION_KINDS)[number]

export const EXTRACTION_NODE_TYPE: Record<ExtractionKind, ColdNodeType> = {
  skill: 'skill',
  workflow: 'workflow',
  pattern: 'pattern',
  sop: 'standard',
  template: 'template',
  technology: 'tool_reference',
  'best-practice': 'pattern',
  'anti-pattern': 'pattern',
}

/** Extraction doğduğunda yayınlanan olay (migration 0011 + 0012 sözlüğü).
 *  best-practice/anti-pattern pattern node'u doğurur → pattern_created;
 *  technology için knowledge_extracted (0012). */
export const EXTRACTION_CREATED_EVENT: Record<ExtractionKind, RuntimeEventType> = {
  skill: 'skill_created',
  workflow: 'workflow_created',
  pattern: 'pattern_created',
  sop: 'sop_created',
  template: 'template_created',
  technology: 'knowledge_extracted',
  'best-practice': 'pattern_created',
  'anti-pattern': 'pattern_created',
}

// ── Pipeline aşama zarfları ─────────────────────────────────────────────────

/** Belge biçimi (Sprint 6) — kaynak KANALINDAN (sourceType) ayrı kavram:
 *  kanal bilginin nereden geldiğini, format ham içeriğin nasıl normalize
 *  edileceğini söyler. json/yaml/code fenced blok olarak sarılır (yapı
 *  korunur, embedding/analiz metin yüzeyinde çalışır); text olduğu gibi
 *  geçer; markdown varsayılandır. */
export const DOCUMENT_FORMATS = ['markdown', 'text', 'json', 'yaml', 'code'] as const
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number]

/** Pipeline girdisi. content HAM metindir — kaynak çekimi pipeline'ın işi
 *  DEĞİLDİR: GitHub içeriği kaynak adaptöründen (lib/knowledge/sources.ts),
 *  inline belgeler doğrudan çağırandan gelir; PDF/website/youtube/rss/
 *  research/docs/notion/gdrive adaptörleri ileriki sprintlerin işidir
 *  (sözlükte ve adaptör registry'sinde yerleri hazır). */
export interface KnowledgeSourceInput {
  sourceType: KnownSourceType
  /** Kaynak adresi (github/website/rss/research/youtube); markdown'da null olabilir. */
  sourceUrl?: string | null
  /** Ham içerik — zorunlu; boş içerik pipeline'a giremez. */
  content: string
  /** Belge biçimi — verilmezse 'markdown'. */
  format?: DocumentFormat
  /** format='code' için fence dili (örn 'ts', 'py'); diğer formatlarda yok sayılır. */
  language?: string
  title?: string
  author?: string | null
  version?: string | null
  /** Kaynağın yayın/güncelleme tarihi (ISO) — güncellik boyutunun çapası;
   *  verilmezse güncellik nötr kabul edilir (bilinmeyen tarih ceza değildir). */
  publishedAt?: string | null
  /** Çağıranın el ile verdiği etiketler — analiz etiketleriyle birleşir. */
  tags?: string[]
}

/** Normalize aşaması çıktısı: satır sonları/boşluk normalize edilmiş içerik +
 *  frontmatter'dan damıtılan üst-veri. */
export interface NormalizedDocument {
  title: string
  content: string
  author: string | null
  version: string | null
  tags: string[]
  /** Ayrıştırılan YAML frontmatter'ın ham anahtar/değerleri (varsa). */
  frontmatter: Record<string, string>
}

export interface ParsedCodeBlock {
  language: string | null
  code: string
  /** Ait olduğu bölümün başlık yolu (breadcrumb). */
  sectionPath: string
}

export interface ParsedSection {
  /** Başlık metni; belge başı başlıksız içerik için ''. */
  heading: string
  /** Markdown başlık seviyesi (1-6); başlıksız giriş bölümü için 0. */
  level: number
  /** Kök→bu bölüm başlık yolu ("A > B" biçimi). */
  path: string
  /** Bölümün gövde metni (alt bölümler HARİÇ, kod blokları DAHİL). */
  content: string
  /** Bölümdeki sıralı liste adım sayısı (1. 2. 3. …). */
  orderedSteps: number
  /** Bölümdeki madde imli satır sayısı. */
  bulletItems: number
  codeBlocks: ParsedCodeBlock[]
}

export interface Citation {
  text: string
  url: string
}

export interface ParsedDocument {
  title: string
  sections: ParsedSection[]
  /** Belgedeki tüm linkler — Knowledge Item'ın citations alanının kaynağı. */
  citations: Citation[]
  codeBlockCount: number
  headingCount: number
}

export interface KnowledgeChunk {
  index: number
  /** Ait olduğu bölümün başlık yolu. */
  sectionPath: string
  content: string
  chars: number
}

/** Analiz aşaması: belge-düzeyi türetilmiş sinyaller (SAF — LLM yok;
 *  anlamsal derinleştirme Knowledge Agent'ın ileriki görevi). */
export interface DocumentAnalysis {
  tags: string[]
  category: KnowledgeCategory
  /** Normalize-eşit chunk oranı [0,1] — kalite motorunun tekrar boyutu. */
  duplicationRate: number
  /** Tekrar süzülmüş chunk listesi (pipeline devamı bununla çalışır). */
  uniqueChunks: KnowledgeChunk[]
  stats: {
    chunkCount: number
    duplicateChunkCount: number
    avgChunkChars: number
    headingCount: number
    codeBlockCount: number
    orderedStepSections: number
    citationCount: number
  }
}

// ── Kalite motoru ───────────────────────────────────────────────────────────

/** Sprint 5 kalite boyutları — hepsi [0,1]. */
export interface QualityDimensions {
  /** Güvenilirlik: kaynak türü tabanı + yazar/atıf sinyalleri. */
  reliability: number
  /** Güncellik: publishedAt tazeliği (bilinmiyorsa nötr). */
  currency: number
  /** Tekrar oranı (tersine çevrilmiş): 1 − duplicationRate. */
  repetition: number
  /** Kullanılabilirlik: yapı sinyalleri (başlık/adım/kod/okunur chunk boyu). */
  usability: number
  /** Kaynak kalitesi: üst-veri bütünlüğü (başlık/yazar/versiyon/url/atıf). */
  sourceQuality: number
  /** Uygulanabilirlik: eyleme dönüştürülebilirlik (extraction yoğunluğu). */
  applicability: number
}

export type QualityVerdict = 'accept' | 'review' | 'reject'

export interface QualityReport {
  dimensions: QualityDimensions
  /** Ağırlıklı harman [0,1] — Knowledge Item'ın trustScore alanı. */
  trustScore: number
  verdict: QualityVerdict
  /** İnsan-okur gerekçeler (düşük boyutlar buraya cümle düşürür). */
  reasons: string[]
}

// ── Extraction motoru ───────────────────────────────────────────────────────

export interface ExtractionCandidate {
  kind: ExtractionKind
  title: string
  content: string
  /** Heuristik güven [0,1] — eşik altı adaylar Brain'e YAZILMAZ, raporda kalır. */
  confidence: number
  /** Adayın çıkarıldığı bölüm yolu (köken şeffaflığı). */
  sectionPath: string
}

// ── Knowledge Item zarfı (entities.metadata) ────────────────────────────────

/** entities.metadata altında saklanan yapılandırılmış zarf. `kind` alanı
 *  Registry'nin containment filtresidir (metadata @> {"kind": …}).
 *  `type` alias BİLİNÇLİ (interface değil): Record<string, unknown> tipli
 *  metadata kanalına cast hack'siz atanabilirlik için. */
export type KnowledgeItemMeta = {
  kind: 'knowledge-item'
  source: {
    type: KnownSourceType
    url: string | null
    title: string
  }
  author: string | null
  version: string | null
  /** Kalite motorunun yazma anındaki kararı — trustScore + boyutlar.
   *  Tazelik SAKLANMAZ: okuma anında hesaplanır (decay ilkesi). */
  trustScore: number
  quality: QualityDimensions
  qualityVerdict: QualityVerdict
  tags: string[]
  category: KnowledgeCategory
  citations: Citation[]
  ingest: {
    pipelineVersion: number
    ingestedAt: string
    chunkCount: number
    duplicateChunkCount: number
  }
  /** github kaynaklı repo kartlarında: Repository Analyzer'ın tam çıktısı
   *  (Sprint 6 — diller/bağımlılıklar/yapı/kalite/aktivite/sınıflama). */
  repository?: RepositoryAnalysis
  /** İnceleme kararı işlendiyse (Review Queue) — kim, ne, ne zaman. */
  review?: ReviewRecord
}

/** İnceleme kaydı (Sprint 6 Review Queue) — node statüsü doğruluk kaynağı
 *  olmaya devam eder; bu kayıt kararın KİMLİĞİNİ ve gerekçesini taşır. */
export type ReviewRecord = {
  reviewer: string
  decision: 'approve' | 'trust' | 'reject'
  note?: string
  reviewedAt: string
}

/** Extraction node'unun metadata zarfı (type alias — üst not). */
export type ExtractionMeta = {
  kind: 'knowledge-extraction'
  extractionKind: ExtractionKind
  confidence: number
  sectionPath: string
  /** Kaynak knowledge item node id'si (derived_from kenarının kopyası değil,
   *  hızlı filtre içindir — kenar doğruluk kaynağı olmaya devam eder). */
  itemNodeId: string
  /** İnceleme kararı işlendiyse (Review Queue). */
  review?: ReviewRecord
}

/** Registry'nin dışa verdiği okuma zarfı: node + çözülmüş meta + hesaplanan
 *  tazelik + ilişki özetleri. Sprint 5 "HER KNOWLEDGE ITEM" alan listesinin
 *  kod karşılığı — id, source, author, version, trust_score, freshness,
 *  tags, category, relationships, extracted alanları ve citations. */
export interface KnowledgeItem {
  id: string
  nodeType: string
  title: string
  content: string | null
  status: string
  source: KnowledgeItemMeta['source']
  author: string | null
  version: string | null
  trustScore: number
  /** Okuma anında hesaplanır (lib/brain/scoring computeFreshness). */
  freshness: number
  tags: string[]
  category: KnowledgeCategory
  citations: Citation[]
  relationships: { nodeId: string; title: string; linkType: string; direction: 'outgoing' | 'incoming' }[]
  extractedSkills: KnowledgeExtractionRef[]
  extractedWorkflows: KnowledgeExtractionRef[]
  /** pattern + best-practice + anti-pattern (üç kutup aynı raf — ayrım
   *  extraction metadata'sındadır). */
  extractedPatterns: KnowledgeExtractionRef[]
  extractedSops: KnowledgeExtractionRef[]
  extractedTemplates: KnowledgeExtractionRef[]
  /** Sprint 6: bağımlılık envanterinden tespit edilen teknolojiler. */
  extractedTechnologies: KnowledgeExtractionRef[]
  createdAt: string
  updatedAt: string
}

export interface KnowledgeExtractionRef {
  nodeId: string
  title: string
  status: string
  confidence: number | null
}

// ── Olay sözlüğü ────────────────────────────────────────────────────────────
// PascalCase adlar Sprint 5 sözleşmesidir; DB/bus karşılıkları migration
// 0011 + lib/runtime/types.ts snake_case tipleridir. Eşleme events.ts'te
// tek yönlü sabittir — iki ad uzayı birbirine karışmaz.

// Sprint 6 sözleşmesindeki SkillExtracted/WorkflowExtracted/… adları YENİ
// olay değildir — SkillCreated/WorkflowCreated/… ile aynı anın (extraction
// node'unun doğumu) adlarıdır; ikinci ad uzayı açılmadı (tek sözlük ilkesi,
// migration 0012 üst notu).
export const KNOWLEDGE_EVENT_NAMES = [
  'KnowledgeAdded',
  'KnowledgeUpdated',
  'KnowledgeReviewed',
  'KnowledgeRejected',
  'SkillCreated',
  'WorkflowCreated',
  'PatternCreated',
  'SOPCreated',
  'TemplateCreated',
  // Sprint 6 (migration 0012):
  'RepositoryImported',
  'RepositoryUpdated',
  'KnowledgeExtracted',
  'KnowledgeApproved',
] as const
export type KnowledgeEventName = (typeof KNOWLEDGE_EVENT_NAMES)[number]

// ── Pipeline sonucu ─────────────────────────────────────────────────────────

export interface KnowledgePipelineResult {
  /** 'rejected' → kalite kapısı yazımı reddetti, Brain'e HİÇBİR ŞEY yazılmadı. */
  outcome: 'stored' | 'rejected'
  quality: QualityReport
  analysis: Pick<DocumentAnalysis, 'tags' | 'category' | 'duplicationRate' | 'stats'>
  /** outcome='stored' ise item node bilgisi. */
  item?: {
    nodeId: string
    nodeType: string
    /** applyBrainUpdate kararı: created | confirmed | superseded. */
    action: 'created' | 'confirmed' | 'superseded'
    supersededNodeId?: string
  }
  /** Brain'e yazılan extraction'lar. */
  extractions: {
    kind: ExtractionKind
    nodeId: string
    title: string
    action: 'created' | 'confirmed' | 'superseded'
    confidence: number
  }[]
  /** Eşik altı kaldığı için yazılmayan adaylar (şeffaflık). */
  skippedExtractions: { kind: ExtractionKind; title: string; confidence: number }[]
  /** Update engine'in otomatik kurduğu semantik bağlar (item + extraction). */
  autoLinked: { nodeId: string; similarity: number }[]
  /** Çakışma ADAYLARI — karar değil gözlem (update-engine ilkesi):
   *  contradicts kenarını kurmak çağıranın bilinçli adımıdır. */
  conflictCandidates: { nodeId: string; title: string; similarity: number }[]
}
