// Live State — organizmanın process-içi canlı projeksiyonu (Sprint 3,
// madde 10). Event bus'a '*' aboneliğiyle bağlanır ve olay akışından iki
// şey türetir: son olaylar penceresi (ring buffer) + process-ömürlü
// sayaçlar. Kalıcı veri DEĞİLDİR ve olmamalıdır — kalıcı iz runtime_events/
// agent_task_events tablolarındadır; burası Office ekranının (Sprint 4+)
// "şu an ne oluyor" sorusuna anlık cevap verecek hafızadır.
//
// Ajan/departman/worker durumları burada TUTULMAZ — onların doğruluk
// kaynağı kendi runtime sınıflarıdır (AgentRuntimeRegistry, DepartmentRuntime,
// Worker); manager.snapshot() hepsini tek fotoğrafta birleştirir. Çift
// kaynak bilinçli reddedildi.

import 'server-only'
import type { RuntimeEventBus } from './event-bus'
import type { RuntimeCounters, RuntimeEvent } from './types'

const RECENT_EVENTS_WINDOW = 100

export class LiveStateStore {
  private events: RuntimeEvent[] = []
  private counters = {
    tasksCompleted: 0,
    tasksFailed: 0,
    tasksRetried: 0,
    tasksTimedOut: 0,
    tasksDelegated: 0,
  }
  private unsubscribe: () => void

  constructor(private bus: RuntimeEventBus) {
    this.unsubscribe = bus.subscribe('*', (event) => this.apply(event))
  }

  private apply(event: RuntimeEvent): void {
    this.events.push(event)
    if (this.events.length > RECENT_EVENTS_WINDOW) {
      this.events.splice(0, this.events.length - RECENT_EVENTS_WINDOW)
    }
    switch (event.type) {
      case 'task_completed': this.counters.tasksCompleted++; break
      case 'task_failed': this.counters.tasksFailed++; break
      case 'task_retried': this.counters.tasksRetried++; break
      case 'task_timed_out': this.counters.tasksTimedOut++; break
      case 'task_delegated': this.counters.tasksDelegated++; break
      default: break
    }
  }

  recentEvents(limit = RECENT_EVENTS_WINDOW): RuntimeEvent[] {
    return this.events.slice(-limit).reverse()
  }

  countersSnapshot(): RuntimeCounters {
    const { published, persistFailures } = this.bus.stats
    return { published, persistFailures, ...this.counters }
  }

  /** Test izolasyonu / söküm — aboneliği bırakır. */
  dispose(): void {
    this.unsubscribe()
  }
}
