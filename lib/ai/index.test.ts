import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV }
  delete process.env.AI_PROVIDER
  delete process.env.ANTHROPIC_API_KEY
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe('getAIProvider provider seçimi', () => {
  it('AI_PROVIDER=mock ise key olsa da MockProvider döner', async () => {
    process.env.AI_PROVIDER = 'mock'
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    const { getAIProvider } = await import('./index')
    expect(getAIProvider().name).toBe('mock')
  })

  it('AI_PROVIDER=anthropic ise AnthropicProvider döner', async () => {
    process.env.AI_PROVIDER = 'anthropic'
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    const { getAIProvider } = await import('./index')
    expect(getAIProvider().name).toBe('anthropic')
  })

  it('AI_PROVIDER boş ama ANTHROPIC_API_KEY varsa AnthropicProvider seçer', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    const { getAIProvider } = await import('./index')
    expect(getAIProvider().name).toBe('anthropic')
  })

  it('AI_PROVIDER boş ve key yoksa MockProvider\'a düşer', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getAIProvider } = await import('./index')
    expect(getAIProvider().name).toBe('mock')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('bilinmeyen AI_PROVIDER değerinde uyarır ve key durumuna göre düşer (key yok → mock)', async () => {
    process.env.AI_PROVIDER = 'not-a-real-provider'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getAIProvider } = await import('./index')
    expect(getAIProvider().name).toBe('mock')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('aynı modül içinde ikinci çağrı önbellekten aynı örneği döner', async () => {
    process.env.AI_PROVIDER = 'mock'
    const { getAIProvider } = await import('./index')
    expect(getAIProvider()).toBe(getAIProvider())
  })
})
