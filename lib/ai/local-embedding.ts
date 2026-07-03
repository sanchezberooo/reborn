import type { AIProvider, AIProviderCapabilities, AIStreamEvent, AITurn } from './provider'

// LocalEmbeddingProvider — Faz 1 iskeleti. Çok dilli açık bir modelle (bge-m3
// veya eşdeğeri; Türkçe kritik) lokal, ücretsiz embedding üretecek. Hafıza
// mimarisinin (semantik arama + link grafı) temelidir; üretken yeteneği YOKTUR.

export class LocalEmbeddingProvider implements AIProvider {
  readonly name = 'local-embedding'
  readonly capabilities: AIProviderCapabilities = { webSearch: false, embeddings: true }

  async complete(): Promise<AITurn> {
    throw new Error('LocalEmbeddingProvider.complete: desteklenmiyor — bu provider yalnızca embedding içindir.')
  }

  async *stream(): AsyncIterable<AIStreamEvent> {
    throw new Error('LocalEmbeddingProvider.stream: desteklenmiyor — bu provider yalnızca embedding içindir.')
  }

  async embed(): Promise<number[][]> {
    throw new Error('LocalEmbeddingProvider.embed: henüz implemente edilmedi — Faz 1\'de bge-m3 ile doldurulacak.')
  }
}
