// Runtime Event Bus — organizmanın olay omurgası (Sprint 3, madde 8).
// İki işi vardır ve ikisi de her publish'te olur:
//  1. Process-içi aboneleri bilgilendirir (Live State, gelecekte tetikleyiciler).
//  2. Olayı migration 0009 runtime_events tablosuna APPEND eder (iz silinmez).
//
// DAYANIKLILIK KARARI: DB append hatası organizmayı DÜŞÜRMEZ — olay günlüğü
// gözlem izidir, kontrol akışı değildir; hata console'a yazılır ve
// persistFailures sayacına işlenir (Live State'te görünür). Kontrol akışının
// doğruluk kaynağı görev durum makinesi (agent_task_events) olarak kalır.
//
// Abone hataları da publish'i düşürmez: her handler kendi try/catch'inde
// koşar — kötü bir abone diğer abonelerin olayı görmesini engelleyemez.

import 'server-only'
import type { RuntimeEvent, RuntimeEventInput, RuntimeEventType } from './types'

export type RuntimeEventHandler = (event: RuntimeEvent) => void

/** '*' — tüm olay tiplerine abonelik (Live State bunu kullanır). */
export type RuntimeEventFilter = RuntimeEventType | '*'

export class RuntimeEventBus {
  private handlers = new Map<RuntimeEventFilter, Set<RuntimeEventHandler>>()
  private publishedCount = 0
  private persistFailureCount = 0

  /** Abonelik — dönen fonksiyon aboneliği söker (integrations subscribe deseni). */
  subscribe(filter: RuntimeEventFilter, handler: RuntimeEventHandler): () => void {
    const set = this.handlers.get(filter) ?? new Set()
    set.add(handler)
    this.handlers.set(filter, set)
    return () => {
      set.delete(handler)
    }
  }

  /** Olay yayını: damgala → aboneleri bilgilendir → DB'ye append et.
   *  DB yazımı await edilir ki çağıran (worker/executor) bittiğinde iz
   *  garantili yazılmış olsun; hata yutulur (üst not). */
  async publish(input: RuntimeEventInput): Promise<RuntimeEvent> {
    const event: RuntimeEvent = { ...input, createdAt: new Date().toISOString() }
    this.publishedCount++

    for (const filter of [event.type, '*'] as const) {
      for (const handler of this.handlers.get(filter) ?? []) {
        try {
          handler(event)
        } catch (err) {
          console.error(`[Reborn Runtime] event handler hatası (${event.type}):`, err)
        }
      }
    }

    try {
      const { getSupabaseAdmin } = await import('../supabase-admin')
      const { error } = await getSupabaseAdmin().from('runtime_events').insert({
        event: event.type,
        task_id: event.taskId ?? null,
        agent_name: event.agentName ?? null,
        department: event.department ?? null,
        worker_id: event.workerId ?? null,
        user_id: event.userId ?? null,
        detail: event.detail ?? null,
        created_at: event.createdAt,
      })
      if (error) throw error
    } catch (err) {
      this.persistFailureCount++
      console.error(`[Reborn Runtime] runtime_events append hatası (${event.type}):`, err)
    }

    return event
  }

  get stats(): { published: number; persistFailures: number } {
    return { published: this.publishedCount, persistFailures: this.persistFailureCount }
  }
}
