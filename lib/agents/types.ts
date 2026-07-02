export interface AgentDefinition {
  name: string
  displayName: string
  persona: string
  toolNames: string[]
  moduleTarget: string | null
  outputContract: string
  maxTokens?: number
  webSearch?: boolean
  /** Model override — verilmezse lib/anthropic.ts CLAUDE_MODEL kullanılır.
   *  Basit/ucuz işler için 'claude-haiku-4-5' tercih et (maliyet optimizasyonu). */
  model?: string
}
