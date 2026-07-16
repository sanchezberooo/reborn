// Parse aşaması (Knowledge Pipeline 3/16) — normalize edilmiş markdown/düz
// metni yapısal zarfa çevirir: başlık ağacından düz bölüm listesi, kod
// blokları, linkler (citations), sıralı adım/madde sayıları. TAMAMEN SAF.
//
// Bilinçli sınır: tam bir markdown AST'si kurulmaz (bağımlılık eklemeden
// deterministik yapı sinyali yeter); satır-tabanlı tarayıcı fenced code
// bloklarının İÇİNİ asla başlık/liste sanmaz.

import type { Citation, NormalizedDocument, ParsedCodeBlock, ParsedDocument, ParsedSection } from './types'

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*$/
const FENCE_RE = /^(```|~~~)\s*([A-Za-z0-9+#._-]*)\s*$/
const ORDERED_ITEM_RE = /^\s{0,3}\d{1,3}[.)]\s+\S/
const BULLET_ITEM_RE = /^\s{0,3}[-*+]\s+\S/
/** Markdown linki [text](url) — yalnız http(s) hedefleri atıf sayılır. */
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
/** Çıplak URL (markdown linki içinde olmayan) — ikinci geçişte ayıklanır. */
const BARE_URL_RE = /https?:\/\/[^\s)\]}>"']+/g

interface OpenSection {
  heading: string
  level: number
  path: string
  lines: string[]
  orderedSteps: number
  bulletItems: number
  codeBlocks: ParsedCodeBlock[]
}

function closeSection(open: OpenSection): ParsedSection {
  return {
    heading: open.heading,
    level: open.level,
    path: open.path,
    content: open.lines.join('\n').trim(),
    orderedSteps: open.orderedSteps,
    bulletItems: open.bulletItems,
    codeBlocks: open.codeBlocks,
  }
}

/** Belgedeki atıflar: markdown linkleri + çıplak URL'ler, URL bazında tekil.
 *  Kod bloklarının içi atıf taramasına GİRMEZ (örnek kod URL'i atıf değildir). */
export function extractCitations(textOutsideCode: string): Citation[] {
  const byUrl = new Map<string, Citation>()
  for (const m of textOutsideCode.matchAll(MD_LINK_RE)) {
    const url = m[2].replace(/[.,;]+$/, '')
    if (!byUrl.has(url)) byUrl.set(url, { text: m[1].trim(), url })
  }
  const withoutMdLinks = textOutsideCode.replace(MD_LINK_RE, ' ')
  for (const m of withoutMdLinks.matchAll(BARE_URL_RE)) {
    const url = m[0].replace(/[.,;]+$/, '')
    if (!byUrl.has(url)) byUrl.set(url, { text: url, url })
  }
  return [...byUrl.values()]
}

/**
 * Satır-tabanlı yapısal ayrıştırma. Her başlık yeni bölüm açar; başlıktan
 * önceki içerik level=0 giriş bölümüdür. path, başlık hiyerarşisinden kurulur
 * ("Üst > Alt"). Fence içindeyken başlık/liste/link taranmaz.
 */
export function parseDocument(doc: NormalizedDocument): ParsedDocument {
  const sections: ParsedSection[] = []
  const breadcrumb: { level: number; heading: string }[] = []
  const nonCodeLines: string[] = []

  let open: OpenSection = {
    heading: '', level: 0, path: doc.title, lines: [], orderedSteps: 0, bulletItems: 0, codeBlocks: [],
  }
  let fence: { marker: string; language: string | null; lines: string[] } | null = null
  let codeBlockCount = 0
  let headingCount = 0

  const pathOf = (): string => breadcrumb.map((b) => b.heading).join(' > ') || doc.title

  for (const line of doc.content.split('\n')) {
    const fenceMatch = FENCE_RE.exec(line)

    if (fence) {
      open.lines.push(line)
      if (fenceMatch && fenceMatch[1] === fence.marker) {
        open.codeBlocks.push({
          language: fence.language,
          code: fence.lines.join('\n'),
          sectionPath: open.path,
        })
        codeBlockCount++
        fence = null
      } else {
        fence.lines.push(line)
      }
      continue
    }

    if (fenceMatch) {
      open.lines.push(line)
      fence = { marker: fenceMatch[1], language: fenceMatch[2] || null, lines: [] }
      continue
    }

    const headingMatch = HEADING_RE.exec(line)
    if (headingMatch) {
      sections.push(closeSection(open))
      headingCount++
      const level = headingMatch[1].length
      const heading = headingMatch[2].trim()
      while (breadcrumb.length > 0 && breadcrumb[breadcrumb.length - 1].level >= level) breadcrumb.pop()
      breadcrumb.push({ level, heading })
      open = {
        heading, level, path: pathOf(), lines: [], orderedSteps: 0, bulletItems: 0, codeBlocks: [],
      }
      continue
    }

    if (ORDERED_ITEM_RE.test(line)) open.orderedSteps++
    else if (BULLET_ITEM_RE.test(line)) open.bulletItems++
    open.lines.push(line)
    nonCodeLines.push(line)
  }
  // Kapanmamış fence: içerik olduğu gibi bölümde kalır (kod bloğu sayılmaz) —
  // bozuk markdown pipeline'ı düşürmez.
  sections.push(closeSection(open))

  const meaningful = sections.filter((s) => s.content.length > 0 || s.heading.length > 0)

  return {
    title: doc.title,
    sections: meaningful,
    citations: extractCitations(nonCodeLines.join('\n')),
    codeBlockCount,
    headingCount,
  }
}
