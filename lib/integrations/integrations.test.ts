import { afterEach, describe, expect, it } from 'vitest'

// Entegrasyon registry sözleşme testi — Sprint 1 kararının bekçisini korur:
// onay katmanı sözleşmesine uymayan dış-eylem yürütücüsü sisteme TAKILAMAZ.
// v1'de gerçek entegrasyon yok; buradaki tanımlar yalnız sözleşmenin
// doğrulama davranışını ölçen test fixture'larıdır.

import { getIntegration, listIntegrations, registerIntegration, unregisterIntegration } from './registry'
import type { ActionExecutor, ChannelGateway, ResourceProvider } from './types'

const testIds = ['test-executor', 'test-gateway', 'test-provider', 'kotu-executor']

afterEach(() => {
  for (const id of testIds) unregisterIntegration(id)
})

function makeExecutor(overrides: Partial<ActionExecutor> = {}): ActionExecutor {
  return {
    id: 'test-executor',
    kind: 'action-executor',
    displayName: 'Test Executor',
    description: 'Sözleşme testi fixture\'ı.',
    actions: [
      { name: 'read-status', description: 'Durum okur.', sideEffect: 'read-only', requiresApproval: false },
      { name: 'send-email', description: 'Mail gönderir.', sideEffect: 'external-write', requiresApproval: true },
    ],
    execute: async () => ({ ok: false, error: 'test fixture — çalıştırma yok' }),
    ...overrides,
  }
}

describe('integration registry — kayıt doğrulaması', () => {
  it('sözleşmeye uyan executor kaydolur ve listelenir', () => {
    registerIntegration(makeExecutor())
    expect(getIntegration('test-executor')).not.toBeNull()
    expect(listIntegrations('action-executor').map((i) => i.id)).toContain('test-executor')
  })

  it('onaysız dış-yazma eylemi beyan eden executor REDDEDİLİR (Sprint 1 kararı)', () => {
    expect(() =>
      registerIntegration(
        makeExecutor({
          id: 'kotu-executor',
          actions: [
            { name: 'publish-post', description: 'Yayınlar.', sideEffect: 'external-write', requiresApproval: false },
          ],
        }),
      ),
    ).toThrow(/requiresApproval=true/)
    expect(getIntegration('kotu-executor')).toBeNull()
  })

  it('id çakışması, geçersiz id ve tekrarlı eylem adı reddedilir', () => {
    registerIntegration(makeExecutor())
    expect(() => registerIntegration(makeExecutor())).toThrow(/zaten kayıtlı/)

    expect(() => registerIntegration(makeExecutor({ id: 'Büyük_Harf' }))).toThrow(/kebab-case/)

    expect(() =>
      registerIntegration(
        makeExecutor({
          id: 'kotu-executor',
          actions: [
            { name: 'ayni-ad', description: 'a', sideEffect: 'read-only', requiresApproval: false },
            { name: 'ayni-ad', description: 'b', sideEffect: 'read-only', requiresApproval: false },
          ],
        }),
      ),
    ).toThrow(/tekrarlı/)
  })

  it('gateway ve provider sözleşmeleri kaydolur; tür filtresi çalışır', () => {
    const gateway: ChannelGateway = {
      id: 'test-gateway',
      kind: 'channel-gateway',
      displayName: 'Test Gateway',
      description: 'Kanal fixture\'ı.',
      channels: ['telegram'],
      subscribe: () => () => {},
    }
    const provider: ResourceProvider = {
      id: 'test-provider',
      kind: 'resource-provider',
      displayName: 'Test Provider',
      description: 'Kaynak fixture\'ı.',
      listResources: async () => [],
      readResource: async () => null,
    }
    registerIntegration(gateway)
    registerIntegration(provider)

    expect(listIntegrations('channel-gateway').map((i) => i.id)).toContain('test-gateway')
    expect(listIntegrations('resource-provider').map((i) => i.id)).toContain('test-provider')
    expect(listIntegrations().length).toBeGreaterThanOrEqual(2)
  })
})
