// Agent Runtime — her ajanın yaşam döngüsü durum makinesi (Sprint 3, madde 3).
// Görev durum makinesinin (lib/tasks) AJAN tarafı: görev iş emrinin hâlidir,
// bu ise çalışanın. Durumlar ve izinli geçişler lib/runtime/types.ts
// AGENT_STATE_TRANSITIONS tablosundadır — tablo dışı geçiş FIRLATIR
// (repository.transitionTask ile aynı disiplin).
//
// DURUM PROCESS-İÇİ HAFIZADADIR (bilinçli): süreç yeniden başlarsa herkes
// idle'dan başlar; kalıcı/paylaşımlı ajan durumu multi-worker gününün işidir
// ve o gün bu sınıfın arkasına bir store konarak çözülür — arayüz değişmez.
// Kalıcı iz zaten var: her gerçek geçiş event bus'a agent_state_changed
// olarak basılır (runtime_events append-only).

import 'server-only'
import type { RuntimeEventBus } from './event-bus'
import type { AgentRuntimeInfo, AgentRuntimeState } from './types'
import { ACTIVE_AGENT_STATES, AGENT_STATE_TRANSITIONS } from './types'

export interface AgentTransitionOptions {
  taskId?: string | null
  error?: string
  userId?: string
  detail?: Record<string, unknown>
}

export class AgentRuntimeRegistry {
  private agents = new Map<string, AgentRuntimeInfo>()

  constructor(private bus: RuntimeEventBus) {}

  /** Ajanın anlık bilgisi — bilinmeyen ajan idle olarak doğar (roster
   *  doğrulaması dispatcher'ın işidir; burası yalnız durum defteridir). */
  get(agentName: string): AgentRuntimeInfo {
    const existing = this.agents.get(agentName)
    if (existing) return existing
    const fresh: AgentRuntimeInfo = {
      agentName,
      state: 'idle',
      currentTaskId: null,
      since: new Date().toISOString(),
      lastError: null,
      pauseRequested: false,
    }
    this.agents.set(agentName, fresh)
    return fresh
  }

  /** Ajan yeni iş alabilir mi: paused değil, çalışma uçuşta değil. */
  isAvailable(agentName: string): boolean {
    const info = this.get(agentName)
    return info.state !== 'paused'
      && !info.pauseRequested
      && !(ACTIVE_AGENT_STATES as readonly string[]).includes(info.state)
  }

  /**
   * Durum geçişi — AGENT_STATE_TRANSITIONS dışı geçiş fırlatır; aynı duruma
   * geçiş sessiz no-op'tur (derived durum oturtma her tick koşar, olay
   * gürültüsü üretmemeli). Her gerçek geçiş agent_state_changed yayınlar.
   */
  async transition(
    agentName: string,
    to: AgentRuntimeState,
    opts: AgentTransitionOptions = {},
  ): Promise<AgentRuntimeInfo> {
    const info = this.get(agentName)
    if (info.state === to) return info

    if (!AGENT_STATE_TRANSITIONS[info.state].includes(to)) {
      throw new Error(
        `AgentRuntime: '${agentName}' için '${info.state}' → '${to}' geçişi izinli değil ` +
        `(izinli: ${AGENT_STATE_TRANSITIONS[info.state].join(', ') || 'yok'}).`,
      )
    }

    const from = info.state
    info.state = to
    info.since = new Date().toISOString()
    if (opts.taskId !== undefined) info.currentTaskId = opts.taskId
    if (to === 'idle' || to === 'waiting' || to === 'blocked' || to === 'paused') {
      info.currentTaskId = null
    }
    if (opts.error !== undefined) info.lastError = opts.error
    if (to === 'paused') info.pauseRequested = false

    await this.bus.publish({
      type: 'agent_state_changed',
      agentName,
      taskId: info.currentTaskId ?? opts.taskId ?? undefined,
      userId: opts.userId,
      detail: { from, to, ...(opts.error ? { error: opts.error } : {}), ...opts.detail },
    })
    return info
  }

  /**
   * Pause isteği: ajan boştaysa (idle/waiting/blocked/completed/failed)
   * anında paused'a geçer; çalışma uçuştaysa bayraklanır — worker iş bitince
   * settle aşamasında paused'a oturtur. Zorla kesme YOKTUR: uçuştaki LLM
   * çalıştırması yarıda kesilmez (yarım iş = tutarsız iz).
   */
  async requestPause(agentName: string, userId?: string): Promise<AgentRuntimeInfo> {
    const info = this.get(agentName)
    if (info.state === 'paused') return info
    if ((ACTIVE_AGENT_STATES as readonly string[]).includes(info.state)) {
      info.pauseRequested = true
      return info
    }
    return this.transition(agentName, 'paused', { userId, detail: { reason: 'insan isteği' } })
  }

  /** paused → idle; bekleyen pause bayrağı da temizlenir. */
  async resume(agentName: string, userId?: string): Promise<AgentRuntimeInfo> {
    const info = this.get(agentName)
    info.pauseRequested = false
    if (info.state !== 'paused') return info
    return this.transition(agentName, 'idle', { userId, detail: { reason: 'insan isteği' } })
  }

  snapshot(): Record<string, AgentRuntimeInfo> {
    const out: Record<string, AgentRuntimeInfo> = {}
    for (const [name, info] of this.agents) out[name] = { ...info }
    return out
  }
}
