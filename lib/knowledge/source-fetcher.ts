// Dış kaynak çekme davranışı — Knowledge Agent rapor modunun ucuz ön-bakış
// adımı (fetch_source_overview). Şema lib/knowledge/source-tools.ts'te, çağrı
// lib/agents/executor.ts switch'inde (brain tools deseniyle aynı üçleme).
// Brain'e HİÇBİR ŞEY yazmaz — salt okuma, DB erişimi yok.
//
// GÜVENLİK (kod seviyesinde whitelist — SSRF-benzeri kötüye kullanım engeli):
// sourceUrl SADECE github.com/{owner}/{repo} biçimini kabul eder. Giden
// istekler yalnız api.github.com'a, regex'le doğrulanmış owner/repo
// segmentleriyle gider — modelin verdiği URL asla ham haliyle istek
// URL'ine girmez.
//
// RATE LIMIT: GitHub public REST API auth'suz kullanılır — unauthenticated
// limit IP başına 60 istek/saat. Aşımda GitHub 403/429 döner; nazik hata
// mesajı olarak modele iletilir, retry mekanizması YOK (v1 bilinçli sınırı).

export const SUPPORTED_SOURCE_TYPES = ['github'] as const
export type SourceType = (typeof SUPPORTED_SOURCE_TYPES)[number]

/** README ön-bakış kırpma sınırı (referans plan: "ilk ~2000 karakter"). */
export const README_EXCERPT_CHARS = 2000

/** fetch_source_content sınırları (referans plan: "maksimum 5 dosya, toplam
 *  50KB — aşımda nazikçe ret"). Dosya sayısı aşımı çağrıyı komple reddeder
 *  (model daha az dosyayla yeniden dener); bayt bütçesi çekim sırasında
 *  uygulanır — sığmayan dosya kırpılır/atlanır, hata FIRLATILMAZ. */
export const MAX_CONTENT_FILES = 5
export const MAX_CONTENT_TOTAL_BYTES = 50 * 1024

const GITHUB_API_BASE = 'https://api.github.com'
const FETCH_TIMEOUT_MS = 10_000

// GitHub API User-Agent'sız istekleri 403 ile reddeder — sabit kimlik gönder.
const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'reborn-knowledge-agent',
} as const

export interface SourceOverview {
  /** Normalize edilmiş kanonik repo URL'i (https://github.com/{owner}/{repo}). */
  sourceUrl: string
  sourceType: SourceType
  description: string | null
  stars: number
  language: string | null
  topics: string[]
  /** README'nin ilk ~2000 karakteri; README yoksa boş string. */
  readmeExcerpt: string
}

export interface SourceContentFile {
  path: string
  content: string
  /** true → dosya 50KB toplam bütçesine sığmadığı için kırpıldı. */
  truncated: boolean
}

export interface SourceContent {
  sourceUrl: string
  sourceType: SourceType
  files: SourceContentFile[]
  /** Çekilemeyen yollar + neden (bulunamadı, dizin, bütçe doldu, geçersiz yol…). */
  skipped: { path: string; reason: string }[]
  totalBytes: number
}

export type SourceFetchError = { ok: false; error: string }
export type SourceOverviewResult = SourceOverview | SourceFetchError
export type SourceContentResult = SourceContent | SourceFetchError

const GITHUB_HOSTNAMES = new Set(['github.com', 'www.github.com'])
/** GitHub owner/repo ad kuralları alt kümesi — api.github.com yoluna girecek
 *  segmentler yalnız bu karakterlerden oluşabilir (path injection engeli). */
const NAME_SEGMENT_RE = /^[A-Za-z0-9_.-]+$/

/**
 * github.com repo linkini {owner, repo} olarak ayrıştırır; whitelist dışı her
 * şeyde null. Derin linkler tolere edilir (github.com/o/r/tree/main → o/r),
 * `.git` soneki kırpılır, '.'/'..' segmentleri (path traversal) reddedilir.
 */
export function parseGitHubRepoUrl(sourceUrl: string): { owner: string; repo: string } | null {
  let url: URL
  try {
    url = new URL(sourceUrl.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!GITHUB_HOSTNAMES.has(url.hostname.toLowerCase())) return null

  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 2) return null

  const owner = segments[0]
  const repo = segments[1].replace(/\.git$/, '')
  if (!NAME_SEGMENT_RE.test(owner) || !NAME_SEGMENT_RE.test(repo)) return null
  if (owner === '.' || owner === '..' || repo === '.' || repo === '..') return null

  return { owner, repo }
}

/**
 * Ucuz ön-bakış: repo metadata + README özeti. sourceType verilmezse 'github'
 * varsayılır; switch yapısı ileride yeni kaynak türleri (yeni case) eklenecek
 * şekilde bilinçli kurulmuştur — v1 YALNIZ 'github' uygular.
 * Beklenen hatalar (desteklenmeyen tür, whitelist dışı URL, 404, rate limit)
 * fırlatılmaz; { ok:false, error } olarak döner (executor brain_* deseni).
 */
export async function fetchSourceOverview(
  sourceUrl: string,
  sourceType?: unknown,
): Promise<SourceOverviewResult> {
  const requested = sourceType === undefined || sourceType === null ? 'github' : sourceType
  switch (requested) {
    case 'github':
      return fetchGitHubOverview(sourceUrl)
    default:
      return {
        ok: false,
        error: `fetch_source_overview: sourceType '${String(requested)}' desteklenmiyor — v1 yalnız 'github' destekler.`,
      }
  }
}

async function fetchGitHubOverview(sourceUrl: string): Promise<SourceOverviewResult> {
  const parsed = parseGitHubRepoUrl(sourceUrl)
  if (!parsed) {
    return {
      ok: false,
      error:
        'fetch_source_overview: yalnız https://github.com/{owner}/{repo} biçimindeki linkler desteklenir — başka domain veya biçim reddedilir.',
    }
  }
  const { owner, repo } = parsed

  let repoRes: Response
  try {
    repoRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: GITHUB_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    return {
      ok: false,
      error: `GitHub API'ye ulaşılamadı: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (repoRes.status === 403 || repoRes.status === 429) {
    return {
      ok: false,
      error: "GitHub API rate limit aşıldı (auth'suz limit: IP başına 60 istek/saat) — bir süre sonra tekrar dene.",
    }
  }
  if (repoRes.status === 404) {
    return {
      ok: false,
      error: `GitHub reposu bulunamadı: ${owner}/${repo} (private olabilir — v1 yalnız public repoları destekler).`,
    }
  }
  if (!repoRes.ok) {
    return { ok: false, error: `GitHub API beklenmeyen durum döndü: ${repoRes.status}` }
  }

  const meta = (await repoRes.json()) as {
    description?: string | null
    stargazers_count?: number
    language?: string | null
    topics?: string[]
  }

  // README ayrı uç: raw Accept başlığıyla doğrudan metin döner. README
  // yokluğu/çekim hatası ölümcül değil — metadata yine değerli, boş bırakılır.
  let readmeExcerpt = ''
  try {
    const readmeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`, {
      headers: { ...GITHUB_HEADERS, Accept: 'application/vnd.github.raw+json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (readmeRes.ok) {
      readmeExcerpt = (await readmeRes.text()).slice(0, README_EXCERPT_CHARS)
    }
  } catch {
    // sessizce boş excerpt — üstteki not
  }

  return {
    sourceUrl: `https://github.com/${owner}/${repo}`,
    sourceType: 'github',
    description: meta.description ?? null,
    stars: typeof meta.stargazers_count === 'number' ? meta.stargazers_count : 0,
    language: meta.language ?? null,
    topics: Array.isArray(meta.topics) ? meta.topics.filter((t): t is string => typeof t === 'string') : [],
    readmeExcerpt,
  }
}

// ─── fetch_source_content: derin çekim ──────────────────────────────────────

/**
 * Repo-göreli dosya yolunu URL-güvenli hale getirir; şüpheli her şeyde null.
 * '.'/'..' segmentleri (path traversal), backslash, boş segment ve muhafazakâr
 * karakter alt kümesi ([A-Za-z0-9 _.@+-]) dışı karakterler reddedilir —
 * api.github.com yoluna modelin verdiği ham metin asla girmez.
 */
export function sanitizeRepoFilePath(path: string): string | null {
  const trimmed = path.trim().replace(/^\/+/, '')
  if (!trimmed || trimmed.length > 300) return null
  if (trimmed.includes('\\')) return null
  const segments = trimmed.split('/')
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') return null
    if (!/^[A-Za-z0-9 _.@+-]+$/.test(seg)) return null
  }
  return segments.map(encodeURIComponent).join('/')
}

/**
 * Derin çekim: belirli dosya yollarının ham içeriği. Overview ile aynı switch
 * yapısı (v1 yalnız 'github') ve aynı hata sözleşmesi ({ ok:false, error },
 * fırlatma yok). Sınırlar: en fazla MAX_CONTENT_FILES dosya (aşımda çağrı
 * komple reddedilir), toplam MAX_CONTENT_TOTAL_BYTES bayt (bütçeyi aşan dosya
 * kırpılır, kalanlar skipped'a düşer). Dosyalar SIRAYLA çekilir — bütçe
 * deterministik uygulanır, auth'suz rate limit (60/saat) nazikçe harcanır.
 */
export async function fetchSourceContent(
  sourceUrl: string,
  sourceType?: unknown,
  paths?: unknown,
): Promise<SourceContentResult> {
  const requested = sourceType === undefined || sourceType === null ? 'github' : sourceType
  switch (requested) {
    case 'github':
      return fetchGitHubContent(sourceUrl, paths)
    default:
      return {
        ok: false,
        error: `fetch_source_content: sourceType '${String(requested)}' desteklenmiyor — v1 yalnız 'github' destekler.`,
      }
  }
}

async function fetchGitHubContent(sourceUrl: string, pathsInput: unknown): Promise<SourceContentResult> {
  const parsed = parseGitHubRepoUrl(sourceUrl)
  if (!parsed) {
    return {
      ok: false,
      error:
        'fetch_source_content: yalnız https://github.com/{owner}/{repo} biçimindeki linkler desteklenir — başka domain veya biçim reddedilir.',
    }
  }
  const { owner, repo } = parsed

  if (!Array.isArray(pathsInput) || pathsInput.length === 0) {
    return { ok: false, error: "fetch_source_content: paths en az bir dosya yolu içeren bir dizi olmalı (örn ['src/index.ts'])." }
  }
  if (pathsInput.length > MAX_CONTENT_FILES) {
    return {
      ok: false,
      error: `fetch_source_content: en fazla ${MAX_CONTENT_FILES} dosya çekilebilir — ${pathsInput.length} istendi. En önemli ${MAX_CONTENT_FILES} dosyayı seçip yeniden dene.`,
    }
  }

  const files: SourceContentFile[] = []
  const skipped: { path: string; reason: string }[] = []
  let totalBytes = 0
  let rateLimited = false

  for (const rawPath of pathsInput) {
    const label = typeof rawPath === 'string' ? rawPath : String(rawPath)

    if (rateLimited) {
      skipped.push({ path: label, reason: 'GitHub API rate limit aşıldı — çekilmedi.' })
      continue
    }
    if (totalBytes >= MAX_CONTENT_TOTAL_BYTES) {
      skipped.push({ path: label, reason: `Toplam ${Math.round(MAX_CONTENT_TOTAL_BYTES / 1024)}KB bütçesi doldu — çekilmedi.` })
      continue
    }

    const safePath = typeof rawPath === 'string' ? sanitizeRepoFilePath(rawPath) : null
    if (!safePath) {
      skipped.push({ path: label, reason: 'Geçersiz dosya yolu — repo-göreli, traversal içermeyen bir yol ver.' })
      continue
    }

    let res: Response
    try {
      // Raw Accept başlığı dosya içeriğini doğrudan metin döndürür; yol bir
      // DİZİNSE GitHub JSON listesi döner — content-type ile ayırt edilir.
      res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${safePath}`, {
        headers: { ...GITHUB_HEADERS, Accept: 'application/vnd.github.raw+json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch (err) {
      skipped.push({ path: label, reason: `GitHub API'ye ulaşılamadı: ${err instanceof Error ? err.message : String(err)}` })
      continue
    }

    if (res.status === 403 || res.status === 429) {
      rateLimited = true
      skipped.push({ path: label, reason: "GitHub API rate limit aşıldı (auth'suz limit: IP başına 60 istek/saat)." })
      continue
    }
    if (res.status === 404) {
      skipped.push({ path: label, reason: 'Dosya repoda bulunamadı.' })
      continue
    }
    if (!res.ok) {
      skipped.push({ path: label, reason: `GitHub API beklenmeyen durum döndü: ${res.status}` })
      continue
    }
    if (res.headers.get('content-type')?.includes('application/json')) {
      skipped.push({ path: label, reason: 'Yol bir dizine işaret ediyor — tek tek dosya yolu ver.' })
      continue
    }

    const text = await res.text()
    const bytes = Buffer.byteLength(text, 'utf8')
    const remaining = MAX_CONTENT_TOTAL_BYTES - totalBytes

    if (bytes <= remaining) {
      files.push({ path: label, content: text, truncated: false })
      totalBytes += bytes
    } else {
      // Bütçeye sığmayan dosya kırpılır (hata fırlatılmaz) — karakter bazlı
      // kesim; UTF-8 çok baytlı karakterlerde küçük sapma kabul edilir.
      files.push({ path: label, content: text.slice(0, remaining), truncated: true })
      totalBytes = MAX_CONTENT_TOTAL_BYTES
    }
  }

  return {
    sourceUrl: `https://github.com/${owner}/${repo}`,
    sourceType: 'github',
    files,
    skipped,
    totalBytes,
  }
}
