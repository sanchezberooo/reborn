import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// source-fetcher birim testleri — ağa ÇIKMAZ: global fetch mock'lanır.
// Odak, güvenlik-kritik whitelist (yalnız github.com) + hata sözleşmesi
// ({ ok:false, error } — fırlatma yok) + happy path alan eşlemesi.

import {
  fetchSourceContent,
  fetchSourceOverview,
  MAX_CONTENT_FILES,
  MAX_CONTENT_TOTAL_BYTES,
  parseGitHubRepoUrl,
  README_EXCERPT_CHARS,
  sanitizeRepoFilePath,
  type SourceContent,
  type SourceOverview,
} from './source-fetcher'

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

const REPO_META = {
  description: 'Test repo açıklaması',
  stargazers_count: 42,
  language: 'TypeScript',
  topics: ['ai', 'memory'],
}

describe('parseGitHubRepoUrl (github.com whitelist)', () => {
  it('geçerli repo linkini ayrıştırır', () => {
    expect(parseGitHubRepoUrl('https://github.com/vercel/next.js')).toEqual({
      owner: 'vercel',
      repo: 'next.js',
    })
  })

  it('www öneki ve .git sonekini normalize eder', () => {
    expect(parseGitHubRepoUrl('https://www.github.com/foo/bar.git')).toEqual({
      owner: 'foo',
      repo: 'bar',
    })
  })

  it('derin linkten owner/repo çıkarır (tree/blob yolları)', () => {
    expect(parseGitHubRepoUrl('https://github.com/foo/bar/tree/main/src')).toEqual({
      owner: 'foo',
      repo: 'bar',
    })
  })

  it('github.com dışı her domaini reddeder', () => {
    expect(parseGitHubRepoUrl('https://gitlab.com/foo/bar')).toBeNull()
    expect(parseGitHubRepoUrl('https://evil-github.com/foo/bar')).toBeNull()
    expect(parseGitHubRepoUrl('https://github.com.evil.com/foo/bar')).toBeNull()
    expect(parseGitHubRepoUrl('https://api.github.com/repos/foo/bar')).toBeNull()
  })

  it('http(s) dışı protokolleri reddeder', () => {
    expect(parseGitHubRepoUrl('ftp://github.com/foo/bar')).toBeNull()
    expect(parseGitHubRepoUrl('file:///etc/passwd')).toBeNull()
  })

  it('eksik/bozuk yolları ve path traversal segmentlerini reddeder', () => {
    expect(parseGitHubRepoUrl('https://github.com/tek-segment')).toBeNull()
    expect(parseGitHubRepoUrl('https://github.com/')).toBeNull()
    expect(parseGitHubRepoUrl('bu bir url değil')).toBeNull()
    expect(parseGitHubRepoUrl('https://github.com/../secrets')).toBeNull()
    expect(parseGitHubRepoUrl('https://github.com/foo/%2e%2e')).toBeNull()
  })
})

describe('fetchSourceOverview', () => {
  it("desteklenmeyen sourceType'ı ağa çıkmadan reddeder", async () => {
    const result = await fetchSourceOverview('https://github.com/foo/bar', 'youtube')
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('desteklenmiyor')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('whitelist dışı URL için ağa hiç çıkmaz', async () => {
    const result = await fetchSourceOverview('https://gitlab.com/foo/bar')
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('github.com')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('happy path: metadata + README excerpt döner, README kırpılır', async () => {
    const longReadme = 'A'.repeat(README_EXCERPT_CHARS + 500)
    fetchMock.mockImplementation((url: string) =>
      String(url).endsWith('/readme')
        ? Promise.resolve(new Response(longReadme, { status: 200 }))
        : Promise.resolve(jsonResponse(200, REPO_META)),
    )

    const result = (await fetchSourceOverview('https://github.com/foo/bar')) as SourceOverview
    expect(result).toMatchObject({
      sourceUrl: 'https://github.com/foo/bar',
      sourceType: 'github',
      description: 'Test repo açıklaması',
      stars: 42,
      language: 'TypeScript',
      topics: ['ai', 'memory'],
    })
    expect(result.readmeExcerpt).toHaveLength(README_EXCERPT_CHARS)
    // yalnız api.github.com'a istek atıldı
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0]).startsWith('https://api.github.com/repos/foo/bar')).toBe(true)
    }
  })

  it('README 404 ölümcül değil — boş excerpt ile overview döner', async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).endsWith('/readme')
        ? Promise.resolve(jsonResponse(404, { message: 'Not Found' }))
        : Promise.resolve(jsonResponse(200, REPO_META)),
    )

    const result = (await fetchSourceOverview('https://github.com/foo/bar')) as SourceOverview
    expect(result.readmeExcerpt).toBe('')
    expect(result.stars).toBe(42)
  })

  it('repo 404 → nazik hata (fırlatma yok)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'Not Found' }))
    const result = await fetchSourceOverview('https://github.com/foo/yok-boyle-repo')
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('bulunamadı')
  })

  it('403/429 → rate limit mesajı', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { message: 'rate limit exceeded' }))
    const result = await fetchSourceOverview('https://github.com/foo/bar')
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('rate limit')
  })

  it('ağ hatası → { ok:false } (fırlatma yok)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const result = await fetchSourceOverview('https://github.com/foo/bar')
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('ulaşılamadı')
  })
})

describe('sanitizeRepoFilePath', () => {
  it('normal repo-göreli yolları kabul eder ve encode eder', () => {
    expect(sanitizeRepoFilePath('src/index.ts')).toBe('src/index.ts')
    expect(sanitizeRepoFilePath('/README.md')).toBe('README.md')
    expect(sanitizeRepoFilePath('docs/my file.md')).toBe('docs/my%20file.md')
  })

  it('traversal, backslash ve şüpheli karakterleri reddeder', () => {
    expect(sanitizeRepoFilePath('../etc/passwd')).toBeNull()
    expect(sanitizeRepoFilePath('src/../../secret')).toBeNull()
    expect(sanitizeRepoFilePath('src\\index.ts')).toBeNull()
    expect(sanitizeRepoFilePath('a/b?ref=evil')).toBeNull()
    expect(sanitizeRepoFilePath('a//b')).toBeNull()
    expect(sanitizeRepoFilePath('')).toBeNull()
  })
})

describe('fetchSourceContent', () => {
  it("desteklenmeyen sourceType'ı ağa çıkmadan reddeder", async () => {
    const result = await fetchSourceContent('https://github.com/foo/bar', 'youtube', ['a.ts'])
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('desteklenmiyor')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('whitelist dışı URL için ağa hiç çıkmaz', async () => {
    const result = await fetchSourceContent('https://gitlab.com/foo/bar', undefined, ['a.ts'])
    expect(result).toMatchObject({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('boş/eksik paths → nazik ret', async () => {
    const result = await fetchSourceContent('https://github.com/foo/bar', undefined, [])
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain('paths')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it(`${MAX_CONTENT_FILES} dosyadan fazlası → nazik ret (fırlatma yok, ağa çıkmaz)`, async () => {
    const tooMany = Array.from({ length: MAX_CONTENT_FILES + 1 }, (_, i) => `f${i}.ts`)
    const result = await fetchSourceContent('https://github.com/foo/bar', undefined, tooMany)
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toContain(`en fazla ${MAX_CONTENT_FILES}`)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('happy path: dosya içerikleri döner, yalnız api.github.com/contents çağrılır', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        new Response(`içerik:${String(url).split('/contents/')[1]}`, {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    )

    const result = (await fetchSourceContent('https://github.com/foo/bar', 'github', [
      'src/index.ts',
      'README.md',
    ])) as SourceContent

    expect(result.files).toHaveLength(2)
    expect(result.files[0]).toMatchObject({ path: 'src/index.ts', truncated: false })
    expect(result.files[0].content).toContain('src/index.ts')
    expect(result.skipped).toHaveLength(0)
    expect(result.totalBytes).toBeGreaterThan(0)
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0]).startsWith('https://api.github.com/repos/foo/bar/contents/')).toBe(true)
    }
  })

  it('50KB toplam bütçesi: aşan dosya kırpılır, sonrakiler atlanır', async () => {
    const big = 'B'.repeat(MAX_CONTENT_TOTAL_BYTES - 100) // bütçenin çoğunu yer
    const alsoBig = 'C'.repeat(500) // kalan 100 bayta sığmaz → kırpılır
    let call = 0
    fetchMock.mockImplementation(() => {
      call++
      const body = call === 1 ? big : alsoBig
      return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } }))
    })

    const result = (await fetchSourceContent('https://github.com/foo/bar', undefined, [
      'big1.txt',
      'big2.txt',
      'never.txt',
    ])) as SourceContent

    expect(result.files).toHaveLength(2)
    expect(result.files[0].truncated).toBe(false)
    expect(result.files[1].truncated).toBe(true)
    expect(result.files[1].content).toHaveLength(100)
    expect(result.totalBytes).toBe(MAX_CONTENT_TOTAL_BYTES)
    // bütçe dolunca üçüncü dosya için ağa bile çıkılmaz
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0]).toMatchObject({ path: 'never.txt' })
    expect(result.skipped[0].reason).toContain('bütçesi doldu')
  })

  it('404 dosya ve dizin yolu skipped listesine düşer, kalanlar çekilir', async () => {
    fetchMock.mockImplementation((url: string) => {
      const path = String(url).split('/contents/')[1]
      if (path === 'yok.ts') return Promise.resolve(jsonResponse(404, { message: 'Not Found' }))
      if (path === 'src') return Promise.resolve(jsonResponse(200, [{ name: 'index.ts' }]))
      return Promise.resolve(new Response('gerçek içerik', { status: 200, headers: { 'Content-Type': 'text/plain' } }))
    })

    const result = (await fetchSourceContent('https://github.com/foo/bar', undefined, [
      'yok.ts',
      'src',
      'var.ts',
    ])) as SourceContent

    expect(result.files).toHaveLength(1)
    expect(result.files[0].path).toBe('var.ts')
    expect(result.skipped).toHaveLength(2)
    expect(result.skipped.find((s) => s.path === 'yok.ts')?.reason).toContain('bulunamadı')
    expect(result.skipped.find((s) => s.path === 'src')?.reason).toContain('dizin')
  })

  it('geçersiz yol (traversal) skipped olur, ağa o yol için çıkılmaz', async () => {
    fetchMock.mockResolvedValue(
      new Response('içerik', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    )
    const result = (await fetchSourceContent('https://github.com/foo/bar', undefined, [
      '../../etc/passwd',
      'ok.ts',
    ])) as SourceContent

    expect(result.files).toHaveLength(1)
    expect(result.skipped[0].reason).toContain('Geçersiz dosya yolu')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rate limit ilk dosyada gelirse kalan dosyalar ağa çıkmadan atlanır', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { message: 'rate limit exceeded' }))
    const result = (await fetchSourceContent('https://github.com/foo/bar', undefined, [
      'a.ts',
      'b.ts',
    ])) as SourceContent

    expect(result.files).toHaveLength(0)
    expect(result.skipped).toHaveLength(2)
    expect(result.skipped[0].reason).toContain('rate limit')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
