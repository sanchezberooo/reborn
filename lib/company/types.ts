// MAXAİ Company Layer tipleri (Sprint 7) — şirket ORGANİZASYON modeli.
//
// lib/departments (Sprint 2) ile İLİŞKİSİ ve AYRIMI bilinçlidir:
//   * lib/departments = runtime İZİN modeli — hangi ajan hangi tool'u
//     kullanabilir (default-deny, validateRoster testiyle korunur). 6 canlı
//     departman + legacy rafı; her departmanın kayıtlı bir ajanı OLMAK
//     ZORUNDA (departments.test.ts).
//   * lib/company = şirketin HEDEF organizasyonu — 13 departman, head/worker
//     hiyerarşisi, Executive Council. Çoğu koltuk henüz ajansızdır ('planned');
//     bu yüzden 13 departman lib/departments'a EKLENMEZ (boş departman o
//     testi kırardı ve izin modeli sahte kayıtlarla şişerdi).
// Köprü tek yönlüdür: company → runtime. Bir company departmanının canlı
// karşılığı varsa runtimeDepartmentId, bir koltuğun canlı ajanı varsa
// runtimeAgentName ile bağlanır. Bu modül yalnız tip + sabit içerir; runtime
// bağımlılığı yok, client component'lerden güvenle import edilir
// (lib/departments/types.ts deseni — oradan da yalnız TİP alınır).

import type { DepartmentId } from '../departments/types'

/** Şirketin 13 departmanı. Sıralama UI sıralamasıdır (Ofis odaları, Panel
 *  accordion'u) — alfabetik değil, organizasyon şeması sırası. */
export const COMPANY_DEPARTMENT_IDS = [
  'knowledge',
  'builder',
  'ai',
  'operations',
  'integration',
  'creative',
  'marketing',
  'sales',
  'customer-success',
  'business',
  'research-development',
  'security',
  'office-management',
] as const
export type CompanyDepartmentId = (typeof COMPANY_DEPARTMENT_IDS)[number]

export interface CompanyDepartment {
  id: CompanyDepartmentId
  displayName: string
  /** Ofis oda tabelası — dar alana sığan kısa ad ("R&D", "Office Mgmt"). */
  shortName: string
  mission: string
  /** Canlı izin-modeli karşılığı (lib/departments). Yoksa departman henüz
   *  tamamen 'planned'dır — hiçbir runtime ajanı bu odada oturmaz. */
  runtimeDepartmentId?: DepartmentId
}

export type CompanyAgentRole = 'head' | 'worker'

export interface CompanyAgent {
  /** kebab-case, şirket genelinde benzersiz (örn. 'knowledge-head'). */
  id: string
  departmentId: CompanyDepartmentId
  role: CompanyAgentRole
  title: string
  mission: string
  /** Koltuğun yetenek sözlüğü. Runtime-bağlı koltuklar için lib/departments
   *  CapabilityId değerleriyle BİREBİR aynı olmalı (company.test.ts korur);
   *  planned koltuklar için hedef yetenek etiketleridir. */
  capabilities: string[]
  /** İzin özeti — v1 ilkesi her koltukta aynı: taslak üretir, dış eylem yok.
   *  Ayrıntı runtime tarafında (default-deny) yaşar; burası UI dili. */
  permissionSummary: string
  /** Canlı registry karşılığı (lib/agents/registry.ts AGENTS anahtarı).
   *  Varsa Panel/Ofis bu koltuğu agent_runs verisiyle canlı gösterir. */
  runtimeAgentName?: string
}

/** Koltuğun anlık durumu — statik org modelinin DIŞINDA yaşar. Runtime-bağlı
 *  koltuklar için agent_runs'tan türetilir; planned koltuklar için sabit
 *  placeholder'dır (mock veri üretilmez, tek bir 'planned' değeri yeter). */
export type CompanyAgentStatus = 'planned' | 'idle' | 'working' | 'error'
export type CompanyAgentHealth = 'unknown' | 'healthy' | 'degraded'

export interface AgentPresence {
  status: CompanyAgentStatus
  currentTask: string | null
  lastActivityAt: string | null
  /** İnsan-okur çalışma ortamı etiketi (örn. 'agent-runner') — planned'da null. */
  runtime: string | null
  health: CompanyAgentHealth
}

/** Executive Council — departman DEĞİL, Company Layer'dır: 13 Head Agent'ın
 *  temsil edildiği, Sanchez'in karar verdiği kat. İleride toplantılar burada. */
export interface ExecutiveCouncil {
  /** Başkan — Sanchez. Registry ajanı değil, chat orkestratörü. */
  chair: { id: 'sanchez'; title: string }
  /** 13 head koltuğunun CompanyAgent id'leri (departman sırasında). */
  memberAgentIds: string[]
}

/** Business Intelligence — her müşteri/iş kendi Brain'ine sahip olacak.
 *  Sprint 7'de yalnız liste; graph ve scope bağlama sonraki sprintlerin işi. */
export interface Business {
  id: string
  name: string
  description: string
  /** v1'de hepsi 'planned' — canlı Brain scope'u bağlanınca 'active' olur. */
  status: 'planned' | 'active'
}
