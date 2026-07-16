// Sanchez Core tip sözlüğü — merkez orkestrasyon katmanının sözleşmesi
// (Sprint 2, madde 1). Yalnız tip + sabit; runtime bağımlılığı yok.
// Orkestrasyonun kendisi lib/sanchez/core.ts'tedir (server-only).

import type { ModuleItem } from '../modules'
import type { ChatEvent } from '../chat-events'

/**
 * Sanchez'in tek turluk düşünce hattı. Aşamalar mimari sözlüktür — her tur
 * bu sırayla akar; hangi aşamanın nerede yaşadığı core.ts'te aşama aşama
 * işaretlidir. İki karakterde aşama vardır:
 *  * DETERMİNİSTİK (kod karar verir): observe, understand, retrieve.
 *  * MODEL-GÜDÜMLÜ (model tool çağrısıyla karar verir, kod yürütür ve
 *    sınırlar): reason, plan, delegate (run_agent), execute (tool yürütme),
 *    learn (save_memory), brain-update (köprü entity + embedding yazımı —
 *    lib/db-server). Konuşmadan OTOMATİK çıkarım (modelin kararı olmadan
 *    hafıza yazımı) bilinçli olarak YOKTUR — roadmap bunu FAZ AI'ya koyar;
 *    kancası executeToolCalls'tadır, davranışı o fazda bağlanır.
 */
export const SANCHEZ_PIPELINE_STAGES = [
  'observe',      // durum toplama: profil, onboarding, konuşma geçmişi
  'understand',   // niyet damıtma: son kullanıcı mesajı → retrieval sorgusu
  'retrieve',     // hibrit hafıza getirimi (semantik + link grafı + recency)
  'reason',       // model turu: system prompt + akış (token streaming)
  'plan',         // modelin tool seçimi (tek turda birden çok olabilir)
  'delegate',     // MAXAİ'ye dağıtım — run_agent tool'u
  'execute',      // tool yürütme (serverExecuteTool) + sonuçların modele dönüşü
  'learn',        // model-güdümlü hafıza yazımı — save_memory / save_goal
  'brain-update', // köprü entity + embedding senkronu (lib/db-server içinde)
] as const
export type SanchezPipelineStage = (typeof SANCHEZ_PIPELINE_STAGES)[number]

/** /api/chat isteğinin gövdesi — HTTP zarfı route'ta, anlamı burada. */
export interface SanchezTurnRequest {
  messages: { role: 'user' | 'assistant'; content: string }[]
  lastConversation?: { role: string; content: string }[]
  activeModule?: ModuleItem
}

/** Turun dışa akan olay kanalı — NDJSON protokolünün (lib/chat-events.ts)
 *  taşıyıcıdan bağımsız hali: core HTTP/stream bilmez, yalnız olay basar.
 *  Bu ayrım streaming protokolünü provider VE taşıyıcı değişimlerine karşı
 *  korur (protokol sözleşmesi: text | tool_start | tool_end | done | error). */
export type SanchezEventSink = (event: ChatEvent) => void
