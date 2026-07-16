import type { DepartmentId } from '../departments/types'

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
  /** MAXAİ departman ataması (lib/departments/registry.ts sözleşmesi).
   *  Çalıştırma davranışını DEĞİŞTİRMEZ; ajanın hangi yetenekleri
   *  kullanabileceğini departman izinleri belirler (validateRoster testi). */
  department?: DepartmentId
  /** true ise ajan emeklidir: registry'den okunabilir kalır (eski agent_runs
   *  geçmişi kırılmasın diye) ama Sanchez'in yönlendirme rehberinde LİSTELENMEZ. */
  deprecated?: boolean
}
