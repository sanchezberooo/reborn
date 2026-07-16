// Repository / Project Analyzer (Sprint 6) — GitHub Analysis Engine'in SAF
// çekirdeği: profil + dosya ağacı + manifest içerikleri + README'den
// deterministik analiz üretir. DB/ağ erişimi YOK — girdiler ingestion.ts
// tarafından çekilip buraya verilir; env'siz test edilir.
//
// Kapsam (sprint sözleşmesi): dil dağılımı, bağımlılıklar, framework'ler,
// klasör yapısı / mimari sinyaller, README ve dokümantasyon kalitesi,
// aktivite bandı ve proje sınıflaması (agent/framework/sdk/cli/...).
// Anlamsal derinleştirme (LLM) bu motorun İŞİ DEĞİLDİR — Knowledge Agent'ın
// inceleme kuyruğuna deterministik, doğrulanabilir sinyal hazırlar.

import type { GitHubRepoProfile } from './source-fetcher'

// ── Sözlükler ───────────────────────────────────────────────────────────────

/** Proje türü sınıflaması — sprint listesi. Çok-etiketlidir: primary en
 *  güçlü sinyaldir, labels tüm eşleşenlerdir (bir repo hem library hem cli
 *  olabilir). */
export const PROJECT_KINDS = [
  'agent', 'framework', 'sdk', 'cli', 'automation', 'knowledge',
  'workflow', 'library', 'template', 'plugin', 'tool',
] as const
export type ProjectKind = (typeof PROJECT_KINDS)[number]

/** Bağımlılık adı → framework/teknoloji etiketi. Yalnız yüksek-sinyalli,
 *  yıllara dayanıklı adlar — moda paket listesi değil. */
const FRAMEWORK_SIGNATURES: Record<string, string> = {
  next: 'Next.js',
  react: 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  angular: 'Angular',
  express: 'Express',
  fastify: 'Fastify',
  nestjs: 'NestJS',
  '@nestjs/core': 'NestJS',
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  rails: 'Ruby on Rails',
  spring: 'Spring',
  tailwindcss: 'Tailwind CSS',
  typescript: 'TypeScript',
  vitest: 'Vitest',
  jest: 'Jest',
  pytest: 'pytest',
  langchain: 'LangChain',
  'langchain-core': 'LangChain',
  llamaindex: 'LlamaIndex',
  '@anthropic-ai/sdk': 'Anthropic SDK',
  openai: 'OpenAI SDK',
  transformers: 'Hugging Face Transformers',
  torch: 'PyTorch',
  tensorflow: 'TensorFlow',
  supabase: 'Supabase',
  '@supabase/supabase-js': 'Supabase',
  prisma: 'Prisma',
  drizzle: 'Drizzle',
  electron: 'Electron',
  tauri: 'Tauri',
}

/** Proje sınıflama imzaları: [tür, ad/topic/açıklama anahtar kelimeleri,
 *  bağımlılık anahtar kelimeleri]. Puanlama classifyProject içinde. */
const KIND_SIGNATURES: [ProjectKind, string[], string[]][] = [
  ['agent', ['agent', 'agentic', 'autonomous', 'copilot', 'assistant', 'multi-agent'], ['langchain', 'autogen', 'crewai', 'llamaindex', '@anthropic-ai/sdk', 'openai']],
  ['framework', ['framework'], []],
  ['sdk', ['sdk', 'api client', 'api-client', 'client library'], []],
  ['cli', ['cli', 'command line', 'command-line', 'terminal'], ['commander', 'yargs', 'clap', 'click', 'cobra']],
  ['automation', ['automation', 'automate', 'bot', 'scheduler', 'cron'], ['n8n', 'zapier', 'playwright', 'puppeteer']],
  ['knowledge', ['awesome', 'knowledge base', 'knowledge-base', 'curated list', 'handbook', 'roadmap', 'interview'], []],
  ['workflow', ['workflow', 'pipeline', 'orchestration', 'orchestrator'], ['airflow', 'temporal', 'prefect']],
  ['template', ['template', 'boilerplate', 'starter', 'starter-kit', 'scaffold'], []],
  ['plugin', ['plugin', 'extension', 'addon', 'add-on'], []],
  ['tool', ['tool', 'utility', 'devtool', 'developer tool'], []],
  ['library', ['library', 'lib'], []],
]

// ── Girdi/çıktı zarfları ────────────────────────────────────────────────────

export interface ManifestFile {
  path: string
  content: string
}

export interface RepoAnalysisInput {
  profile: GitHubRepoProfile
  /** languages API ham bayt sayıları (boş olabilir). */
  languageBytes: Record<string, number>
  /** Repo dosya yolları (git tree, blob'lar). */
  treePaths: string[]
  /** Çekilen manifest dosyaları (package.json, requirements.txt, …). */
  manifests: ManifestFile[]
  /** Tam README metni (yoksa null). */
  readme: string | null
}

export interface DependencyInfo {
  name: string
  /** Manifest'te yazan sürüm aralığı (bilinmiyorsa null). */
  version: string | null
  /** Hangi manifest'ten geldi. */
  source: string
  dev: boolean
}

export interface FolderStructure {
  topLevelDirs: string[]
  fileCount: number
  hasTests: boolean
  hasDocs: boolean
  hasCi: boolean
  hasExamples: boolean
  /** packages/ veya apps/ + workspace manifest sinyali. */
  isMonorepo: boolean
  hasSrcLayout: boolean
}

export type ActivityLevel = 'active' | 'maintained' | 'stale' | 'abandoned'

export interface RepositoryAnalysis {
  name: string
  owner: string
  description: string | null
  topics: string[]
  stars: number
  forks: number
  license: string | null
  /** Dil → yüzde (tamsayı, toplam ~100; languages API'den). */
  languages: Record<string, number>
  primaryLanguage: string | null
  frameworks: string[]
  dependencies: DependencyInfo[]
  structure: FolderStructure
  /** [0,1] — başlık/kod örneği/kurulum bölümü/uzunluk sinyalleri. */
  readmeQuality: number
  /** [0,1] — docs klasörü, CONTRIBUTING/CHANGELOG, README kalitesi harmanı. */
  documentationQuality: number
  lastUpdate: string | null
  activity: ActivityLevel
  classification: {
    primary: ProjectKind
    labels: ProjectKind[]
    /** [0,1] — imza eşleşme yoğunluğu; düşükse 'library' varsayılanına düştü. */
    confidence: number
  }
}

// ── Dil dağılımı ────────────────────────────────────────────────────────────

export function computeLanguagePercentages(languageBytes: Record<string, number>): Record<string, number> {
  const total = Object.values(languageBytes).reduce((sum, n) => sum + Math.max(0, n), 0)
  if (total <= 0) return {}
  const out: Record<string, number> = {}
  for (const [lang, bytes] of Object.entries(languageBytes)) {
    const pct = Math.round((Math.max(0, bytes) / total) * 100)
    if (pct > 0) out[lang] = pct
  }
  return out
}

// ── Bağımlılık ayrıştırma ───────────────────────────────────────────────────
// Bilinçli sınır: tam manifest motoru değil — beş yaygın format için dar,
// öngörülebilir ayrıştırıcılar. Bozuk manifest analizi düşürmez (boş döner).

function parsePackageJson(m: ManifestFile): DependencyInfo[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(m.content)
  } catch {
    return []
  }
  if (parsed === null || typeof parsed !== 'object') return []
  const body = parsed as { dependencies?: unknown; devDependencies?: unknown }
  const out: DependencyInfo[] = []
  for (const [bag, dev] of [[body.dependencies, false], [body.devDependencies, true]] as const) {
    if (bag === null || typeof bag !== 'object') continue
    for (const [name, version] of Object.entries(bag as Record<string, unknown>)) {
      out.push({ name, version: typeof version === 'string' ? version : null, source: m.path, dev })
    }
  }
  return out
}

function parseRequirementsTxt(m: ManifestFile): DependencyInfo[] {
  const out: DependencyInfo[] = []
  for (const raw of m.content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('-')) continue
    const match = /^([A-Za-z0-9_.\[\]-]+)\s*([=<>!~]{1,2}=?\s*[^#\s]+)?/.exec(line)
    if (!match) continue
    out.push({ name: match[1].replace(/\[.*\]$/, ''), version: match[2]?.trim() ?? null, source: m.path, dev: false })
  }
  return out
}

function parseGoMod(m: ManifestFile): DependencyInfo[] {
  const out: DependencyInfo[] = []
  const requireBlock = /require\s*\(([\s\S]*?)\)/.exec(m.content)?.[1]
    ?? m.content.split('\n').filter((l) => l.trim().startsWith('require ')).join('\n')
  for (const raw of requireBlock.split('\n')) {
    const line = raw.replace(/^require\s+/, '').trim()
    const match = /^([^\s]+)\s+(v[^\s]+)/.exec(line)
    if (match && !line.includes('// indirect')) {
      out.push({ name: match[1], version: match[2], source: m.path, dev: false })
    }
  }
  return out
}

function parseCargoToml(m: ManifestFile): DependencyInfo[] {
  const out: DependencyInfo[] = []
  const section = /\[dependencies\]([\s\S]*?)(\n\[|$)/.exec(m.content)?.[1]
  if (!section) return out
  for (const raw of section.split('\n')) {
    const match = /^([A-Za-z0-9_-]+)\s*=\s*(?:"([^"]+)"|\{)/.exec(raw.trim())
    if (match) out.push({ name: match[1], version: match[2] ?? null, source: m.path, dev: false })
  }
  return out
}

function parsePyprojectToml(m: ManifestFile): DependencyInfo[] {
  const out: DependencyInfo[] = []
  const section = /dependencies\s*=\s*\[([\s\S]*?)\]/.exec(m.content)?.[1]
  if (!section) return out
  for (const match of section.matchAll(/"([^"]+)"|'([^']+)'/g)) {
    const spec = (match[1] ?? match[2] ?? '').trim()
    const nameMatch = /^([A-Za-z0-9_.\[\]-]+)/.exec(spec)
    if (nameMatch) {
      out.push({
        name: nameMatch[1].replace(/\[.*\]$/, ''),
        version: spec.slice(nameMatch[1].length).trim() || null,
        source: m.path,
        dev: false,
      })
    }
  }
  return out
}

/** Manifest listesi → bağımlılık envanteri (ad bazında tekil; runtime
 *  bağımlılığı dev kopyasını ezer). */
export function parseDependencies(manifests: ManifestFile[]): DependencyInfo[] {
  const byName = new Map<string, DependencyInfo>()
  for (const manifest of manifests) {
    const base = manifest.path.split('/').pop()?.toLowerCase() ?? ''
    let deps: DependencyInfo[] = []
    if (base === 'package.json') deps = parsePackageJson(manifest)
    else if (base === 'requirements.txt') deps = parseRequirementsTxt(manifest)
    else if (base === 'go.mod') deps = parseGoMod(manifest)
    else if (base === 'cargo.toml') deps = parseCargoToml(manifest)
    else if (base === 'pyproject.toml') deps = parsePyprojectToml(manifest)
    for (const dep of deps) {
      const existing = byName.get(dep.name.toLowerCase())
      if (!existing || (existing.dev && !dep.dev)) byName.set(dep.name.toLowerCase(), dep)
    }
  }
  return [...byName.values()]
}

/** Bağımlılık envanterinden framework/teknoloji etiketleri. */
export function detectFrameworks(dependencies: DependencyInfo[]): string[] {
  const found = new Set<string>()
  for (const dep of dependencies) {
    const label = FRAMEWORK_SIGNATURES[dep.name.toLowerCase()]
    if (label) found.add(label)
  }
  return [...found].sort()
}

// ── Klasör yapısı ───────────────────────────────────────────────────────────

export function analyzeFolderStructure(treePaths: string[], manifests: ManifestFile[]): FolderStructure {
  const topLevel = new Set<string>()
  let hasTests = false
  let hasDocs = false
  let hasCi = false
  let hasExamples = false

  for (const path of treePaths) {
    const segments = path.split('/')
    if (segments.length > 1) topLevel.add(segments[0])
    const lowered = path.toLowerCase()
    if (/(^|\/)(tests?|__tests__|spec)\//.test(lowered) || /\.(test|spec)\.[a-z]+$/.test(lowered)) hasTests = true
    if (/^docs?\//.test(lowered)) hasDocs = true
    if (lowered.startsWith('.github/workflows/') || lowered === '.gitlab-ci.yml') hasCi = true
    if (/^(examples?|samples?)\//.test(lowered)) hasExamples = true
  }

  const workspaceManifest = manifests.some((m) => {
    if (!m.path.toLowerCase().endsWith('package.json')) return false
    try {
      const body = JSON.parse(m.content) as { workspaces?: unknown }
      return body.workspaces !== undefined
    } catch {
      return false
    }
  })

  return {
    topLevelDirs: [...topLevel].sort(),
    fileCount: treePaths.length,
    hasTests,
    hasDocs,
    hasCi,
    hasExamples,
    isMonorepo: workspaceManifest || topLevel.has('packages') || topLevel.has('apps'),
    hasSrcLayout: topLevel.has('src') || topLevel.has('lib'),
  }
}

// ── README / dokümantasyon kalitesi ─────────────────────────────────────────

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** README kalitesi [0,1]: uzunluk bandı + başlık + kod örneği + kurulum/
 *  kullanım bölümleri + link varlığı. Boş/yok = 0. */
export function scoreReadmeQuality(readme: string | null): number {
  if (!readme || !readme.trim()) return 0
  const text = readme.trim()
  const lowered = text.toLowerCase()
  const headings = (text.match(/^#{1,6}\s+/gm) ?? []).length
  const codeBlocks = (text.match(/^```/gm) ?? []).length / 2
  const hasInstall = /install|kurulum|getting started|quickstart/.test(lowered)
  const hasUsage = /usage|example|kullanım|örnek|how to/.test(lowered)
  const hasLinks = /\[[^\]]+\]\(https?:\/\//.test(text)

  return clamp01(
    (text.length >= 500 ? 0.25 : text.length / 2000)
    + Math.min(0.2, headings * 0.04)
    + Math.min(0.2, codeBlocks * 0.07)
    + (hasInstall ? 0.15 : 0)
    + (hasUsage ? 0.1 : 0)
    + (hasLinks ? 0.1 : 0),
  )
}

/** Dokümantasyon kalitesi [0,1]: README harmanı + docs/ + CONTRIBUTING/
 *  CHANGELOG varlığı + örnekler. */
export function scoreDocumentationQuality(
  readmeQuality: number,
  structure: FolderStructure,
  treePaths: string[],
): number {
  const lowered = treePaths.map((p) => p.toLowerCase())
  const hasContributing = lowered.some((p) => p.startsWith('contributing'))
  const hasChangelog = lowered.some((p) => p.startsWith('changelog'))
  return clamp01(
    readmeQuality * 0.5
    + (structure.hasDocs ? 0.25 : 0)
    + (structure.hasExamples ? 0.1 : 0)
    + (hasContributing ? 0.08 : 0)
    + (hasChangelog ? 0.07 : 0),
  )
}

// ── Aktivite ────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

/** Son push'a göre aktivite bandı: ≤30g active, ≤180g maintained,
 *  ≤540g stale, ötesi/bilinmiyor abandoned. Arşivli repo daima abandoned. */
export function classifyActivity(profile: Pick<GitHubRepoProfile, 'pushedAt' | 'archived'>, nowMs: number = Date.now()): ActivityLevel {
  if (profile.archived) return 'abandoned'
  if (!profile.pushedAt) return 'abandoned'
  const age = (nowMs - Date.parse(profile.pushedAt)) / DAY_MS
  if (Number.isNaN(age)) return 'abandoned'
  if (age <= 30) return 'active'
  if (age <= 180) return 'maintained'
  if (age <= 540) return 'stale'
  return 'abandoned'
}

// ── Proje sınıflaması ───────────────────────────────────────────────────────

export interface ClassificationInput {
  name: string
  description: string | null
  topics: string[]
  readme: string | null
  dependencies: DependencyInfo[]
  structure: Pick<FolderStructure, 'topLevelDirs'>
  /** package.json bin alanı gibi CLI kanıtı — parseClassifierEvidence üretir. */
  hasBinField: boolean
}

/** Manifest'lerden sınıflandırıcı kanıtı (bin alanı = CLI sinyali). */
export function parseClassifierEvidence(manifests: ManifestFile[]): { hasBinField: boolean } {
  for (const m of manifests) {
    if (!m.path.toLowerCase().endsWith('package.json')) continue
    try {
      const body = JSON.parse(m.content) as { bin?: unknown }
      if (body.bin !== undefined) return { hasBinField: true }
    } catch { /* bozuk manifest sınıflamayı düşürmez */ }
  }
  return { hasBinField: false }
}

/**
 * Kural-tabanlı proje sınıflaması. Her tür için puan: ad/topic eşleşmesi 3,
 * açıklama eşleşmesi 2, README (ilk 3000 karakter) eşleşmesi 1, bağımlılık
 * imzası 2, yapısal kanıt (bin=cli) 3. En yüksek puan primary; puan alan
 * her tür labels'a girer. Hiçbir imza tutmazsa 'library' varsayılanı
 * (confidence düşük — dürüst belirsizlik).
 */
export function classifyProject(input: ClassificationInput): RepositoryAnalysis['classification'] {
  const name = input.name.toLowerCase()
  const topics = input.topics.map((t) => t.toLowerCase())
  const description = (input.description ?? '').toLowerCase()
  const readmeHead = (input.readme ?? '').slice(0, 3000).toLowerCase()
  const depNames = new Set(input.dependencies.map((d) => d.name.toLowerCase()))

  const scores = new Map<ProjectKind, number>()
  const add = (kind: ProjectKind, points: number) => {
    if (points > 0) scores.set(kind, (scores.get(kind) ?? 0) + points)
  }

  for (const [kind, keywords, depSignatures] of KIND_SIGNATURES) {
    for (const keyword of keywords) {
      if (name.includes(keyword.replace(/\s+/g, '-')) || topics.some((t) => t.includes(keyword.replace(/\s+/g, '-')))) add(kind, 3)
      if (description.includes(keyword)) add(kind, 2)
      if (readmeHead.includes(keyword)) add(kind, 1)
    }
    for (const dep of depSignatures) {
      if (depNames.has(dep)) add(kind, 2)
    }
  }
  if (input.hasBinField) add('cli', 3)

  if (scores.size === 0) {
    return { primary: 'library', labels: ['library'], confidence: 0.2 }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || PROJECT_KINDS.indexOf(a[0]) - PROJECT_KINDS.indexOf(b[0]))
  const [primary, topScore] = ranked[0]
  return {
    primary,
    labels: ranked.map(([kind]) => kind),
    confidence: clamp01(0.3 + Math.min(0.6, topScore * 0.08)),
  }
}

// ── Ana analiz ──────────────────────────────────────────────────────────────

/** Tüm alt analizleri tek zarfta toplar — ingestion.ts'in çağırdığı yüz. */
export function analyzeRepository(input: RepoAnalysisInput): RepositoryAnalysis {
  const languages = computeLanguagePercentages(input.languageBytes)
  const primaryLanguage = Object.entries(languages).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const dependencies = parseDependencies(input.manifests)
  const frameworks = detectFrameworks(dependencies)
  const structure = analyzeFolderStructure(input.treePaths, input.manifests)
  const readmeQuality = scoreReadmeQuality(input.readme)
  const documentationQuality = scoreDocumentationQuality(readmeQuality, structure, input.treePaths)
  const { hasBinField } = parseClassifierEvidence(input.manifests)

  return {
    name: input.profile.repo,
    owner: input.profile.owner,
    description: input.profile.description,
    topics: input.profile.topics,
    stars: input.profile.stars,
    forks: input.profile.forks,
    license: input.profile.license,
    languages,
    primaryLanguage,
    frameworks,
    dependencies,
    structure,
    readmeQuality,
    documentationQuality,
    lastUpdate: input.profile.pushedAt,
    activity: classifyActivity(input.profile),
    classification: classifyProject({
      name: input.profile.repo,
      description: input.profile.description,
      topics: input.profile.topics,
      readme: input.readme,
      dependencies,
      structure,
      hasBinField,
    }),
  }
}
