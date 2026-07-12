export interface AgentDefinition {
  name: string
  displayName: string
  persona: string
  toolNames: string[]
  moduleTarget: string | null
  outputContract: string
  maxTokens?: number
  webSearch?: boolean
  /** Model override — verilmezse provider varsayılanı (lib/ai/anthropic.ts CLAUDE_MODEL) kullanılır.
   *  Basit/ucuz işler için 'claude-haiku-4-5' tercih et (maliyet optimizasyonu). */
  model?: string
  /** MAXAİ departman etiketi (örn 'growth', 'creative', 'legacy'). Yalnız
   *  roster/organizasyon metadata'sı — çalıştırma davranışını DEĞİŞTİRMEZ. */
  department?: string
  /** true ise ajan emeklidir: registry'den okunabilir kalır (eski agent_runs
   *  geçmişi kırılmasın diye) ama Sanchez'in yönlendirme rehberinde LİSTELENMEZ. */
  deprecated?: boolean
}
