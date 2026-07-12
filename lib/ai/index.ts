import type { AIProvider } from './provider'
import { AnthropicProvider } from './anthropic'
import { MockProvider } from './mock'

export type { AIMessage, AIProvider, AIRequest, AIStreamEvent, AIToolDef, AIToolResult, AIToolUse, AITurn } from './provider'
export { CLAUDE_MODEL } from './anthropic'
export { TOOLS, MAX_TOOL_ITERATIONS } from './tools'

// Provider seçimi (env):
//   AI_PROVIDER=mock       → MockProvider (API key'siz geliştirme/test)
//   AI_PROVIDER=anthropic  → AnthropicProvider (ANTHROPIC_API_KEY gerekir)
//   boş                    → key varsa anthropic; yoksa mock'a düş + console uyarısı

let cached: AIProvider | null = null

export function getAIProvider(): AIProvider {
  if (cached) return cached

  const requested = (process.env.AI_PROVIDER ?? '').toLowerCase()

  if (requested === 'mock') {
    cached = new MockProvider()
  } else if (requested === 'anthropic') {
    cached = new AnthropicProvider()
  } else {
    if (requested !== '') {
      console.warn(`[Reborn AI] Bilinmeyen AI_PROVIDER='${requested}' — mock|anthropic bekleniyor; otomatik seçime düşülüyor.`)
    }
    if (process.env.ANTHROPIC_API_KEY) {
      cached = new AnthropicProvider()
    } else {
      console.warn('[Reborn AI] ANTHROPIC_API_KEY yok — MockProvider\'a düşüldü. Gerçek AI için .env.local\'e key ekle veya AI_PROVIDER=mock ile bu uyarıyı sustur.')
      cached = new MockProvider()
    }
  }

  console.log(`[Reborn AI] Aktif provider: ${cached.name}`)
  return cached
}
