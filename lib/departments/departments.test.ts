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

// ── life-data.write izin boşluğu (Paket C1 / TASK C1.4) ─────────────────────

describe('life-data.write — bilinçli boşluk, gözden kaçma değil', () => {
  it('HİÇBİR departman kullanıcı verisi yazamaz', () => {
    // Bu ailenin tamamı (save_memory, save_goal, update_profile, toggle_habit,
    // update_module, add_roadmap_item, add_scholarship, save_to_library)
    // KULLANICININ KENDİ hayat verisini yazar. MAXAİ ajanları istisnasız
    // taslak-üreticidir: çıktıları insan onayı bekleyen önerilerdir.
    // Yazma yetkisi Sanchez'e aittir çünkü o KONUŞARAK yazar (öneri → onay).
    for (const department of listDepartments()) {
      expect({
        department: department.id,
        effect: departmentEffect(department, 'life-data.write'),
      }).toMatchObject({ effect: 'forbidden' })
    }
  })

  it('yaptırım çalışma zamanında da geçerli (kapı registry\'ye bağlı)', async () => {
    const { canUseTool } = await import('./enforcement')
    for (const agent of listAgents({ includeDeprecated: true })) {
      const decision = canUseTool(agent.name, 'save_memory')
      expect({ agent: agent.name, allowed: decision.allowed }).toMatchObject({ allowed: false })
    }
    // Sanchez muaftır — tek yazma yolu odur.
    expect(canUseTool('sanchez', 'save_memory').allowed).toBe(true)
  })
})

// ── brain.contribute (Paket C1 / TASK C1.3) ─────────────────────────────────

describe('brain.contribute — seçili departmanlar', () => {
  it('yalnız knowledge, builder ve operations katkı yapabilir', () => {
    const expected: Record<string, boolean> = {
      knowledge: true, builder: true, operations: true,
      growth: false, creative: false, 'client-success': false, legacy: false,
    }
    for (const department of listDepartments()) {
      expect({
        department: department.id,
        allowed: departmentEffect(department, 'brain.contribute') === 'allowed',
      }).toMatchObject({ allowed: expected[department.id] })
    }
  })

  it('brain.integrate KİLİDİ korunuyor — yalnız knowledge', () => {
    // brain.contribute ayrı bir yetenektir; integrate kilidini gevşetmez.
    for (const department of listDepartments()) {
      const effect = departmentEffect(department, 'brain.integrate')
      expect({ department: department.id, effect })
        .toMatchObject({ effect: department.id === 'knowledge' ? 'allowed' : 'forbidden' })
    }
  })
})
