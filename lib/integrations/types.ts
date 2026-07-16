// Gelecek altyapı soyutlaması — dış dünya entegrasyonlarının sözleşme
// katmanı (Sprint 2, madde 7). BURADA İMPLEMENTASYON YOKTUR ve bu bilinçli
// bir karardır (Sprint 1): OpenClaw, n8n ve MCP, izin/onay katmanı
// tasarlanmadan entegre EDİLMEYECEK. Bu dosya o günün sözleşmesini bugünden
// sabitler — implementasyon geldiğinde çekirdek (Sanchez Core, ajanlar,
// departman izinleri) DEĞİŞMEZ; yalnız lib/integrations/registry.ts'e bir
// kayıt eklenir.
//
// Üç rol, üç sözleşme (Sprint 1 terminolojisi):
//   * ChannelGateway   (OpenClaw) — kanal/gateway: dış dünyadan Sanchez'e
//     GELEN mesajlar (WhatsApp, Telegram, mail…). Kanal Sanchez'e konuşur;
//     tek muhatap ilkesi bozulmaz — kanal bir ajana asla doğrudan bağlanmaz.
//   * ActionExecutor   (n8n)      — dışa-eylem yürütücüsü: dış dünyayı
//     DEĞİŞTİREN işler (mail gönder, yayınla, harca). Her dış-yazma eylemi
//     insan onayı (ApprovalGrant) olmadan ÇALIŞTIRILAMAZ — bu kural
//     registry kayıt anında doğrulanır, iyi niyete bırakılmaz.
//   * ResourceProvider (MCP)      — kaynak erişim standardı: dış kaynakların
//     SALT OKUNMASI (Obsidian, GitHub, Drive…). Yazma bu sözleşmenin
//     dışındadır — yazan her şey ActionExecutor'dur.

export const INTEGRATION_KINDS = [
  'channel-gateway',
  'action-executor',
  'resource-provider',
] as const
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number]

/** Tüm entegrasyon türlerinin ortak künyesi. */
export interface IntegrationDescriptor {
  /** kebab-case benzersiz kimlik (örn 'openclaw', 'n8n-main', 'mcp-obsidian'). */
  id: string
  kind: IntegrationKind
  displayName: string
  description: string
}

// ── Onay sözleşmesi (izin katmanının çekirdeği) ─────────────────────────────

/** Dış-yazma eyleminin çalıştırılabilmesi için gereken insan onayı kaydı.
 *  v1'de bunu üretecek UI/akış yok — sözleşme, implementasyon gününde
 *  execute() imzasının değişmemesi için bugünden sabittir. */
export interface ApprovalGrant {
  /** Onayı veren (tek kullanıcılı fazda profil id'si). */
  grantedBy: string
  grantedAt: string
  /** Onayın kapsamı: hangi eylem, hangi girdiyle. Genel/açık-uçlu onay
   *  ("her şeyi yapabilirsin") tanım gereği YOKTUR — kapsam eylem başınadır. */
  actionName: string
  inputDigest: string
}

/** Eylemin dünyaya etkisi. 'external-write' olan her eylem onay ister —
 *  registry, aksini beyan eden executor kaydını reddeder. */
export type ActionSideEffect = 'read-only' | 'external-write'

export interface ExternalActionSpec {
  /** kebab-case eylem adı (örn 'send-email', 'publish-post'). */
  name: string
  description: string
  sideEffect: ActionSideEffect
  /** true → bu eylem ApprovalGrant olmadan çağrılamaz. Dış-yazma eylemlerinde
   *  zorunlu true (registry doğrular); salt-okumada false olabilir. */
  requiresApproval: boolean
}

// ── ChannelGateway (OpenClaw rolü) ──────────────────────────────────────────

/** Dış kanaldan gelen, Sanchez'e teslim edilecek mesaj zarfı. */
export interface InboundChannelMessage {
  channelId: string
  senderRef: string
  content: string
  receivedAt: string
}

export interface ChannelGateway extends IntegrationDescriptor {
  kind: 'channel-gateway'
  /** Gateway'in taşıdığı kanallar (örn 'whatsapp', 'telegram'). */
  channels: string[]
  /** Gelen mesajları teslim alacak tek alıcı Sanchez'dir — handler'ı
   *  çekirdek bağlar; gateway alıcı SEÇEMEZ (tek muhatap ilkesi). */
  subscribe(handler: (message: InboundChannelMessage) => Promise<void>): () => void
}

// ── ActionExecutor (n8n rolü) ───────────────────────────────────────────────

export interface ActionExecutionResult {
  ok: boolean
  output?: unknown
  error?: string
}

export interface ActionExecutor extends IntegrationDescriptor {
  kind: 'action-executor'
  /** Yürütücünün sunduğu eylemlerin beyanı — registry bu listeyi doğrular. */
  actions: ExternalActionSpec[]
  /** Dış-yazma eyleminde approval ZORUNLUDUR; implementasyon onaysız
   *  çağrıyı reddetmekle yükümlüdür (sözleşme ihlali = kayıt reddi). */
  execute(
    actionName: string,
    input: Record<string, unknown>,
    approval?: ApprovalGrant,
  ): Promise<ActionExecutionResult>
}

// ── ResourceProvider (MCP rolü) ─────────────────────────────────────────────

export interface ResourceRef {
  uri: string
  title: string
  mimeType?: string
}

export interface ResourceContent {
  uri: string
  content: string
  mimeType?: string
}

export interface ResourceProvider extends IntegrationDescriptor {
  kind: 'resource-provider'
  /** Salt okuma — bu sözleşmede yazma yolu bilinçli YOKTUR. */
  listResources(prefix?: string): Promise<ResourceRef[]>
  readResource(uri: string): Promise<ResourceContent | null>
}

export type Integration = ChannelGateway | ActionExecutor | ResourceProvider
