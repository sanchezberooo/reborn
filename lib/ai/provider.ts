// AIProvider soyutlaması — Reborn'daki TÜM LLM çağrıları bu interface üzerinden
// geçer (roadmap "Kalıcı Teknik Kararlar" + denetim raporu §4.2). Yeni doğrudan
// SDK çağrısı ekleme; provider seçimi lib/ai/index.ts'te env ile yapılır.
//
// Tasarım kararı: chat route'undaki tool-use döngüsü ROUTE'ta kalır; provider
// yalnızca TEK model turunu soyutlar (bir istek → text + tool istekleri).
// AIStreamEvent, lib/chat-events.ts ChatEvent'ine bilinçli benzerlikte tutuldu —
// route olayları neredeyse birebir çevirir, istemci protokolü hiç etkilenmez.

// ─── Mesaj tipleri ──────────────────────────────────────────────────────────

/** Bir tool çağrısının sonucu — döngüde modele geri beslenir. */
export interface AIToolResult {
  toolUseId: string
  content: string
  isError?: boolean
}

export type AIMessage =
  | { role: 'user'; content: string }
  /**
   * Asistan turu. `raw`, provider'ın kendi ham içerik bloklarıdır (örn. Anthropic
   * content dizisi — server_tool_use blokları dahil); tool döngüsünde geçmişe
   * kayıpsız geri verilebilsin diye taşınır. Provider dışında yorumlanmaz.
   */
  | { role: 'assistant'; content: string; raw?: unknown }
  /** Tool sonuçları turu — provider bunu kendi formatına çevirir. */
  | { role: 'tool_results'; results: AIToolResult[] }

// ─── Tool tanımı (provider-bağımsız) ────────────────────────────────────────

export interface AIToolDef {
  name: string
  description: string
  /** JSON Schema (draft-07 alt kümesi) — Anthropic input_schema ile aynı yapı. */
  inputSchema: Record<string, unknown>
}

// ─── Tek model turunun sonucu ───────────────────────────────────────────────

export interface AIToolUse {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface AITurn {
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens'
  /** Bu turda üretilen düz metin (tüm text bloklarının birleşimi). */
  text: string
  /** stopReason 'tool_use' ise çalıştırılması istenen tool'lar. */
  toolUses: AIToolUse[]
  /** Provider'ın ham assistant içeriği — AIMessage.raw olarak geçmişe geri konur. */
  raw?: unknown
}

// ─── Streaming olayları ─────────────────────────────────────────────────────

// ChatEvent (lib/chat-events.ts) ile bilinçli benzerlik: text / tool_start
// birebir çevrilir; 'done' turun sonucunu taşır (tool_end/error route'un işi —
// tool'ları route çalıştırır, hataları route yakalar).
export type AIStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; name: string }
  | { type: 'done'; turn: AITurn }

// ─── İstek ve interface ─────────────────────────────────────────────────────

export interface AIRequest {
  /** Model override (örn. registry'deki 'claude-haiku-4-5') — verilmezse provider varsayılanı. */
  model?: string
  system: string
  messages: AIMessage[]
  tools?: AIToolDef[]
  maxTokens?: number
  /** Sunucu taraflı web araması (provider destekliyorsa — bkz. capabilities). */
  webSearch?: boolean
}

export interface AIProviderCapabilities {
  webSearch?: boolean
  embeddings?: boolean
}

export interface AIProvider {
  readonly name: string
  readonly capabilities: AIProviderCapabilities

  /** Non-streaming tek tur (ajanlar, özetleme). */
  complete(req: AIRequest): Promise<AITurn>

  /** Streaming tek tur — token akışı + tool başlangıçları, sonda 'done' + AITurn. */
  stream(req: AIRequest): AsyncIterable<AIStreamEvent>

  /** Metin(ler) için embedding vektörleri (Faz 1 — LocalEmbeddingProvider). */
  embed(texts: string[]): Promise<number[][]>
}
