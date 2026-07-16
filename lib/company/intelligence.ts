// Agent Intelligence (Sprint 7) — "Agent Brain" ekranının yerini alan yüzeyin
// VERİ MODELİ. Ekran ileride Obsidian tarzı graph olacak; bu sprintte amaç
// kategorilerin ve sayım kaynaklarının sözleşmesini kurmak.
//
// Üç sayım kaynağı vardır:
//   * 'registry' — sayı şirket/izin registry'lerinden derlenir (build-time
//     gerçek veri: departman, ajan, yetenek sayıları).
//   * 'brain'    — sayı Agent Brain'in entities tablosundan gelir
//     (scope='agent', nodeTypes eşlemesi; canlı sayım /api/intelligence/stats).
//   * 'planned'  — kategorinin entity tipi HENÜZ yok (Frameworks, Technologies,
//     Decision Rules, Playbooks). Yeni tip eklemek = yeni migration (CHECK
//     listesi genişletilir, CLAUDE.md §4) — bu sprintte bilinçli yapılmadı,
//     kategori sözleşmesi hazır bekler.
//
// Bu modül client-safe'tir: yalnız tip + sabit + saf fonksiyon.

import type { AgentNodeType } from '../brain/types'
import { CAPABILITY_IDS } from '../departments/types'
import { COMPANY_AGENTS, listCompanyDepartments } from './registry'

export type IntelligenceSource = 'registry' | 'brain' | 'planned'

export interface IntelligenceCategory {
  id: string
  label: string
  description: string
  source: IntelligenceSource
  /** source='brain' için: bu kategorinin saydığı entities.type değerleri. */
  nodeTypes?: AgentNodeType[]
}

/** Sıralama UI sırasıdır (spec listesi). */
export const INTELLIGENCE_CATEGORIES: IntelligenceCategory[] = [
  { id: 'departments', label: 'Departments', description: 'Şirket departmanları (Company Registry).', source: 'registry' },
  { id: 'agents', label: 'Agents', description: 'Head + worker koltukları (Company Registry).', source: 'registry' },
  { id: 'capabilities', label: 'Capabilities', description: 'Sistem yetenek sözlüğü (izin modeli).', source: 'registry' },
  { id: 'skills', label: 'Skills', description: 'Damıtılmış beceriler (soğuk katman).', source: 'brain', nodeTypes: ['skill'] },
  { id: 'workflows', label: 'Workflows', description: 'İş akışı bilgisi (soğuk katman).', source: 'brain', nodeTypes: ['workflow'] },
  { id: 'patterns', label: 'Patterns', description: 'Tekrarlayan desenler (soğuk katman).', source: 'brain', nodeTypes: ['pattern'] },
  { id: 'sop', label: 'SOP', description: 'Standart operasyon prosedürleri (type=standard).', source: 'brain', nodeTypes: ['standard'] },
  { id: 'templates', label: 'Templates', description: 'Yeniden kullanılabilir üretim şablonları.', source: 'brain', nodeTypes: ['template'] },
  { id: 'tools', label: 'Tools', description: 'Araç referans kartları (type=tool_reference).', source: 'brain', nodeTypes: ['tool_reference'] },
  { id: 'frameworks', label: 'Frameworks', description: 'Çerçeve bilgisi — entity tipi henüz yok (migration bekler).', source: 'planned' },
  { id: 'technologies', label: 'Technologies', description: 'Teknoloji bilgisi — entity tipi henüz yok (migration bekler).', source: 'planned' },
  { id: 'decision-rules', label: 'Decision Rules', description: 'Karar kuralları — entity tipi henüz yok (migration bekler).', source: 'planned' },
  { id: 'playbooks', label: 'Playbooks', description: 'Uçtan uca oyun planları — entity tipi henüz yok (migration bekler).', source: 'planned' },
  { id: 'knowledge', label: 'Knowledge', description: 'Damıtılmış bilgi + kaynak kartları (fact, repository, learning_record).', source: 'brain', nodeTypes: ['fact', 'repository', 'learning_record'] },
]

/** Registry-kaynaklı sayımlar — senkron, gerçek veri (mock değil). */
export function registryCounts(): Record<string, number> {
  return {
    departments: listCompanyDepartments().length,
    agents: COMPANY_AGENTS.length,
    capabilities: CAPABILITY_IDS.length,
  }
}

/**
 * Kategori sayılarını birleştirir. brainNodeCounts = entities.type → adet
 * (scope='agent'; /api/intelligence/stats çıktısı). Verilmezse brain
 * kategorileri null döner — UI "canlı sayım bekleniyor" gösterir; planned
 * kategoriler her zaman null'dur.
 */
export function resolveCategoryCounts(
  brainNodeCounts?: Record<string, number>,
): Array<{ category: IntelligenceCategory; count: number | null }> {
  const registry = registryCounts()
  return INTELLIGENCE_CATEGORIES.map((category) => {
    if (category.source === 'registry') {
      return { category, count: registry[category.id] ?? 0 }
    }
    if (category.source === 'brain' && brainNodeCounts) {
      const count = (category.nodeTypes ?? []).reduce(
        (sum, type) => sum + (brainNodeCounts[type] ?? 0),
        0,
      )
      return { category, count }
    }
    return { category, count: null }
  })
}
