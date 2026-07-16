// Kaynak Adaptör Katmanı (Sprint 6) — Knowledge Ingestion'ın "Source →
// Validate → Fetch" aşamaları. Her kaynak kanalı bir SourceAdapter'dır:
// isteği doğrular, içeriği çeker ve pipeline'a hazır KnowledgeSourceInput
// belgeleri (+ github'da RepositoryAnalysis) üretir. Bu katman Brain'e
// HİÇBİR ŞEY YAZMAZ — yazım tek kapıdan geçer (ingestion.ts →
// applyBrainUpdate); ayrım bilinçli: fetch/analiz ile yazım/olay ayrı
// sorumluluklar.
//
// UYGULANAN adaptörler: github (REST API üzerinden gerçek çekim + analiz),
// inline (markdown/text/json/yaml/code — fetch gerektirmez, içerik istekle
// gelir). KALAN kanallar (pdf/website/youtube/rss/research/docs/notion/
// gdrive) sözleşmede TANIMLIDIR ama implement edilmemiştir — resolve
// çağrısı source-fetcher'ın "planlı tür" ret sözleşmesiyle döner; yeni
// kanal eklemek = bu registry'ye implemented adaptör yazmaktır, çağıran
// (ingestion.ts) değişmez.

import 'server-only'
import { analyzeRepository } from './repo-analyzer'
import type { ManifestFile, RepositoryAnalysis } from './repo-analyzer'
import {
  fetchGitHubFiles, fetchGitHubLanguages, fetchGitHubReadme, fetchGitHubRepoProfile,
  fetchGitHubTree, parseGitHubRepoUrl, KNOWN_SOURCE_TYPES,
} from './source-fetcher'
import type { KnownSourceType, SourceFetchError } from './source-fetcher'
import type { KnowledgeSourceInput } from './types'

// ── Bütçeler ────────────────────────────────────────────────────────────────
// Tool yolundan (5 dosya/50KB — modelin keşif penceresi) BİLİNÇLİ geniş:
// ingestion insan-tetikli, hedefli bir içe alımdır. Auth'suz rate limit'te
// (60/saat) bir repo ≈ 4 sabit istek + dosya başına 1 istek; GITHUB_TOKEN
// ile 5000/saat (source-fetcher githubHeaders notu).

/** Repo başına içe alınacak en fazla dokümantasyon dosyası (README hariç). */
export const INGEST_MAX_DOC_FILES = 8
/** Dokümantasyon dosyalarının toplam bayt bütçesi. */
export const INGEST_MAX_DOC_BYTES = 200 * 1024
/** Kök manifest taraması — analiz girdisi (bilgi belgesi değildir). */
export const INGEST_MANIFEST_CANDIDATES = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml',
] as const
export const INGEST_MAX_MANIFEST_BYTES = 60 * 1024

// ── Sözleşme ────────────────────────────────────────────────────────────────

export interface SourceRequest {
  sourceType: KnownSourceType
  sourceUrl?: string | null
  /** inline kanalda zorunlu; uzak kanallarda yok sayılır. */
  content?: string
  format?: KnowledgeSourceInput['format']
  language?: string
  title?: string
  author?: string | null
  version?: string | null
  publishedAt?: string | null
  tags?: string[]
}

export interface ResolvedSource {
  /** Pipeline'a (ingestKnowledge) hazır belgeler. */
  documents: KnowledgeSourceInput[]
  /** github kanalında Repository Analyzer çıktısı; diğer kanallarda yok. */
  repository?: RepositoryAnalysis
  /** Çekim sırasında atlanan yollar/nedenler (şeffaflık — hata değildir). */
  skipped: { path: string; reason: string }[]
}

export interface SourceAdapter {
  readonly type: KnownSourceType
  readonly implemented: boolean
  resolve(request: SourceRequest): Promise<ResolvedSource | SourceFetchError>
}

// ── Inline adaptör (markdown/text/json/yaml/code) ───────────────────────────

const inlineAdapter: SourceAdapter = {
  type: 'markdown',
  implemented: true,
  async resolve(request) {
    if (typeof request.content !== 'string' || !request.content.trim()) {
      return { ok: false, error: "markdown kaynağı inline'dır: content boş olamaz (uzak çekim yolu yoktur)." }
    }
    return {
      documents: [{
        sourceType: 'markdown',
        sourceUrl: request.sourceUrl ?? null,
        content: request.content,
        format: request.format,
        language: request.language,
        title: request.title,
        author: request.author,
        version: request.version,
        publishedAt: request.publishedAt,
        tags: request.tags,
      }],
      skipped: [],
    }
  },
}

// ── GitHub adaptörü ─────────────────────────────────────────────────────────

/** Ağaçtan dokümantasyon adayları: kök *.md (README hariç — ayrı uçtan tam
 *  çekiliyor) + docs/ altındaki markdown. Sıralama deterministik: kök
 *  dosyalar önce, sonra sığ yollar, sonra alfabetik. */
export function selectDocPaths(treePaths: string[], limit: number = INGEST_MAX_DOC_FILES): string[] {
  const candidates = treePaths.filter((path) => {
    const lowered = path.toLowerCase()
    if (!/\.(md|mdx)$/.test(lowered)) return false
    if (/(^|\/)readme\.mdx?$/.test(lowered)) return false
    const isRoot = !path.includes('/')
    const isDocs = /^docs?\//.test(lowered)
    return isRoot || isDocs
  })
  candidates.sort((a, b) => {
    const depthA = a.split('/').length
    const depthB = b.split('/').length
    return depthA - depthB || a.localeCompare(b, 'en')
  })
  return candidates.slice(0, Math.max(0, limit))
}

const githubAdapter: SourceAdapter = {
  type: 'github',
  implemented: true,
  async resolve(request) {
    if (typeof request.sourceUrl !== 'string' || !request.sourceUrl.trim()) {
      return { ok: false, error: 'github kaynağı için sourceUrl zorunlu (https://github.com/{owner}/{repo}).' }
    }
    const parsed = parseGitHubRepoUrl(request.sourceUrl)
    if (!parsed) {
      return { ok: false, error: 'Yalnız https://github.com/{owner}/{repo} biçimindeki linkler desteklenir.' }
    }
    const { owner, repo } = parsed

    // 1. Profil — repo yoksa/erişilemiyorsa burada biter (tek net hata).
    const profile = await fetchGitHubRepoProfile(request.sourceUrl)
    if ('ok' in profile) return profile

    // 2. Diller + ağaç + README — kısmi hata ölümcül değildir: profil
    // varken dilsiz/ağaçsız analiz de değerlidir; eksik parça skipped'a
    // işlenir (kalite motoru zaten yapı yokluğunu puana yansıtır).
    const skipped: { path: string; reason: string }[] = []

    const languagesResult = await fetchGitHubLanguages(owner, repo)
    const languageBytes = 'ok' in languagesResult ? {} : languagesResult.languages
    if ('ok' in languagesResult) skipped.push({ path: '(languages)', reason: languagesResult.error })

    const treeResult = await fetchGitHubTree(owner, repo, profile.defaultBranch)
    const treePaths = 'ok' in treeResult ? [] : treeResult.paths
    if ('ok' in treeResult) skipped.push({ path: '(tree)', reason: treeResult.error })
    else if (treeResult.truncated) skipped.push({ path: '(tree)', reason: 'Dosya ağacı tavana kırpıldı — yapı analizi kısmi.' })

    const readmeResult = await fetchGitHubReadme(owner, repo)
    let readme: string | null = null
    if (readmeResult === null) skipped.push({ path: '(readme)', reason: 'README yok.' })
    else if ('ok' in readmeResult) skipped.push({ path: '(readme)', reason: readmeResult.error })
    else readme = readmeResult.content

    // 3. Manifest'ler (analiz girdisi) + dokümantasyon dosyaları (belgeler).
    const manifestPaths = (INGEST_MANIFEST_CANDIDATES as readonly string[])
      .filter((p) => treePaths.length === 0 || treePaths.includes(p))
    const manifests: ManifestFile[] = []
    if (manifestPaths.length > 0) {
      const fetched = await fetchGitHubFiles(owner, repo, manifestPaths, { maxTotalBytes: INGEST_MAX_MANIFEST_BYTES })
      manifests.push(...fetched.files.map((f) => ({ path: f.path, content: f.content })))
      skipped.push(...fetched.skipped)
    }

    const docPaths = selectDocPaths(treePaths)
    const docFiles = docPaths.length > 0
      ? await fetchGitHubFiles(owner, repo, docPaths, { maxTotalBytes: INGEST_MAX_DOC_BYTES })
      : { files: [], skipped: [] as { path: string; reason: string }[], totalBytes: 0 }
    skipped.push(...docFiles.skipped)

    // 4. Analiz (saf) + belge listesi.
    const repository = analyzeRepository({ profile, languageBytes, treePaths, manifests, readme })

    const documents: KnowledgeSourceInput[] = []
    if (readme) {
      documents.push({
        sourceType: 'github',
        sourceUrl: profile.sourceUrl,
        content: readme,
        title: `${owner}/${repo} — README`,
        publishedAt: profile.pushedAt,
        tags: profile.topics,
      })
    }
    for (const file of docFiles.files) {
      documents.push({
        sourceType: 'github',
        sourceUrl: `${profile.sourceUrl}/blob/${profile.defaultBranch}/${file.path}`,
        content: file.content,
        title: `${owner}/${repo} — ${file.path}`,
        publishedAt: profile.pushedAt,
        tags: profile.topics,
      })
    }

    return { documents, repository, skipped }
  },
}

// ── Registry ────────────────────────────────────────────────────────────────
// Uygulanmamış kanallar bilinçli olarak adaptör NESNESİ almaz: resolve
// edilebilir tek yüzey buradaki Map'tir, "planlı tür" reddi tek yerden döner.

const ADAPTERS: ReadonlyMap<KnownSourceType, SourceAdapter> = new Map<KnownSourceType, SourceAdapter>([
  ['github', githubAdapter],
  ['markdown', inlineAdapter],
])

export function getSourceAdapter(type: KnownSourceType): SourceAdapter | null {
  return ADAPTERS.get(type) ?? null
}

/** Kanal envanteri — hangi kanal uygulanmış, hangisi planlı (rapor/API yüzü). */
export function listSourceChannels(): { type: KnownSourceType; implemented: boolean }[] {
  return KNOWN_SOURCE_TYPES.map((type) => ({
    type,
    implemented: ADAPTERS.has(type),
  }))
}

/** Tek giriş: isteği kanal adaptörüne yönlendirir; planlı kanalda net ret. */
export async function resolveSource(request: SourceRequest): Promise<ResolvedSource | SourceFetchError> {
  if (!(KNOWN_SOURCE_TYPES as readonly string[]).includes(request.sourceType)) {
    return { ok: false, error: `'${String(request.sourceType)}' tanımlı bir kaynak türü değil — bilinen türler: ${KNOWN_SOURCE_TYPES.join(', ')}.` }
  }
  const adapter = getSourceAdapter(request.sourceType)
  if (!adapter) {
    return { ok: false, error: `'${request.sourceType}' kanalı henüz desteklenmiyor (planlı tür) — uygulanmış kanallar: ${[...ADAPTERS.keys()].join(', ')}.` }
  }
  return adapter.resolve(request)
}
