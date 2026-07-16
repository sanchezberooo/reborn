// Entegrasyon registry'si — dış dünya entegrasyonlarının tek takılma
// noktası. v1'de BOŞTUR ve boş kalması doğrudur: OpenClaw/n8n/MCP, izin/
// onay katmanı tasarlanmadan entegre edilmeyecek (Sprint 1 kararı). Kayıt
// anındaki doğrulamalar o kararın koddaki bekçisidir — sözleşmeye uymayan
// entegrasyon sisteme TAKILAMAZ:
//   * Dış-yazma (external-write) eylemi olan her ActionExecutor, o eylemi
//     requiresApproval=true beyan etmek zorundadır.
//   * ResourceProvider salt okumadır; ChannelGateway alıcı seçemez —
//     bunlar tip sözleşmesiyle sabittir (types.ts).

import type { Integration, IntegrationKind } from './types'
import { INTEGRATION_KINDS } from './types'

const INTEGRATION_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

const integrations = new Map<string, Integration>()

/**
 * Entegrasyon kaydı — ihlalde FIRLATIR (sessiz düşme yok):
 *  1. id kebab-case ve benzersiz olmalı.
 *  2. kind tanımlı bir entegrasyon türü olmalı.
 *  3. ActionExecutor: her external-write eylem requiresApproval=true beyan
 *     etmeli; eylem adları benzersiz ve kebab-case olmalı. Onaysız dış-yazma
 *     beyan eden yürütücü SİSTEME GİREMEZ.
 */
export function registerIntegration(integration: Integration): Integration {
  if (!INTEGRATION_ID_RE.test(integration.id)) {
    throw new Error(`registerIntegration: '${integration.id}' geçersiz id — kebab-case bekleniyor.`)
  }
  if (integrations.has(integration.id)) {
    throw new Error(`registerIntegration: '${integration.id}' zaten kayıtlı.`)
  }
  if (!INTEGRATION_KINDS.includes(integration.kind)) {
    throw new Error(`registerIntegration: '${integration.kind}' tanımlı bir entegrasyon türü değil.`)
  }

  if (integration.kind === 'action-executor') {
    const seen = new Set<string>()
    for (const action of integration.actions) {
      if (!INTEGRATION_ID_RE.test(action.name)) {
        throw new Error(`registerIntegration(${integration.id}): eylem adı '${action.name}' kebab-case olmalı.`)
      }
      if (seen.has(action.name)) {
        throw new Error(`registerIntegration(${integration.id}): eylem adı '${action.name}' tekrarlı.`)
      }
      seen.add(action.name)
      if (action.sideEffect === 'external-write' && !action.requiresApproval) {
        throw new Error(
          `registerIntegration(${integration.id}): '${action.name}' dış-yazma eylemi onaysız beyan edilmiş — ` +
            'external-write her zaman requiresApproval=true olmak zorunda (izin/onay katmanı kararı).',
        )
      }
    }
  }

  integrations.set(integration.id, integration)
  return integration
}

export function unregisterIntegration(id: string): boolean {
  return integrations.delete(id)
}

export function getIntegration(id: string): Integration | null {
  return integrations.get(id) ?? null
}

export function listIntegrations(kind?: IntegrationKind): Integration[] {
  const all = [...integrations.values()]
  return kind ? all.filter((i) => i.kind === kind) : all
}
