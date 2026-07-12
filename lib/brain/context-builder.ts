// Knowledge Agent context builder — Foundation-seviyesi MİNİMAL bağlam
// toplama (§9): yalnız bekleyen sinyaller, basit metin listesi. İlişki
// keşfi, çapraz-departman genişletmesi, geçmiş tarama YOK — Cognitive
// Layer'ın 4 katmanlı versiyonu bu fazın kapsamı DIŞINDA. Üretilen liste
// runner tarafından buildKnowledgeAgentPrompt'un dinamik katmanına bağlanır.

import 'server-only'
import { getNodesByType } from './query'

const DEFAULT_LIMIT = 10

/** Bekleyen sinyal taramasında çekilen pencere: getNodesByType status
 *  filtrelemez ve yeniden-eskiye sıralar (query.ts'e DOKUNULMAZ, §9);
 *  status='gözlemlenen' süzmesi ve eskiden-yeniye çevirme burada yapılır.
 *  executor'daki brain_read_signals ile aynı kabul edilmiş sınır: bekleyen
 *  sinyal sayısı pencereyi aşarsa en eskiler dışarıda kalabilir. */
const SIGNAL_SCAN_WINDOW = 100

const CONTENT_SNIPPET_MAX = 300

export interface KnowledgeAgentContextOptions {
  /** Test izolasyonu için; verilmezse kullanıcı filtrelenmez
   *  (tek kullanıcılı fazda tüm sinyaller zaten tek kimliğin altında). */
  userId?: string
}

/**
 * En fazla `limit` bekleyen sinyali (status='gözlemlenen', en eskiden
 * yeniye) basit metin listesi olarak döner; bekleyen sinyal yoksa boş
 * string — prompt statik katmanıyla kalır, ajan sinyalleri
 * brain_read_signals ile kendisi de çekebilir.
 */
export async function buildKnowledgeAgentContext(
  limit: number = DEFAULT_LIMIT,
  opts?: KnowledgeAgentContextOptions,
): Promise<string> {
  const hot = await getNodesByType('signal', 'hot', {
    userId: opts?.userId,
    limit: SIGNAL_SCAN_WINDOW,
  })
  const pending = hot
    .filter((n) => n.status === 'gözlemlenen')
    .reverse() // en eskiden yeniye — brain_read_signals sözleşmesiyle aynı sıra
    .slice(0, Math.max(1, limit))

  if (pending.length === 0) return ''

  return pending
    .map((n, i) => {
      const flat = (n.content ?? '').replace(/\s+/g, ' ').trim()
      const snippet =
        flat.length > CONTENT_SNIPPET_MAX ? `${flat.slice(0, CONTENT_SNIPPET_MAX)}…` : flat
      return `${i + 1}. [signalId: ${n.id}] (${n.createdAt.slice(0, 10)}) ${n.title}${
        snippet ? `\n   ${snippet}` : ''
      }`
    })
    .join('\n')
}
