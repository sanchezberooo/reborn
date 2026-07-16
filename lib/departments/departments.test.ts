import { describe, expect, it } from 'vitest'

// Department Registry sözleşme testi — üç şeyi korur:
// 1. Roster bütünlüğü: kayıtlı TÜM ajanlar departman izin modeline uyar
//    (default-deny), merkezi TOOLS listesindeki her tool yetenek sözlüğünde
//    eşlidir, dış-eylem yetenekleri hiçbir departmanda izinli değildir.
// 2. Privileged yol: brain.integrate yalnız knowledge departmanında izinli
//    (roster.test.ts'in tool-listesi kontrolünün ilke-katmanı karşılığı).
// 3. Dinamik kayıt: registerAgent ihlalde fırlatır, uyumlu kaydı kabul eder,
//    unregisterAgent çekirdek rosteri silemez.

import { AGENTS, getAgent, listAgents, registerAgent, unregisterAgent } from '../agents/registry'
import type { AgentDefinition } from '../agents/types'
import {
  agentCapabilities,
  departmentEffect,
  DEPARTMENTS,
  getDepartment,
  listDepartments,
  validateRoster,
} from './registry'
import { DEPARTMENT_IDS, EXTERNAL_ACTION_CAPABILITIES } from './types'

describe('department registry — tanım bütünlüğü', () => {
  it('tüm departmanlar kayıtlı ve id alanları tutarlı', () => {
    for (const id of DEPARTMENT_IDS) {
      const department = getDepartment(id)
      expect(department).not.toBeNull()
      expect(department!.id).toBe(id)
      expect(department!.roles.length).toBeGreaterThan(0)
    }
    expect(listDepartments()).toHaveLength(DEPARTMENT_IDS.length)
    expect(getDepartment('olmayan-departman')).toBeNull()
  })

  it('hiçbir departman dış-eylem yeteneğine izin vermez (Sprint 1 kararı)', () => {
    for (const department of listDepartments()) {
      for (const capability of EXTERNAL_ACTION_CAPABILITIES) {
        expect(departmentEffect(department, capability)).toBe('forbidden')
      }
    }
  })

  it('brain.integrate yalnız knowledge departmanında izinli', () => {
    for (const department of listDepartments()) {
      const effect = departmentEffect(department, 'brain.integrate')
      if (department.id === 'knowledge') expect(effect).toBe('allowed')
      else expect(effect).toBe('forbidden')
    }
  })
})

describe('roster doğrulaması — mevcut ajanlar izin modeline uyar', () => {
  it('validateRoster ihlal döndürmez', () => {
    expect(validateRoster(Object.values(AGENTS))).toEqual([])
  })

  it('agentCapabilities knowledge-agent için privileged yetenekleri döndürür', () => {
    const agent = getAgent('knowledge-agent')!
    const { capabilities, unmapped } = agentCapabilities(agent)
    expect(unmapped).toEqual([])
    expect(capabilities).toEqual(
      expect.arrayContaining(['brain.signals.read', 'brain.integrate', 'source.fetch']),
    )
  })
})

describe('dinamik registry — registerAgent / listAgents / unregisterAgent', () => {
  const validDef: AgentDefinition = {
    name: 'kayit-testi-agent',
    displayName: 'Kayıt Testi Agent',
    department: 'creative',
    persona: 'Test personası — yalnız kayıt yolunu doğrular.',
    toolNames: ['brain_get_node'],
    moduleTarget: null,
    outputContract: '{ "ok": boolean }',
  }

  it('uyumlu tanımı kabul eder; getAgent/listAgents anında görür; söküm çalışır', () => {
    try {
      registerAgent(validDef)
      expect(getAgent('kayit-testi-agent')).not.toBeNull()
      expect(listAgents({ department: 'creative' }).map((a) => a.name)).toContain('kayit-testi-agent')
    } finally {
      expect(unregisterAgent('kayit-testi-agent')).toBe(true)
    }
    expect(getAgent('kayit-testi-agent')).toBeNull()
  })

  it('ad çakışmasını reddeder', () => {
    expect(() => registerAgent({ ...validDef, name: 'growth-agent' })).toThrow(/zaten kayıtlı/)
  })

  it('geçersiz ad biçimini reddeder', () => {
    expect(() => registerAgent({ ...validDef, name: 'Kayit_Testi' })).toThrow(/kebab-case/)
  })

  it('departman izin ihlalini reddeder (creative → brain_integrate yasak)', () => {
    expect(() =>
      registerAgent({ ...validDef, name: 'ihlal-testi-agent', toolNames: ['brain_integrate'] }),
    ).toThrow(/departman sözleşmesini ihlal/)
    expect(getAgent('ihlal-testi-agent')).toBeNull()
  })

  it('tanımsız departmanı reddeder', () => {
    expect(() =>
      registerAgent({ ...validDef, name: 'departmansiz-agent', department: 'video' as never }),
    ).toThrow(/departman/)
  })

  it('çekirdek roster unregisterAgent ile silinemez', () => {
    expect(() => unregisterAgent('growth-agent')).toThrow(/çekirdek roster/)
    expect(getAgent('growth-agent')).not.toBeNull()
  })

  it('listAgents varsayılanı deprecated ajanları gizler', () => {
    const names = listAgents().map((a) => a.name)
    expect(names).not.toContain('essay-critic')
    expect(names).toContain('knowledge-agent')
    expect(listAgents({ includeDeprecated: true }).map((a) => a.name)).toContain('essay-critic')
  })

  it('DEPARTMENTS içindeki her departmanın en az bir kayıtlı ajanı vardır (legacy hariç değil)', () => {
    for (const department of Object.values(DEPARTMENTS)) {
      const members = listAgents({ includeDeprecated: true, department: department.id })
      expect(members.length, `${department.id} departmanı boş`).toBeGreaterThan(0)
    }
  })
})
