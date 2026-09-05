import type { DepartmentId } from '../departments/types'

/** outputSchema'da bir alanın beklenen tipi. */
export type OutputFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object'

/** Tek bir çıktı şekli: üst seviye alan → tip. İç içe doğrulama YOK. */
export type OutputShape = Record<string, OutputFieldType>

export interface AgentDefinition {
  name: string
  displayName: string
  persona: string
  toolNames: string[]
  moduleTarget: string | null
  outputContract: string
  /**
   * outputContract'ın MAKİNE-KONTROL EDİLEBİLİR çekirdeği (VERIFY aşaması,
   * lib/agents/verify.ts). outputContract bir STRING'dir — prompt'a giren
   * düzyazı sözleşme; şema değildir ve doğrulanamaz. Bu alan onun yerini
   * ALMAZ, yanına küçük bir kontrol koyar.
   *
   * OPSİYONEL: beyan edilmemişse şema kontrolü atlanır, diğer verify
   * kontrolleri yine çalışır. Roster'ın tamamına yazılmaz — yalnız çıktı
   * şekli gerçekten sabit olan ajanlara.
   *
   * DİZİ verilirse ALTERNATİF şekiller (OR) demektir: çıktısı moda göre
   * değişen ajan (knowledge-agent: sinyal işleme vs. rapor) her modunu ayrı
   * bir şekil olarak beyan eder, herhangi birine uymak yeterlidir.
   */
  outputSchema?: OutputShape | OutputShape[]
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
