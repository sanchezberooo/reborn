import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Knowledge Ingestion Engine testi (Sprint 6). Üç katman:
// 1. Saf analiz testleri (env'siz): repo-analyzer — dil yüzdesi, bağımlılık
//    ayrıştırma (5 manifest formatı), framework tespiti, yapı analizi,
//    README/dokümantasyon kalitesi, aktivite bandı, proje sınıflaması;
//    normalize format desteği; extract best-practice/anti-pattern.
// 2. Mock-fetch adaptör testleri (ağa ÇIKMAZ — source-fetcher.test.ts
//    deseni): GitHub profil/tree uçları + adaptör belge seçimi.
// 3. Canlı Supabase testleri (env yoksa skip): inline ingest → review queue
//    → karar (reviewer + metadata.review + statü terfisi).

import {
  analyzeFolderStructure, analyzeRepository, classifyActivity, classifyProject,
  computeLanguagePercentages, detectFrameworks, parseDependencies, scoreReadmeQuality,
} from './repo-analyzer'
import type { GitHubRepoProfile } from './source-fetcher'
import { normalizeSource } from './normalize'
import { parseDocument } from './parse'
import { extractCandidates } from './extract'
import { selectDocPaths } from './sources'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi sentinel — diğer setlerle (…0012/…0014) çakışmaz. */
const INGEST_USER_ID = '00000000-0000-4000-a000-000000000015'

const PROFILE: GitHubRepoProfile = {
  sourceUrl: 'https://github.com/acme/agent-kit',
  owner: 'acme',
  repo: 'agent-kit',
  description: 'An autonomous agent framework for building AI copilots',
  topics: ['agent', 'llm'],
  stars: 1200,
  forks: 80,
  openIssues: 12,
  license: 'MIT',
  defaultBranch: 'main',
  createdAt: '2024-01-01T00:00:00Z',
  pushedAt: new Date().toISOString(),
  archived: false,
}

// ── 1. Repo analyzer (saf) ──────────────────────────────────────────────────

describe('repo analyzer — dil, bağımlılık, framework', () => {
  it('dil baytlarını yüzdelere çevirir', () => {
    const pct = computeLanguagePercentages({ TypeScript: 7500, Python: 2500 })
    expect(pct.TypeScript).toBe(75)
    expect(pct.Python).toBe(25)
    expect(computeLanguagePercentages({})).toEqual({})
  })

  it('package.json bağımlılıklarını ayrıştırır (dev ayrımıyla)', () => {
    const deps = parseDependencies([{
      path: 'package.json',
      content: JSON.stringify({
        dependencies: { next: '^16.0.0', '@anthropic-ai/sdk': '^0.92.0' },
        devDependencies: { vitest: '^4.0.0' },
      }),
    }])
    expect(deps.find((d) => d.name === 'next')?.dev).toBe(false)
    expect(deps.find((d) => d.name === 'vitest')?.dev).toBe(true)
    expect(deps).toHaveLength(3)
  })

  it('requirements.txt / go.mod / Cargo.toml / pyproject.toml ayrıştırır', () => {
    const deps = parseDependencies([
      { path: 'requirements.txt', content: 'fastapi==0.110.0\n# yorum\nlangchain>=0.2\n' },
      { path: 'go.mod', content: 'module x\n\nrequire (\n\tgithub.com/spf13/cobra v1.8.0\n)\n' },
      { path: 'Cargo.toml', content: '[dependencies]\nserde = "1.0"\n\n[dev-dependencies]\nx = "1"' },
      { path: 'pyproject.toml', content: 'dependencies = [\n  "django>=5.0",\n]' },
    ])
    const names = deps.map((d) => d.name)
    expect(names).toContain('fastapi')
    expect(names).toContain('langchain')
    expect(names).toContain('github.com/spf13/cobra')
    expect(names).toContain('serde')
    expect(names).toContain('django')
  })

  it('bozuk manifest analizi düşürmez (boş döner)', () => {
    expect(parseDependencies([{ path: 'package.json', content: '{bozuk json' }])).toEqual([])
  })

  it('bağımlılıklardan framework tespit eder', () => {
    const frameworks = detectFrameworks([
      { name: 'next', version: '^16', source: 'package.json', dev: false },
      { name: 'langchain', version: '0.2', source: 'requirements.txt', dev: false },
      { name: 'tanınmayan-paket', version: null, source: 'package.json', dev: false },
    ])
    expect(frameworks).toContain('Next.js')
    expect(frameworks).toContain('LangChain')
    expect(frameworks).toHaveLength(2)
  })
})

describe('repo analyzer — yapı, kalite, aktivite, sınıflama', () => {
  it('klasör yapısını analiz eder (monorepo/test/docs/ci)', () => {
    const structure = analyzeFolderStructure(
      ['packages/core/index.ts', 'apps/web/page.tsx', 'docs/intro.md', 'src/lib.ts',
        '.github/workflows/ci.yml', 'tests/unit.test.ts', 'examples/demo.ts'],
      [],
    )
    expect(structure.isMonorepo).toBe(true)
    expect(structure.hasTests).toBe(true)
    expect(structure.hasDocs).toBe(true)
    expect(structure.hasCi).toBe(true)
    expect(structure.hasExamples).toBe(true)
    expect(structure.topLevelDirs).toContain('packages')
  })

  it('README kalitesi: yapılı README > çıplak metin > yok', () => {
    const rich = scoreReadmeQuality([
      '# Proje', 'Uzun açıklama '.repeat(50), '## Install', '```bash\nnpm i\n```',
      '## Usage', '```ts\nrun()\n```', '[docs](https://example.dev)',
    ].join('\n\n'))
    const bare = scoreReadmeQuality('kısa açıklama')
    expect(rich).toBeGreaterThan(0.7)
    expect(bare).toBeLessThan(0.3)
    expect(scoreReadmeQuality(null)).toBe(0)
  })

  it('aktivite bantları: push tarihine göre + arşiv daima abandoned', () => {
    const now = Date.now()
    const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString()
    expect(classifyActivity({ pushedAt: iso(5), archived: false }, now)).toBe('active')
    expect(classifyActivity({ pushedAt: iso(90), archived: false }, now)).toBe('maintained')
    expect(classifyActivity({ pushedAt: iso(400), archived: false }, now)).toBe('stale')
    expect(classifyActivity({ pushedAt: iso(900), archived: false }, now)).toBe('abandoned')
    expect(classifyActivity({ pushedAt: iso(5), archived: true }, now)).toBe('abandoned')
    expect(classifyActivity({ pushedAt: null, archived: false }, now)).toBe('abandoned')
  })

  it('proje sınıflaması: agent / cli / template sinyalleri, imzasızda library', () => {
    const agent = classifyProject({
      name: 'agent-kit',
      description: 'An autonomous agent framework',
      topics: ['agent'],
      readme: 'Build multi-agent systems',
      dependencies: [{ name: 'langchain', version: null, source: 'package.json', dev: false }],
      structure: { topLevelDirs: ['src'] },
      hasBinField: false,
    })
    expect(agent.primary).toBe('agent')
    expect(agent.labels).toContain('framework')

    const cli = classifyProject({
      name: 'mytool', description: null, topics: [], readme: null,
      dependencies: [], structure: { topLevelDirs: [] }, hasBinField: true,
    })
    expect(cli.primary).toBe('cli')

    const template = classifyProject({
      name: 'nextjs-starter-template', description: 'Starter boilerplate', topics: [],
      readme: null, dependencies: [], structure: { topLevelDirs: [] }, hasBinField: false,
    })
    expect(template.primary).toBe('template')

    const unknown = classifyProject({
      name: 'xyz', description: null, topics: [], readme: null,
      dependencies: [], structure: { topLevelDirs: [] }, hasBinField: false,
    })
    expect(unknown.primary).toBe('library')
    expect(unknown.confidence).toBeLessThanOrEqual(0.3)
  })

  it('analyzeRepository tüm alt analizleri tek zarfta toplar', () => {
    const analysis = analyzeRepository({
      profile: PROFILE,
      languageBytes: { TypeScript: 9000, JavaScript: 1000 },
      treePaths: ['src/index.ts', 'docs/guide.md', 'package.json', 'tests/x.test.ts'],
      manifests: [{
        path: 'package.json',
        content: JSON.stringify({ dependencies: { langchain: '0.2', react: '19' } }),
      }],
      readme: '# agent-kit\n\nAutonomous agent framework.\n\n## Install\n\n```bash\nnpm i\n```',
    })
    expect(analysis.primaryLanguage).toBe('TypeScript')
    expect(analysis.frameworks).toContain('LangChain')
    expect(analysis.classification.primary).toBe('agent')
    expect(analysis.activity).toBe('active')
    expect(analysis.readmeQuality).toBeGreaterThan(0)
    expect(analysis.structure.hasTests).toBe(true)
  })
})

// ── 2. Format desteği + yeni extraction türleri (saf) ───────────────────────

describe('format desteği (normalize)', () => {
  it('json içerik pretty-print edilip fence içine sarılır', () => {
    const doc = normalizeSource({
      sourceType: 'markdown',
      format: 'json',
      title: 'Config',
      content: '{"a":1,"b":{"c":2}}',
    })
    expect(doc.content.startsWith('```json')).toBe(true)
    expect(doc.content).toContain('"b": {')
    expect(doc.title).toBe('Config')
  })

  it('yaml/code fence sarılır, geçersiz fence dili sanitize edilir', () => {
    const yaml = normalizeSource({ sourceType: 'markdown', format: 'yaml', title: 'y', content: 'a: 1' })
    expect(yaml.content.startsWith('```yaml')).toBe(true)
    const code = normalizeSource({
      sourceType: 'markdown', format: 'code', language: 'ts"><script', title: 'c', content: 'const a = 1',
    })
    expect(code.content.startsWith('```text')).toBe(true)
  })

  it('json belgede frontmatter aranmaz, fence satırı başlık olmaz', () => {
    const doc = normalizeSource({ sourceType: 'markdown', format: 'json', content: '{"x":1}', sourceUrl: 'https://a.dev/x.json' })
    expect(doc.title).toBe('https://a.dev/x.json')
    expect(doc.frontmatter).toEqual({})
  })
})

describe('extraction — best practice / anti-pattern', () => {
  it('öneri dili best-practice, kaçınma dili anti-pattern adayı üretir', () => {
    const parsed = parseDocument(normalizeSource({
      sourceType: 'markdown',
      content: [
        '# Kılavuz',
        '## Önerilen yaklaşım',
        'Bu bölümde recommended ve best practice yaklaşımlar listelenir:',
        '- Küçük fonksiyonlar tercih et (prefer small functions)',
        '- Convention üzerinden yapılandır',
        '## Kaçınılması gerekenler',
        "Şu yaygın hata (common mistake) kalıplarından avoid edilmeli, don't do:",
        '- God object yapma (yapma!)',
        '- Global state kullanmaktan kaçın',
      ].join('\n\n'),
    }))
    const kinds = new Set(extractCandidates(parsed).map((c) => c.kind))
    expect(kinds).toContain('best-practice')
    expect(kinds).toContain('anti-pattern')
  })
})

// ── 3. GitHub uçları + adaptör belge seçimi (mock fetch) ────────────────────

describe('github ingestion uçları (mock fetch — ağa çıkmaz)', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  it('fetchGitHubRepoProfile tam profil döner; 404 nazik hata', async () => {
    const { fetchGitHubRepoProfile } = await import('./source-fetcher')
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      description: 'x', topics: ['ai'], stargazers_count: 10, forks_count: 2,
      open_issues_count: 1, license: { spdx_id: 'MIT' }, default_branch: 'main',
      created_at: '2024-01-01T00:00:00Z', pushed_at: '2026-07-01T00:00:00Z', archived: false,
    }))
    const profile = await fetchGitHubRepoProfile('https://github.com/foo/bar')
    expect(profile).toMatchObject({ owner: 'foo', repo: 'bar', license: 'MIT', forks: 2 })

    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: 'Not Found' }))
    const missing = await fetchGitHubRepoProfile('https://github.com/foo/yok')
    expect(missing).toMatchObject({ ok: false })
  })

  it('fetchGitHubTree yalnız blob yollarını döner ve tavana kırpar', async () => {
    const { fetchGitHubTree, MAX_TREE_ENTRIES } = await import('./source-fetcher')
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      tree: [
        { path: 'src', type: 'tree' },
        { path: 'src/index.ts', type: 'blob' },
        { path: 'README.md', type: 'blob' },
      ],
      truncated: false,
    }))
    const tree = await fetchGitHubTree('foo', 'bar', 'main')
    expect(tree).toEqual({ paths: ['src/index.ts', 'README.md'], truncated: false })
    expect(MAX_TREE_ENTRIES).toBeGreaterThan(0)
  })

  it('GITHUB_TOKEN varsa Authorization başlığı gider, yoksa gitmez', async () => {
    const { fetchGitHubLanguages } = await import('./source-fetcher')
    vi.stubEnv('GITHUB_TOKEN', 'test-token-123')
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { TypeScript: 100 }))
    await fetchGitHubLanguages('foo', 'bar')
    const withToken = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(withToken.Authorization).toBe('Bearer test-token-123')

    vi.stubEnv('GITHUB_TOKEN', '')
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    await fetchGitHubLanguages('foo', 'bar')
    const withoutToken = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>
    expect(withoutToken.Authorization).toBeUndefined()
  })
})

describe('adaptör belge seçimi (saf)', () => {
  it('kök md + docs/ md seçilir; README hariç; deterministik sıralı; tavanlı', () => {
    const paths = selectDocPaths([
      'README.md', 'CONTRIBUTING.md', 'ARCHITECTURE.md',
      'docs/a.md', 'docs/deep/b.md', 'src/notes.md', 'src/index.ts',
    ])
    expect(paths).not.toContain('README.md')
    expect(paths).not.toContain('src/notes.md') // ne kök ne docs/
    expect(paths[0]).toBe('ARCHITECTURE.md') // kök önce, alfabetik
    expect(paths).toContain('docs/deep/b.md')

    const capped = selectDocPaths(Array.from({ length: 30 }, (_, i) => `docs/${i}.md`), 5)
    expect(capped).toHaveLength(5)
  })
})

// ── 4. Canlı: inline ingest → review queue → karar ──────────────────────────

describe.skipIf(!hasEnv)('review queue uçtan uca (canlı Supabase + lokal embedding)', () => {
  async function adminApi() {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    return getSupabaseAdmin()
  }

  async function cleanup() {
    const supabase = await adminApi()
    await supabase.from('runtime_events').delete().eq('user_id', INGEST_USER_ID)
    await supabase.from('entities').delete().eq('user_id', INGEST_USER_ID)
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  it('inline belge kuyruğa düşer; approve kararı statü + review kaydı + olay üretir', async () => {
    const { ingestInlineDocument } = await import('./ingestion')
    const { listReviewQueue } = await import('./review-queue')
    const { reviewKnowledgeNode } = await import('./registry')
    const { getScopedNode } = await import('../brain/graph')

    const result = await ingestInlineDocument({
      sourceType: 'markdown',
      title: 'Review Kuyruğu Test Belgesi',
      author: 'Bero',
      content: [
        '# Review Kuyruğu Test Belgesi',
        'Bu belge inceleme kuyruğu akışını doğrular. Kaynak: [ref](https://example.dev/doc).',
        '## Nasıl işler',
        '1. Belge içe alınır ve aday statüsüyle doğar',
        '2. Kuyruk yüzeyinde listelenir',
        '3. Karar statüyü terfi ettirir',
      ].join('\n\n'),
    }, { userId: INGEST_USER_ID })

    expect('ok' in result).toBe(false)
    const stored = result as Exclude<typeof result, { ok: false; error: string }>
    expect(stored.outcome).toBe('stored')
    const itemNodeId = stored.item!.nodeId

    // Kuyrukta görünür — Score/Confidence/Reason/Source/Status dolu.
    const queue = await listReviewQueue({ limit: 50 })
    const entry = queue.find((e) => e.nodeId === itemNodeId)
    expect(entry).toBeDefined()
    expect(entry!.entryKind).toBe('item')
    expect(entry!.status).toBe('aday')
    expect(entry!.score).toBeGreaterThan(0)
    expect(entry!.reason).toContain('kalite')
    expect(entry!.reviewer).toBeNull()

    // Karar: approve → doğrulanmış + metadata.review + kuyruktan düşer.
    const reviewed = await reviewKnowledgeNode(itemNodeId, 'approve', { reviewer: 'bero', note: 'test onayı' })
    expect(reviewed.status).toBe('doğrulanmış')

    const node = await getScopedNode(itemNodeId, 'agent')
    const review = node!.metadata?.review as { reviewer: string; decision: string } | undefined
    expect(review?.reviewer).toBe('bero')
    expect(review?.decision).toBe('approve')

    const after = await listReviewQueue({ limit: 50 })
    expect(after.some((e) => e.nodeId === itemNodeId)).toBe(false)

    // Geçmiş görünümü karar kaydını gösterir.
    const history = await listReviewQueue({ reviewed: true, limit: 50 })
    expect(history.some((e) => e.nodeId === itemNodeId && e.reviewer === 'bero')).toBe(true)
  }, 300_000)
})
