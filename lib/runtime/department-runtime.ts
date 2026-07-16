// Department Runtime — departmanların canlı hâli (Sprint 3, madde 4).
// Departman TANIMLARI lib/departments/registry.ts'te (izin modeli, misyon),
// ajan→departman ataması lib/agents/registry.ts'te yaşar; burası o statik
// sözleşmelerin üzerine yalnız RUNTIME davranışı koyar:
//  * Üye çözümü: departmanın deprecated olmayan roster üyeleri.
//  * İş dağıtımı: departman hattına düşen görev için uygun (paused/dolu
//    olmayan) ajanı seçmek — v1'de her departman tek ajanlıdır, seçim
//    çoğunlukla tekildir; roster büyüdüğünde bu fonksiyon değişmeden
//    çok-üyeli seçime ölçeklenir.
//  * Aktivasyon defteri: departmanda iş akmaya başlayınca
//    department_activated, kuyruk boşalınca department_deactivated.

import 'server-only'
import type { AgentDefinition } from '../agents/types'
import { listAgents } from '../agents/registry'
import { getDepartment } from '../departments/registry'
import type { DepartmentId } from '../departments/types'
import { DEPARTMENT_IDS } from '../departments/types'
import type { AgentRuntimeRegistry } from './agent-runtime'
import type { RuntimeEventBus } from './event-bus'
import type { DepartmentRuntimeInfo } from './types'

export class DepartmentRuntime {
  private activations = new Map<string, { activatedAt: string }>()

  constructor(
    private bus: RuntimeEventBus,
    private agentRuntime: AgentRuntimeRegistry,
  ) {}

  /** Departmanın çalışan roster üyeleri (deprecated hariç). */
  members(departmentId: string): AgentDefinition[] {
    if (!getDepartment(departmentId)) return []
    return listAgents({ department: departmentId as DepartmentId })
  }

  /**
   * Görev dağıtımı: departmanın üyelerinden şu an iş alabilecek (paused ve
   * uçuşta olmayan) ilk ajanı döndürür; idle olan tercih edilir. Uygun ajan
   * yoksa null — görev kuyrukta bekler, worker sonraki tick'te yeniden dener.
   */
  pickAgent(departmentId: string): AgentDefinition | null {
    const available = this.members(departmentId)
      .filter((agent) => this.agentRuntime.isAvailable(agent.name))
    if (available.length === 0) return null
    const idle = available.find((agent) => this.agentRuntime.get(agent.name).state === 'idle')
    return idle ?? available[0]
  }

  /** İlk iş dağıtımında departmanı aktive eder (idempotent). */
  async markActive(departmentId: string, userId?: string): Promise<void> {
    if (this.activations.has(departmentId)) return
    this.activations.set(departmentId, { activatedAt: new Date().toISOString() })
    await this.bus.publish({ type: 'department_activated', department: departmentId, userId })
  }

  /** Kuyruk boşalınca (açık görev kalmadı, üye uçuşta değil) deaktive eder. */
  async markDrained(departmentId: string, userId?: string): Promise<void> {
    if (!this.activations.has(departmentId)) return
    const busy = this.members(departmentId).some((agent) => {
      const state = this.agentRuntime.get(agent.name).state
      return state === 'thinking' || state === 'working'
    })
    if (busy) return
    this.activations.delete(departmentId)
    await this.bus.publish({ type: 'department_deactivated', department: departmentId, userId })
  }

  isActive(departmentId: string): boolean {
    return this.activations.has(departmentId)
  }

  /** Tüm gerçek departmanların (legacy dahil — tarihsel raf da görünür)
   *  runtime bilgisi; kuyruk derinliği DB gerektirdiğinden manager ekler. */
  snapshot(): Record<string, DepartmentRuntimeInfo> {
    const out: Record<string, DepartmentRuntimeInfo> = {}
    for (const id of DEPARTMENT_IDS) {
      const activation = this.activations.get(id) ?? null
      out[id] = {
        departmentId: id,
        active: activation !== null,
        activatedAt: activation?.activatedAt ?? null,
        agents: this.members(id).map((a) => a.name),
      }
    }
    return out
  }
}
