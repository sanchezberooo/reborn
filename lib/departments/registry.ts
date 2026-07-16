// MAXAİ Department Registry — departman tanımlarının tek kaynağı + ajan/
// departman tutarlılık doğrulaması. Bağımlılık yönü BİLİNÇLİ tek taraflı:
// bu modül lib/agents/registry.ts'i import ETMEZ (ajan registry'si
// doğrulama için burayı import eder — döngü yok); ajan listesi doğrulamaya
// parametre olarak verilir.
//
// Doğrulamanın yaptırımı testtir (departments.test.ts + roster.test.ts):
// gerçek yetkilendirme/Auth bu fazda yok — ihlal, CI'da kırmızı test olarak
// yakalanır, runtime'da engellenmez (registerAgent hariç: dinamik kayıt
// yolu ihlalde fırlatır).

import { TOOLS } from '../ai/tools'
import type { CapabilityId, Department, DepartmentId, PermissionEffect } from './types'
import { CAPABILITY_IDS, DEPARTMENT_IDS, EXTERNAL_ACTION_CAPABILITIES } from './types'

/** Doğrulamanın gördüğü asgari ajan yüzeyi — AgentDefinition'ın alt kümesi
 *  (lib/agents/types.ts'e bağımlılık kurmamak için yapısal tip). */
export interface AgentSurface {
  name: string
  department?: string
  deprecated?: boolean
  toolNames: string[]
  webSearch?: boolean
}

// ── Tool → yetenek eşlemesi ─────────────────────────────────────────────────
// Her tool TAM BİR yeteneğe eşlenir. Yeni tool eklendiğinde buraya da
// eklenmek ZORUNDA — departments.test.ts eksik eşlemeyi kırmızıya düşürür
// (bilinçli sürtünme: sınıflandırılmamış tool yetki modelinin dışına çıkamaz).
export const TOOL_CAPABILITIES: Record<string, CapabilityId> = {
  read_habits: 'life-data.read',
  read_memories: 'life-data.read',
  read_profile: 'life-data.read',
  read_modules: 'life-data.read',
  read_library: 'life-data.read',
  read_conversations: 'life-data.read',
  read_essays: 'life-data.read',
  toggle_habit: 'life-data.write',
  save_memory: 'life-data.write',
  save_goal: 'life-data.write',
  update_profile: 'life-data.write',
  save_to_library: 'life-data.write',
  update_module: 'life-data.write',
  add_roadmap_item: 'life-data.write',
  add_scholarship: 'life-data.write',
  log_agent_action: 'ops.log',
  run_agent: 'agents.delegate',
  delegate_task: 'tasks.delegate',
  brain_get_node: 'brain.read',
  brain_link: 'brain.link',
  brain_read_signals: 'brain.signals.read',
  brain_integrate: 'brain.integrate',
  fetch_source_overview: 'source.fetch',
  fetch_source_content: 'source.fetch',
}

// ── Departman tanımları ─────────────────────────────────────────────────────
// permissions default-deny'dir: listede 'allowed' olmayan yetenek yasak.
// Mevcut roster davranışı birebir kodlanmıştır — hiçbir ajanın fiili tool
// listesi değişmez; bu tablo o listelerin artık İLKE olarak yaşadığı yerdir.
export const DEPARTMENTS: Record<DepartmentId, Department> = {
  knowledge: {
    id: 'knowledge',
    displayName: 'Knowledge',
    mission:
      "Şirket beyninin (Agent Brain) bekçisi: sıcak katman sinyallerini soğuk katman bilgisine damıtır, dış kaynakları (v1: GitHub) okuyup raporlar. Soğuk katmana yazma yetkisi olan TEK departman.",
    roles: [
      {
        id: 'knowledge-curator',
        title: 'Knowledge Curator',
        mission: 'Sinyal → bilgi damıtımı, kaynak analizi, graf bakımı.',
      },
    ],
    permissions: [
      { capability: 'brain.read', effect: 'allowed' },
      { capability: 'brain.link', effect: 'allowed' },
      { capability: 'brain.signals.read', effect: 'allowed' },
      { capability: 'brain.integrate', effect: 'allowed' },
      { capability: 'source.fetch', effect: 'allowed' },
    ],
  },
  growth: {
    id: 'growth',
    displayName: 'Growth',
    mission: 'Reklam, SEO ve dönüşüm stratejisi taslakları — yalnız öneri üretir.',
    roles: [
      {
        id: 'growth-strategist',
        title: 'Growth Strategist',
        mission: 'Kampanya/anahtar kelime/dönüşüm taslağı; güncel bilgi için web araması.',
      },
    ],
    permissions: [
      { capability: 'brain.read', effect: 'allowed' },
      { capability: 'brain.link', effect: 'allowed' },
      { capability: 'web.search', effect: 'allowed' },
      { capability: 'tasks.delegate', effect: 'allowed' },
    ],
  },
  creative: {
    id: 'creative',
    displayName: 'Creative',
    mission: 'İçerik taslakları: reels/story senaryosu, blog, marka dili — yalnız taslak.',
    roles: [
      {
        id: 'content-creator',
        title: 'Content Creator',
        mission: 'Brief → çekilebilir/yayınlanabilir netlikte içerik taslağı.',
      },
    ],
    permissions: [
      { capability: 'brain.read', effect: 'allowed' },
      { capability: 'brain.link', effect: 'allowed' },
      { capability: 'tasks.delegate', effect: 'allowed' },
    ],
  },
  builder: {
    id: 'builder',
    displayName: 'Builder',
    mission: 'Web/landing/otomasyon için teknik tasarım taslakları — deploy etmez.',
    roles: [
      {
        id: 'technical-designer',
        title: 'Technical Designer',
        mission: 'Mimari özet, bileşen listesi, teknoloji gerekçesi, inşa planı.',
      },
    ],
    permissions: [
      { capability: 'brain.read', effect: 'allowed' },
      { capability: 'brain.link', effect: 'allowed' },
      { capability: 'tasks.delegate', effect: 'allowed' },
    ],
  },
  'client-success': {
    id: 'client-success',
    displayName: 'Client Success',
    mission: 'Serbest müşteri isteği → yapılandırılmış Objective + rapor taslağı.',
    roles: [
      {
        id: 'client-partner',
        title: 'Client Partner',
        mission: 'İhtiyaç damıtma, başarı kriteri çıkarma, müşteri dili.',
      },
    ],
    permissions: [
      { capability: 'brain.read', effect: 'allowed' },
      { capability: 'brain.link', effect: 'allowed' },
      { capability: 'tasks.delegate', effect: 'allowed' },
    ],
  },
  operations: {
    id: 'operations',
    displayName: 'Operations',
    mission: 'Sistem sağlığı ve maliyet gözlemi — salt-okunur analiz, hiçbir şeyi değiştirmez.',
    roles: [
      {
        id: 'operations-analyst',
        title: 'Operations Analyst',
        mission: 'Çalıştırma verisinden sağlık/maliyet raporu ve öneri.',
      },
    ],
    permissions: [
      { capability: 'brain.read', effect: 'allowed' },
      { capability: 'brain.link', effect: 'allowed' },
      { capability: 'tasks.delegate', effect: 'allowed' },
    ],
  },
  legacy: {
    id: 'legacy',
    displayName: 'Legacy',
    mission:
      'Emekli ajanların geriye-uyumluluk rafı — eski agent_runs geçmişi çözülmeye devam etsin diye. Yeni ajan bu departmana AÇILMAZ.',
    roles: [
      {
        id: 'retired',
        title: 'Retired Agent',
        mission: 'Yalnız tarihsel kayıt; Sanchez yönlendirme rehberinde görünmez.',
      },
    ],
    permissions: [
      { capability: 'life-data.read', effect: 'allowed' },
      { capability: 'web.search', effect: 'allowed' },
    ],
  },
}

export function getDepartment(id: string): Department | null {
  return (DEPARTMENT_IDS as readonly string[]).includes(id)
    ? DEPARTMENTS[id as DepartmentId]
    : null
}

export function listDepartments(): Department[] {
  return DEPARTMENT_IDS.map((id) => DEPARTMENTS[id])
}

/** Ajanın fiilen kullandığı yetenekler: tool eşlemeleri + webSearch bayrağı.
 *  Eşlenmemiş tool adı sonuçta 'unmapped:<name>' olarak işaretlenir — ihlal. */
export function agentCapabilities(agent: AgentSurface): { capabilities: CapabilityId[]; unmapped: string[] } {
  const capabilities = new Set<CapabilityId>()
  const unmapped: string[] = []
  for (const toolName of agent.toolNames) {
    const cap = TOOL_CAPABILITIES[toolName]
    if (cap) capabilities.add(cap)
    else unmapped.push(toolName)
  }
  if (agent.webSearch) capabilities.add('web.search')
  return { capabilities: [...capabilities], unmapped }
}

/** Default-deny çözümleme: permission listesinde olmayan yetenek yasaktır. */
export function departmentEffect(department: Department, capability: CapabilityId): PermissionEffect {
  return department.permissions.find((p) => p.capability === capability)?.effect ?? 'forbidden'
}

/**
 * Tek ajanın departman sözleşmesine uyumu. Dönen dizi boşsa uyumlu; değilse
 * her eleman insan-okur bir ihlal cümlesidir (test çıktısında doğrudan
 * gösterilir). Kontroller:
 *  1. department alanı tanımlı bir DepartmentId olmalı.
 *  2. Tüm tool'lar yetenek sözlüğüne eşlenmiş olmalı.
 *  3. Kullanılan her yetenek departmanda 'allowed' olmalı (default-deny).
 */
export function validateAgentDepartment(agent: AgentSurface): string[] {
  const violations: string[] = []

  if (!agent.department) {
    violations.push(`${agent.name}: department alanı boş — her ajan bir departmana bağlı olmalı.`)
    return violations
  }
  const department = getDepartment(agent.department)
  if (!department) {
    violations.push(`${agent.name}: '${agent.department}' tanımlı bir departman değil (geçerli: ${DEPARTMENT_IDS.join(', ')}).`)
    return violations
  }
  if (department.id === 'legacy' && !agent.deprecated) {
    violations.push(`${agent.name}: 'legacy' departmanına yalnız deprecated ajan bağlanabilir.`)
  }

  const { capabilities, unmapped } = agentCapabilities(agent)
  for (const toolName of unmapped) {
    violations.push(`${agent.name}: '${toolName}' tool'u TOOL_CAPABILITIES sözlüğünde eşlenmemiş.`)
  }
  for (const capability of capabilities) {
    if (departmentEffect(department, capability) !== 'allowed') {
      violations.push(
        `${agent.name}: '${capability}' yeteneği ${department.displayName} departmanında izinli değil (default-deny).`,
      )
    }
  }
  return violations
}

/**
 * Tüm roster'ın bütünlük doğrulaması. Ajan listesi parametredir (bağımlılık
 * yönü — dosya başı notu). Ek küresel kurallar:
 *  * Merkezi TOOLS listesindeki her tool yetenek sözlüğünde eşlenmiş olmalı.
 *  * Hiçbir departman dış-eylem yeteneğine 'allowed'/'approval-required'
 *    veremez (Sprint 1: izin/onay katmanı tasarlanmadan dış eylem yok).
 *  * 'brain.integrate' yalnız knowledge departmanında izinli olabilir.
 */
export function validateRoster(agents: AgentSurface[]): string[] {
  const violations: string[] = []

  for (const tool of TOOLS) {
    if (!TOOL_CAPABILITIES[tool.name]) {
      violations.push(`TOOLS['${tool.name}'] yetenek sözlüğünde eşlenmemiş — TOOL_CAPABILITIES'e ekle.`)
    }
  }
  for (const name of Object.keys(TOOL_CAPABILITIES)) {
    if (!TOOLS.some((t) => t.name === name)) {
      violations.push(`TOOL_CAPABILITIES['${name}'] merkezi TOOLS listesinde yok — ölü eşleme.`)
    }
  }

  for (const department of listDepartments()) {
    for (const permission of department.permissions) {
      if (!(CAPABILITY_IDS as readonly string[]).includes(permission.capability)) {
        violations.push(`${department.id}: '${permission.capability}' tanımlı bir yetenek değil.`)
      }
      if (
        (EXTERNAL_ACTION_CAPABILITIES as readonly string[]).includes(permission.capability) &&
        permission.effect !== 'forbidden'
      ) {
        violations.push(
          `${department.id}: dış-eylem yeteneği '${permission.capability}' v1'de yalnız 'forbidden' olabilir — izin/onay katmanı henüz tasarlanmadı.`,
        )
      }
      if (permission.capability === 'brain.integrate' && permission.effect === 'allowed' && department.id !== 'knowledge') {
        violations.push(`${department.id}: 'brain.integrate' yalnız knowledge departmanında izinli olabilir.`)
      }
    }
  }

  for (const agent of agents) {
    violations.push(...validateAgentDepartment(agent))
  }
  return violations
}
