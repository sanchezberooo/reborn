// Chat bağlamı üreticisi (Faz 1 — hafıza döngüsünün kapanışı): kullanıcının
// son mesajı sorgu olarak hybridRetrieve'e verilir, dönen entity'ler system
// prompt'a girecek kompakt satırlara indirgenir. Route'tan ayrı dosyada
// yaşamasının nedeni: doğrulama testi (lib/memory-loop.test.ts) aynı
// fonksiyonu route'suz çağırarak "kaydedilen bilgi sonraki sohbetin
// bağlamına geri geliyor" döngüsünü uçtan uca ölçer.

import 'server-only'
import { hybridRetrieve } from './retrieval'
import { markRetrievalActive } from './retrieval-signal'
import type { RetrievedContextItem } from '../sanchez-prompt'

const RETRIEVE_LIMIT = 8
/** Arama kartından (160) daha cömert: prompt bağlamı yorum yapacak kadar metin ister. */
const SNIPPET_LENGTH = 280
/** ~2000 token bağlam bütçesi; Türkçe/karışık metinde ~4 karakter/token varsayımı. */
const CONTEXT_CHAR_BUDGET = 8000
/** Satır başına format yükü payı (madde imi, tip/tarih etiketi, ayraçlar). */
const LINE_OVERHEAD_CHARS = 24

function toSnippet(content: string | null): string | null {
  if (!content) return null
  const flat = content.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  return flat.length > SNIPPET_LENGTH ? `${flat.slice(0, SNIPPET_LENGTH)}…` : flat
}

/**
 * Sorguya göre ilgili hafızayı (entities) getirir; karakter bütçesini aşan
 * kuyruk atılır. Retrieval hatası sohbeti DÜŞÜRMEZ — boş bağlamla devam
 * edilir (embedding modeli inik/soğukken chat çalışmaya devam etmeli).
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
    const results = await hybridRetrieve(trimmed, { userId, limit: RETRIEVE_LIMIT })
    const items: RetrievedContextItem[] = []
    let used = 0
    for (const r of results) {
      const snippet = toSnippet(r.content)
      const cost = r.title.length + (snippet?.length ?? 0) + LINE_OVERHEAD_CHARS
      if (used + cost > CONTEXT_CHAR_BUDGET) break
      used += cost
      items.push({ type: r.type, title: r.title, snippet, createdAt: r.createdAt })
    }
    return items
  } catch (err) {
    console.error('[Reborn] chat retrieval hatası (bağlamsız devam):', err)
    return []
  }
}
