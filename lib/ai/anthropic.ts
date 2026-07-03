import Anthropic from '@anthropic-ai/sdk'
import type {
  BetaMessage,
  BetaMessageParam,
  BetaTool,
  BetaToolUnion,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type {
  AIMessage,
  AIProvider,
  AIProviderCapabilities,
  AIRequest,
  AIStreamEvent,
  AIToolDef,
  AITurn,
} from './provider'

// Sanchez'in ana modeli. Sonnet sınıfı: ~$3/M girdi + ~$15/M çıktı token.
// Tipik bir Sanchez mesajı (sistem promptu ~3-4K + geçmiş + araç tanımları
// ~2K girdi, ~300-800 çıktı token) yaklaşık $0.02-0.05/mesaj eder; araç
// zincirleri (web search, run_agent) her turda girdiyi tekrar gönderdiği
// için bunu 2-4 katına çıkarabilir. Ucuz/basit ajan işleri için registry'de
// model: 'claude-haiku-4-5' override'ı kullan (~12 kat daha ucuz).
export const CLAUDE_MODEL = 'claude-sonnet-4-6'

const WEB_SEARCH_BETA = 'web-search-2025-03-05'

// Built-in web search — Anthropic sunucuları tarafından işlenir; custom tool
// döngüsüne girmez (sonuçları aynı turun içinde gelir).
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
} as unknown as BetaToolUnion

function toBetaMessages(messages: AIMessage[]): BetaMessageParam[] {
  return messages.map((m): BetaMessageParam => {
    if (m.role === 'tool_results') {
      return {
        role: 'user',
        content: m.results.map((r) => ({
          type: 'tool_result' as const,
          tool_use_id: r.toolUseId,
          content: r.content,
          ...(r.isError ? { is_error: true } : {}),
        })),
      }
    }
    if (m.role === 'assistant' && m.raw) {
      // Ham content blokları (tool_use / server_tool_use dahil) kayıpsız geri verilir
      return { role: 'assistant', content: m.raw as BetaMessageParam['content'] }
    }
    return { role: m.role, content: m.content }
  })
}

function toBetaTools(tools: AIToolDef[] | undefined, webSearch: boolean): BetaToolUnion[] {
  const custom: BetaToolUnion[] = (tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as BetaTool['input_schema'],
  }))
  return webSearch ? [...custom, WEB_SEARCH_TOOL] : custom
}

function toTurn(response: BetaMessage): AITurn {
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const toolUses = response.content
    .filter((b): b is BetaToolUseBlock => b.type === 'tool_use')
    .map((tu) => ({ id: tu.id, name: tu.name, input: tu.input as Record<string, unknown> }))

  const stopReason: AITurn['stopReason'] =
    response.stop_reason === 'tool_use'   ? 'tool_use'
    : response.stop_reason === 'max_tokens' ? 'max_tokens'
    : 'end_turn'

  return { stopReason, text, toolUses, raw: response.content }
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic'
  readonly capabilities: AIProviderCapabilities = { webSearch: true, embeddings: false }

  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  private params(req: AIRequest) {
    return {
      model: req.model ?? CLAUDE_MODEL,
      system: req.system,
      messages: toBetaMessages(req.messages),
      tools: toBetaTools(req.tools, Boolean(req.webSearch)),
      max_tokens: req.maxTokens ?? 4096,
      ...(req.webSearch ? { betas: [WEB_SEARCH_BETA] } : {}),
    }
  }

  async complete(req: AIRequest): Promise<AITurn> {
    const response = await this.client.beta.messages.create(this.params(req))
    return toTurn(response)
  }

  async *stream(req: AIRequest): AsyncIterable<AIStreamEvent> {
    const stream = this.client.beta.messages.stream(this.params(req))

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block
        if (block.type === 'tool_use' || block.type === 'server_tool_use') {
          yield { type: 'tool_start', name: block.name }
        }
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text }
      }
    }

    yield { type: 'done', turn: toTurn(await stream.finalMessage()) }
  }

  async embed(): Promise<number[][]> {
    throw new Error('AnthropicProvider.embed: desteklenmiyor — embedding LocalEmbeddingProvider ile yapılır (Faz 1).')
  }
}
