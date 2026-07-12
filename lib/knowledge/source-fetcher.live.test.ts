import { describe, expect, it } from 'vitest'

// CANLI GitHub smoke testi — varsayılan koşuda ATLANIR (auth'suz rate limit
// 60/saat: her regresyonda gerçek API'ye çıkmak suite'i kırılganlaştırır).
// Gerçek API şekli değişti mi diye ara sıra elle koşulur:
//   RUN_LIVE_GITHUB=1 npx vitest run lib/knowledge/source-fetcher.live.test.ts
// Hedef: gerçek, küçük, stabil bir public repo (octocat/Hello-World).

import { fetchSourceContent, fetchSourceOverview, type SourceContent, type SourceOverview } from './source-fetcher'

describe.skipIf(process.env.RUN_LIVE_GITHUB !== '1')('CANLI GitHub API (octocat/Hello-World)', () => {
  it('fetch_source_overview gerçek repo metadata + README döner', async () => {
    const result = await fetchSourceOverview('https://github.com/octocat/Hello-World')
    expect(result).not.toHaveProperty('ok') // hata zarfı değil
    const overview = result as SourceOverview
    expect(overview.sourceUrl).toBe('https://github.com/octocat/Hello-World')
    expect(overview.sourceType).toBe('github')
    expect(typeof overview.stars).toBe('number')
    expect(overview.stars).toBeGreaterThan(0)
    expect(Array.isArray(overview.topics)).toBe(true)
    expect(overview.readmeExcerpt.length).toBeGreaterThan(0)
  }, 30_000)

  it('fetch_source_content gerçek dosya çeker, olmayan dosyayı skipped\'a düşürür', async () => {
    const result = await fetchSourceContent('https://github.com/octocat/Hello-World', 'github', [
      'README',
      'boyle-bir-dosya-yok.md',
    ])
    expect(result).not.toHaveProperty('ok')
    const content = result as SourceContent
    expect(content.files).toHaveLength(1)
    expect(content.files[0].path).toBe('README')
    expect(content.files[0].content.length).toBeGreaterThan(0)
    expect(content.skipped).toHaveLength(1)
    expect(content.skipped[0].path).toBe('boyle-bir-dosya-yok.md')
  }, 30_000)
})
