// Extraction Engine (Knowledge Pipeline 10-14/16) — parse edilmiş belgeden
// Skill / Workflow / Pattern / SOP / Template ADAYLARI çıkarır. TAMAMEN SAF
// ve DETERMİNİSTİK: sinyaller yapısaldır (başlık kalıbı, sıralı adım, kural
// dili, kod bloğu); anlamsal damıtma Knowledge Agent'ın (LLM) ileriki işidir
// ve bu motorun ürettiği adaylar onun inceleme kuyruğudur.
//
// GÜVEN MODELİ: her aday [0,1] confidence taşır — eşleşen sinyal sayısıyla
// artar. Pipeline yalnız eşik üstünü Brain'e yazar (status='aday' — yaşam
// döngüsü zaten "henüz doğrulanmadı" diyor); eşik altı adaylar raporda kalır.
// Yanlış pozitif ucuzdur (aday statüsü + inceleme), kaçan bilgi pahalıdır —
// eşikler buna göre ılımlıdır.

import type { ExtractionCandidate, ExtractionKind, ParsedDocument, ParsedSection } from './types'

/** Brain'e yazım eşiği — altı rapor-only. */
export const EXTRACTION_WRITE_THRESHOLD = 0.5
/** Tür başına belge tavanı: tek belgeden extraction seli önlenir. */
export const MAX_CANDIDATES_PER_KIND = 5
/** Aday içerik sınırları: tek satırlık bölümden bilgi çıkmaz, dev bölüm
 *  kırpılır (embedding kalitesi + node hijyeni). */
const MIN_CANDIDATE_CHARS = 80
const MAX_CANDIDATE_CHARS = 4000

// ── Sinyal sözlükleri (küçük harf; TR+EN) ───────────────────────────────────

const WORKFLOW_HEADING = ['how to', 'workflow', 'setup', 'install', 'kurulum', 'adım', 'süreç', 'akış', 'getting started', 'quickstart', 'usage', 'kullanım']
const SOP_MARKERS = ['must', 'always', 'never', 'should not', 'required', 'zorunlu', 'yasak', 'asla', 'her zaman', 'kural', 'policy', 'prosedür', 'checklist', 'standard', 'standart', 'sop']
const SKILL_HEADING = ['how to', 'guide', 'tutorial', 'rehber', 'nasıl', 'öğren', 'technique', 'teknik', 'best practice', 'ipucu', 'tips']
const PATTERN_MARKERS = ['pattern', 'desen', 'anti-pattern', 'problem', 'solution', 'çözüm', 'trade-off', 'when to use', 'ne zaman', 'use case', 'yaklaşım', 'strateji']
const TEMPLATE_MARKERS = ['template', 'şablon', 'boilerplate', 'starter', 'skeleton', 'iskelet', 'example config', 'örnek yapılandırma']
// Sprint 6: pattern'in iki kutbu — öneri dili ve kaçınma dili. İkisi de
// pattern node'u doğurur, ayrım metadata.extractionKind'dadır (types.ts notu).
const BEST_PRACTICE_MARKERS = ['best practice', 'iyi pratik', 'recommended', 'önerilen', 'tavsiye', 'do this', 'prefer', 'tercih et', 'convention', 'guideline']
const ANTI_PATTERN_MARKERS = ['anti-pattern', 'antipattern', 'avoid', 'kaçın', 'yapma', "don't", 'do not', 'common mistake', 'yaygın hata', 'pitfall', 'tuzak', 'kötü pratik', 'bad practice']

function containsAny(haystack: string, needles: string[]): number {
  let hits = 0
  for (const needle of needles) if (haystack.includes(needle)) hits++
  return hits
}

function clampContent(section: ParsedSection): string {
  const body = section.heading ? `${section.heading}\n\n${section.content}` : section.content
  return body.length > MAX_CANDIDATE_CHARS ? `${body.slice(0, MAX_CANDIDATE_CHARS)}…` : body
}

function candidateTitle(section: ParsedSection, docTitle: string, kind: ExtractionKind): string {
  const base = section.heading || section.path || docTitle
  const flat = base.replace(/\s+/g, ' ').trim()
  return `[${kind}] ${flat}`.slice(0, 120)
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * Bölüm-başına aday üretimi. Bir bölüm birden çok türe aday olabilir (örn.
 * kural dilli sıralı adımlar hem workflow hem sop) — karar verme işi burada
 * DEĞİL: iki adayın da yazılması graf açısından meşrudur (ikisi de kaynağa
 * derived_from ile bağlanır), gereksiz olan yaşam döngüsünde elenir.
 */
export function extractFromSection(section: ParsedSection, docTitle: string): ExtractionCandidate[] {
  if (section.content.length < MIN_CANDIDATE_CHARS) return []
  const lowered = `${section.heading}\n${section.content}`.toLocaleLowerCase('tr')
  const headingLower = section.heading.toLocaleLowerCase('tr')
  const out: ExtractionCandidate[] = []

  const push = (kind: ExtractionKind, confidence: number) => {
    if (confidence <= 0) return
    out.push({
      kind,
      title: candidateTitle(section, docTitle, kind),
      content: clampContent(section),
      confidence: clamp01(Math.round(confidence * 100) / 100),
      sectionPath: section.path,
    })
  }

  // Workflow: sıralı adımlar esas sinyal; başlık kalıbı güçlendirir.
  if (section.orderedSteps >= 3) {
    push('workflow', 0.45 + Math.min(0.2, section.orderedSteps * 0.03) + (containsAny(headingLower, WORKFLOW_HEADING) > 0 ? 0.2 : 0))
  }

  // SOP: kural/zorunluluk dili; sıralı adım veya checklist yapısı güçlendirir.
  const sopHits = containsAny(lowered, SOP_MARKERS)
  if (sopHits >= 2) {
    push('sop', 0.35 + Math.min(0.3, sopHits * 0.08) + (section.orderedSteps >= 2 || section.bulletItems >= 3 ? 0.15 : 0))
  }

  // Skill: öğretici başlık kalıbı; kod örneği güçlendirir.
  const skillHits = containsAny(headingLower, SKILL_HEADING)
  if (skillHits > 0) {
    push('skill', 0.4 + skillHits * 0.1 + (section.codeBlocks.length > 0 ? 0.15 : 0) + (section.bulletItems >= 2 ? 0.05 : 0))
  }

  // Pattern: problem/çözüm/trade-off dili — en az iki farklı işaret.
  const patternHits = containsAny(lowered, PATTERN_MARKERS)
  if (patternHits >= 2) {
    push('pattern', 0.35 + Math.min(0.35, patternHits * 0.09))
  }

  // Best practice: öneri/kılavuz dili — en az iki işaret; liste yapısı
  // güçlendirir (kılavuzlar madde madde yazılır).
  const bestHits = containsAny(lowered, BEST_PRACTICE_MARKERS)
  if (bestHits >= 2) {
    push('best-practice', 0.35 + Math.min(0.3, bestHits * 0.09) + (section.bulletItems >= 2 ? 0.1 : 0))
  }

  // Anti-pattern: kaçınma/uyarı dili — en az iki işaret.
  const antiHits = containsAny(lowered, ANTI_PATTERN_MARKERS)
  if (antiHits >= 2) {
    push('anti-pattern', 0.35 + Math.min(0.3, antiHits * 0.09) + (section.bulletItems >= 2 ? 0.1 : 0))
  }

  // Template: şablon işareti + kod/yapılandırma bloğu birlikte ŞART —
  // işaretsiz kod örneği template değildir, kodsuz "template" lafı da.
  if (section.codeBlocks.length > 0 && containsAny(lowered, TEMPLATE_MARKERS) > 0) {
    push('template', 0.5 + Math.min(0.2, section.codeBlocks.length * 0.08) + (headingLower && containsAny(headingLower, TEMPLATE_MARKERS) > 0 ? 0.15 : 0))
  }

  return out
}

/**
 * Belge-düzeyi extraction: bölüm adayları toplanır, tür içinde güvene göre
 * sıralanır ve tür başına tavanla kırpılır. Deterministik sıra: confidence
 * DESC, sonra bölüm sırası (kararlı çıktı — test edilebilirlik).
 */
export function extractCandidates(parsed: ParsedDocument): ExtractionCandidate[] {
  const byKind = new Map<ExtractionKind, ExtractionCandidate[]>()

  for (const section of parsed.sections) {
    for (const candidate of extractFromSection(section, parsed.title)) {
      const list = byKind.get(candidate.kind) ?? []
      list.push(candidate)
      byKind.set(candidate.kind, list)
    }
  }

  const out: ExtractionCandidate[] = []
  for (const [, list] of byKind) {
    list.sort((a, b) => b.confidence - a.confidence)
    out.push(...list.slice(0, MAX_CANDIDATES_PER_KIND))
  }
  return out
}
