import { describe, expect, it } from 'vitest'

// Company Registry sözleşme testi (Sprint 7) — üç şeyi korur:
// 1. Organizasyon bütünlüğü: 13 departman, her departmanda TAM BİR head,
//    koltuk id'leri benzersiz, konsey = 13 head.
// 2. Runtime köprüsü: runtimeDepartmentId/runtimeAgentName değerleri gerçek
//    registry'lere işaret eder; runtime-bağlı koltukların capabilities
//    kopyası ajanın FİİLİ yetenekleriyle birebir aynıdır (kopya sürüklenirse
//    burada kırmızıya düşer — lib/company/registry.ts başındaki karar).
// 3. Intelligence/BI sözleşmesi: kategori id'leri benzersiz, brain-kaynaklı
//    her kategori nodeTypes taşır, registry sayımları gerçek veriden gelir.

import { AGENTS } from '../agents/registry'
import { agentCapabilities } from '../departments/registry'
import { DEPARTMENT_IDS } from '../departments/types'
import {
  INTELLIGENCE_CATEGORIES,
  registryCounts,
  resolveCategoryCounts,
} from './intelligence'
import {
  BUSINESSES,
  COMPANY_AGENTS,
  COMPANY_DEPARTMENTS,
  EXECUTIVE_COUNCIL,
  findSeatByRuntimeAgent,
  getCompanyDepartment,
  getHeadAgent,
  listCompanyAgents,
  listCompanyDepartments,
} from './registry'
import { COMPANY_DEPARTMENT_IDS } from './types'

describe('company registry — organizasyon bütünlüğü', () => {
  it('13 departman kayıtlı ve id alanları tutarlı', () => {
    expect(COMPANY_DEPARTMENT_IDS).toHaveLength(13)
    for (const id of COMPANY_DEPARTMENT_IDS) {
      const department = getCompanyDepartment(id)
      expect(department).not.toBeNull()
      expect(department!.id).toBe(id)
      expect(department!.shortName.length).toBeGreaterThan(0)
    }
    expect(listCompanyDepartments()).toHaveLength(13)
    expect(getCompanyDepartment('olmayan')).toBeNull()
  })

  it('her departmanda tam bir head vardır; koltuk id/departman alanları tutarlı', () => {
    const ids = new Set<string>()
    for (const agent of COMPANY_AGENTS) {
      expect(ids.has(agent.id), `çift koltuk id: ${agent.id}`).toBe(false)
      ids.add(agent.id)
      expect(COMPANY_DEPARTMENT_IDS).toContain(agent.departmentId)
    }
    for (const id of COMPANY_DEPARTMENT_IDS) {
      const heads = listCompanyAgents({ departmentId: id, role: 'head' })
      expect(heads, `${id} head sayısı`).toHaveLength(1)
      expect(getHeadAgent(id).id).toBe(heads[0].id)
      // Spec: Department → Head → Worker; head'siz/işçisiz oda olmasın.
      expect(listCompanyAgents({ departmentId: id, role: 'worker' }).length).toBeGreaterThan(0)
    }
  })

  it('Executive Council 13 head koltuğunu departman sırasında temsil eder', () => {
    expect(EXECUTIVE_COUNCIL.chair.id).toBe('sanchez')
    expect(EXECUTIVE_COUNCIL.memberAgentIds).toEqual(
      COMPANY_DEPARTMENT_IDS.map((id) => getHeadAgent(id).id),
    )
  })
})

describe('company registry — runtime köprüsü', () => {
  it('runtimeDepartmentId değerleri geçerli ve benzersizdir', () => {
    const seen = new Set<string>()
    for (const department of Object.values(COMPANY_DEPARTMENTS)) {
      if (!department.runtimeDepartmentId) continue
      expect(DEPARTMENT_IDS).toContain(department.runtimeDepartmentId)
      expect(seen.has(department.runtimeDepartmentId), `çift runtime köprüsü: ${department.runtimeDepartmentId}`).toBe(false)
      seen.add(department.runtimeDepartmentId)
    }
    // 6 canlı departmanın tamamı (legacy hariç) şirkette temsil edilir.
    expect([...seen].sort()).toEqual(
      DEPARTMENT_IDS.filter((id) => id !== 'legacy').sort(),
    )
  })

  it('runtimeAgentName gerçek ajana işaret eder ve departman köprüsüyle tutarlıdır', () => {
    const seen = new Set<string>()
    for (const seatDef of COMPANY_AGENTS) {
      if (!seatDef.runtimeAgentName) continue
      const runtime = AGENTS[seatDef.runtimeAgentName]
      expect(runtime, `${seatDef.id}: '${seatDef.runtimeAgentName}' registry'de yok`).toBeDefined()
      expect(runtime.deprecated ?? false).toBe(false)
      expect(runtime.department).toBe(COMPANY_DEPARTMENTS[seatDef.departmentId].runtimeDepartmentId)
      expect(seen.has(seatDef.runtimeAgentName), `çift runtime ajanı: ${seatDef.runtimeAgentName}`).toBe(false)
      seen.add(seatDef.runtimeAgentName)
      expect(findSeatByRuntimeAgent(seatDef.runtimeAgentName)?.id).toBe(seatDef.id)
    }
  })

  it('runtime-bağlı koltukların capabilities kopyası ajanın fiili yetenekleriyle birebir aynı', () => {
    for (const seatDef of COMPANY_AGENTS) {
      if (!seatDef.runtimeAgentName) continue
      const { capabilities, unmapped } = agentCapabilities(AGENTS[seatDef.runtimeAgentName])
      expect(unmapped).toEqual([])
      expect([...seatDef.capabilities].sort(), `${seatDef.id} capabilities kopyası sürüklendi`).toEqual(
        [...capabilities].sort(),
      )
    }
  })
})

describe('intelligence + business intelligence sözleşmesi', () => {
  it('kategori id/label benzersiz; brain kategorileri nodeTypes taşır', () => {
    const ids = new Set<string>()
    for (const category of INTELLIGENCE_CATEGORIES) {
      expect(ids.has(category.id)).toBe(false)
      ids.add(category.id)
      if (category.source === 'brain') {
        expect(category.nodeTypes?.length ?? 0, `${category.id} nodeTypes boş`).toBeGreaterThan(0)
      }
    }
    expect(INTELLIGENCE_CATEGORIES).toHaveLength(14)
  })

  it('registry sayımları gerçek registry verisinden gelir', () => {
    const counts = registryCounts()
    expect(counts.departments).toBe(13)
    expect(counts.agents).toBe(COMPANY_AGENTS.length)
    expect(counts.capabilities).toBeGreaterThan(0)
  })

  it('resolveCategoryCounts: registry sayılı, brain sayımsızken null, sayımla toplam', () => {
    const withoutBrain = resolveCategoryCounts()
    expect(withoutBrain.find((c) => c.category.id === 'departments')?.count).toBe(13)
    expect(withoutBrain.find((c) => c.category.id === 'skills')?.count).toBeNull()
    expect(withoutBrain.find((c) => c.category.id === 'frameworks')?.count).toBeNull()

    const withBrain = resolveCategoryCounts({ fact: 2, repository: 3, skill: 5 })
    expect(withBrain.find((c) => c.category.id === 'knowledge')?.count).toBe(5)
    expect(withBrain.find((c) => c.category.id === 'skills')?.count).toBe(5)
    expect(withBrain.find((c) => c.category.id === 'frameworks')?.count).toBeNull()
  })

  it('business listesi benzersiz ve planned statüsündedir', () => {
    const ids = new Set(BUSINESSES.map((b) => b.id))
    expect(ids.size).toBe(BUSINESSES.length)
    expect(BUSINESSES.length).toBeGreaterThanOrEqual(7)
    for (const business of BUSINESSES) expect(business.status).toBe('planned')
  })
})
