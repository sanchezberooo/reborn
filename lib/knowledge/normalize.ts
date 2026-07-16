// Normalize aşaması (Knowledge Pipeline 2/16) — ham kaynak metnini
// deterministik biçimde temizler ve frontmatter üst-verisini damıtır.
// TAMAMEN SAF: DB/ağ/runtime bağımlılığı yok, env'siz test edilir.
//
// Normalizasyon BİLGİ KAYBETMEZ: yalnız satır sonu/boşluk gürültüsü ve
// frontmatter bloğu ayrılır; içerik metni (kod blokları dahil) aynen korunur.

import type { KnowledgeSourceInput, NormalizedDocument } from './types'

const TITLE_MAX = 120
/** 3+ ardışık boş satır 2'ye iner — paragraf ayrımı korunur, gürültü gider. */
const BLANK_RUN_RE = /\n{3,}/g

/** Basit YAML frontmatter ayrıştırıcı: yalnız düz `key: value` satırları.
 *  İç içe yapılar/listeler v1'de bilinçli desteklenmez — frontmatter burada
 *  üst-veri kaynağıdır, genel YAML motoru değil; tanınmayan satır atlanır. */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>
  body: string
} {
  if (!content.startsWith('---')) return { frontmatter: {}, body: content }
  const end = content.indexOf('\n---', 3)
  if (end === -1) return { frontmatter: {}, body: content }

  const block = content.slice(content.indexOf('\n') + 1, end)
  const body = content.slice(content.indexOf('\n', end + 1) + 1)
  const frontmatter: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.+)$/.exec(line.trim())
    if (!m) continue
    frontmatter[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return { frontmatter, body }
}

/** Frontmatter tags alanı iki biçimde gelebilir: "a, b" veya "[a, b]". */
export function parseTagList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => t.trim().replace(/^["'#]|["']$/g, '').toLocaleLowerCase('tr'))
    .filter(Boolean)
}

function deriveTitle(body: string, fallback: string): string {
  // İlk markdown başlığı > içerik ilk satırı > fallback.
  const heading = /^#{1,6}\s+(.+)$/m.exec(body)
  const candidate = heading?.[1].trim()
    ?? body.split('\n').map((l) => l.trim()).find(Boolean)
    ?? fallback
  const flat = candidate.replace(/\s+/g, ' ').trim()
  return (flat.length > TITLE_MAX ? `${flat.slice(0, TITLE_MAX)}…` : flat) || fallback
}

/** Fence dilini sanitize eder — markdown fence satırına ham girdi girmez. */
function safeFenceLanguage(language: string | undefined, fallback: string): string {
  const clean = (language ?? '').trim().toLowerCase()
  return /^[a-z0-9+#-]{1,20}$/.test(clean) ? clean : fallback
}

/**
 * Format ön-işlemesi (Sprint 6): markdown olduğu gibi geçer; text yalnız
 * temizlenir; json/yaml/code fenced blok olarak sarılır — yapı korunur,
 * parse/chunk/extract motorları kod bloğu disipliniyle (fence içi taranmaz,
 * bölünmez) davranır. JSON parse edilebiliyorsa deterministik pretty-print
 * edilir (2 boşluk) — edilemiyorsa ham hali sarılır, bilgi kaybolmaz.
 */
export function applyDocumentFormat(input: KnowledgeSourceInput, body: string): string {
  switch (input.format ?? 'markdown') {
    case 'markdown':
    case 'text':
      return body
    case 'json': {
      let pretty = body
      try {
        pretty = JSON.stringify(JSON.parse(body), null, 2)
      } catch { /* geçersiz JSON ham sarılır */ }
      return `\`\`\`json\n${pretty}\n\`\`\``
    }
    case 'yaml':
      return `\`\`\`yaml\n${body}\n\`\`\``
    case 'code':
      return `\`\`\`${safeFenceLanguage(input.language, 'text')}\n${body}\n\`\`\``
  }
}

/**
 * Normalize: BOM/CRLF temizliği, satır sonu boşlukları, boş satır koşuları;
 * frontmatter ayrılır ve başlık/yazar/versiyon/etiket üst-verisi önceliğe
 * göre çözülür (çağıran girdisi > frontmatter > içerikten türetme).
 * format≠markdown belgelerde frontmatter aranmaz (JSON/YAML gövdesinin
 * '---' satırı frontmatter değildir).
 */
export function normalizeSource(input: KnowledgeSourceInput): NormalizedDocument {
  const raw = input.content.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const format = input.format ?? 'markdown'
  const { frontmatter, body: fmBody } = format === 'markdown'
    ? parseFrontmatter(raw)
    : { frontmatter: {} as Record<string, string>, body: raw }
  const body = applyDocumentFormat(input, fmBody)

  const content = body
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(BLANK_RUN_RE, '\n\n')
    .trim()

  const tags = [...new Set([
    ...(input.tags ?? []).map((t) => t.trim().toLocaleLowerCase('tr')).filter(Boolean),
    ...parseTagList(frontmatter.tags),
  ])]

  // json/yaml/code belgede içerik fence ile başlar — fence satırı başlık
  // olamaz; başlık çağırandan/URL'den gelir.
  const title = input.title?.trim()
    || frontmatter.title
    || (format === 'markdown' || format === 'text'
      ? deriveTitle(content, input.sourceUrl ?? 'Adsız kaynak')
      : input.sourceUrl ?? 'Adsız kaynak')

  return {
    title,
    content,
    author: input.author?.trim() || frontmatter.author || null,
    version: input.version?.trim() || frontmatter.version || null,
    tags,
    frontmatter,
  }
}
