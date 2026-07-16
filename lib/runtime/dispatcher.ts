// Task Dispatcher — çalıştırılabilir görevi doğru departmana yönlendirir ve
// doğru ajana bağlar (Sprint 3, madde 2). Kuyruk taraması repository'de
// (listRunnableTasks), claim worker'dadır; dispatcher YALNIZ karar verir —
// hiçbir durumu değiştirmez (yan etkisiz, testlenebilir).
//
// Karar sırası (repository.assignTask'ın departman tutarlılık kuralıyla
// uyumlu — iş emri bir departmanın hattından başka departmanın ajanına
// sızamaz):
//  1. owner_agent doluysa o ajan esas alınır (registry + deprecated + izin
//     kontrolü); ajan müsait değilse görev KUYRUKTA BEKLER (transient).
//  2. Yalnız department doluysa DepartmentRuntime uygun üyeyi seçer.
//  3. İkisi de boşsa görev yönlendirilemez (permanent) — Sanchez/insan
//     iş emrini departman veya ajan belirterek açmak zorundadır.
//
// permanent=true kalıcı hatadır (retry çözmez → görev failed'a düşürülür ve
// retry engine ÇAĞRILMAZ); permanent=false geçici durumdur (ajan dolu/paused
// → görev kuyrukta kalır, sonraki tick yeniden dener).

import 'server-only'
import type { AgentDefinition } from '../agents/types'
import { getAgent } from '../agents/registry'
import { getDepartment } from '../departments/registry'
import type { AgentTask } from '../tasks/types'
import type { AgentRuntimeRegistry } from './agent-runtime'
import type { DepartmentRuntime } from './department-runtime'

export type DispatchResolution =
  | { ok: true; agent: AgentDefinition }
  | { ok: false; reason: string; permanent: boolean }

export class TaskDispatcher {
  constructor(
    private agentRuntime: AgentRuntimeRegistry,
    private departmentRuntime: DepartmentRuntime,
  ) {}

  resolve(task: AgentTask): DispatchResolution {
    if (task.ownerAgent) {
      const agent = getAgent(task.ownerAgent)
      if (!agent) {
        return { ok: false, permanent: true, reason: `'${task.ownerAgent}' registry'de kayıtlı bir ajan değil.` }
      }
      if (agent.deprecated) {
        return { ok: false, permanent: true, reason: `'${task.ownerAgent}' emekli (deprecated) — yeni iş alamaz.` }
      }
      if (task.department && agent.department && task.department !== agent.department) {
        return {
          ok: false,
          permanent: true,
          reason: `görev '${task.department}' hattında, '${agent.name}' ise '${agent.department}' — departmanlar uyuşmalı.`,
        }
      }
      if (!this.agentRuntime.isAvailable(agent.name)) {
        return { ok: false, permanent: false, reason: `'${agent.name}' şu an müsait değil (paused/uçuşta).` }
      }
      return { ok: true, agent }
    }

    if (task.department) {
      const department = getDepartment(task.department)
      if (!department) {
        return { ok: false, permanent: true, reason: `'${task.department}' tanımlı bir departman değil.` }
      }
      if (department.id === 'legacy') {
        return { ok: false, permanent: true, reason: `'legacy' rafı iş almaz — görev gerçek bir departmana açılmalı.` }
      }
      const members = this.departmentRuntime.members(department.id)
      if (members.length === 0) {
        return { ok: false, permanent: true, reason: `${department.displayName} departmanının çalışan üyesi yok.` }
      }
      const agent = this.departmentRuntime.pickAgent(department.id)
      if (!agent) {
        return { ok: false, permanent: false, reason: `${department.displayName} departmanında şu an müsait ajan yok.` }
      }
      return { ok: true, agent }
    }

    return {
      ok: false,
      permanent: true,
      reason: 'görevin ne owner_agent ne department alanı dolu — yönlendirilemez.',
    }
  }
}
