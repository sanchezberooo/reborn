// Chat bağlamı üreticisi — Sprint 4'ten itibaren İNCE bir delegasyon katmanı:
// bağlamın gerçek üretimi Context Engine'dedir (lib/brain/context-engine.ts,
// "Sanchez'e verilecek context tek yerden" ilkesi). Bu dosyanın kalma nedeni
// sözleşme sürekliliğidir: çağıranlar (lib/sanchez/core.ts retrieve aşaması,
// lib/memory-loop.test.ts doğrulama testi) RetrievedContextItem şeklini ve
// "hata bağlamsız devam eder" garantisini değişmeden almaya devam eder.
//
// DAVRANIŞ SÖZLEŞMESİ (Sprint 4 öncesiyle birebir): kaynak profili
// SANCHEZ_CHAT_SOURCES = yalnız hafıza kaynağı (hibrit retrieval, scope'suz),
// kaynak limiti 8, snippet 280, ~8000 karakter bütçe — sabitlerin sahibi
// artık context-engine'dir. Yeni kaynakları (görev/hedef/timeline) chat'e
// açmak FAZ AI kalibrasyon kararıdır; motor hazır, karar burada verilmez.

import 'server-only'
import { markRetrievalActive } from './retrieval-signal'
import type { RetrievedContextItem } from '../sanchez-prompt'

/**
 * Sorguya göre ilgili bağlamı Context Engine'den getirir. Retrieval hatası
 * sohbeti DÜŞÜRMEZ — boş bağlamla devam edilir (embedding modeli inik/
 * soğukken chat çalışmaya devam etmeli).
 */
export async function buildChatContext(
  query: string,
  userId: string,
): Promise<RetrievedContextItem[]> {
  const trimmed = query.trim()
  if (!trimmed || !userId) return []

  try {
    // Ofis Brain küresi için aktivite sinyali — retrieval başlarken işaretlenir
    // (embedding hatası sohbeti düşürmediği gibi sinyali de düşürmemeli).
    markRetrievalActive()
    const { buildContext, SANCHEZ_CHAT_SOURCES } = await import('../brain/context-engine')
    const items = await buildContext({ query: trimmed, userId }, { sources: SANCHEZ_CHAT_SOURCES })
    return items.map((item) => ({
      type: item.type,
      title: item.title,
      snippet: item.snippet,
      createdAt: item.createdAt,
    }))
  } catch (err) {
    console.error('[Reborn] chat retrieval hatası (bağlamsız devam):', err)
    return []
  }
}
