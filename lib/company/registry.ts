// MAXAİ Company Registry (Sprint 7) — şirket organizasyonunun tek kaynağı:
// 13 departman, head/worker koltukları, Executive Council. lib/departments
// (runtime izin modeli) ile ayrımı ve tek yönlü köprüsü types.ts başında
// anlatılır — bu dosya ORADAKİ karara uygulamadır.
//
// Koltuk (CompanyAgent) ≠ canlı ajan: çoğu koltuk 'planned'dır ve hiçbir
// LLM çağrısı/AI davranışı taşımaz. Canlı karşılığı olan koltuklar
// runtimeAgentName ile lib/agents/registry.ts'e bağlanır; bu koltukların
// capabilities listesi runtime ajanın FİİLİ yeteneklerinin birebir kopyasıdır
// ve company.test.ts bunu agentCapabilities() ile çapraz doğrular — kopya
// sürüklenirse test kırmızıya düşer (client bundle'a lib/departments/registry
// import etmemek için bilinçli kopya + test yaptırımı deseni).

import type {
  AgentPresence,
  Business,
  CompanyAgent,
  CompanyAgentRole,
  CompanyDepartment,
  CompanyDepartmentId,
  ExecutiveCouncil,
} from './types'
import { COMPANY_DEPARTMENT_IDS } from './types'

// ── Departmanlar ────────────────────────────────────────────────────────────

export const COMPANY_DEPARTMENTS: Record<CompanyDepartmentId, CompanyDepartment> = {
  knowledge: {
    id: 'knowledge',
    displayName: 'Knowledge',
    shortName: 'Knowledge',
    mission: 'Şirket hafızasının bekçisi: kaynak okuma, damıtma, graf bakımı ve bilgi kalitesi.',
    runtimeDepartmentId: 'knowledge',
  },
  builder: {
    id: 'builder',
    displayName: 'Builder',
    shortName: 'Builder',
    mission: 'Web, landing ve otomasyon işlerinin teknik tasarımı ve inşa planları.',
    runtimeDepartmentId: 'builder',
  },
  ai: {
    id: 'ai',
    displayName: 'AI',
    shortName: 'AI',
    mission: 'Model seçimi, prompt mühendisliği ve ajan davranış kalibrasyonu.',
  },
  operations: {
    id: 'operations',
    displayName: 'Operations',
    shortName: 'Operations',
    mission: 'Sistem sağlığı, maliyet gözlemi ve çalıştırma altyapısının salt-okunur denetimi.',
    runtimeDepartmentId: 'operations',
  },
  integration: {
    id: 'integration',
    displayName: 'Integration',
    shortName: 'Integration',
    mission: 'Dış sistem köprüleri (OpenClaw, n8n, MCP) — onay katmanlı bağlantı sözleşmeleri.',
  },
  creative: {
    id: 'creative',
    displayName: 'Creative',
    shortName: 'Creative',
    mission: 'İçerik taslakları: senaryo, blog, marka dili — yayınlamaz, üretir.',
    runtimeDepartmentId: 'creative',
  },
  marketing: {
    id: 'marketing',
    displayName: 'Marketing',
    shortName: 'Marketing',
    mission: 'Reklam, SEO ve dönüşüm stratejisi taslakları (runtime karşılığı: growth).',
    runtimeDepartmentId: 'growth',
  },
  sales: {
    id: 'sales',
    displayName: 'Sales',
    shortName: 'Sales',
    mission: 'Teklif taslakları ve satış hattı analizi — hiçbir müşteriye kendisi ulaşmaz.',
  },
  'customer-success': {
    id: 'customer-success',
    displayName: 'Customer Success',
    shortName: 'C. Success',
    mission: 'Müşteri isteğini yapılandırılmış hedefe çevirme ve rapor taslakları.',
    runtimeDepartmentId: 'client-success',
  },
  business: {
    id: 'business',
    displayName: 'Business',
    shortName: 'Business',
    mission: 'İş modeli analizi, fiyatlandırma ve strateji önerileri.',
  },
  'research-development': {
    id: 'research-development',
    displayName: 'Research & Development',
    shortName: 'R&D',
    mission: 'Yeni teknik/yöntem keşfi, prototip planları ve deney tasarımı.',
  },
  security: {
    id: 'security',
    displayName: 'Security',
    shortName: 'Security',
    mission: 'İzin modeli denetimi, veri güvenliği gözden geçirmeleri ve risk raporları.',
  },
  'office-management': {
    id: 'office-management',
    displayName: 'Office Management',
    shortName: 'Office Mgmt',
    mission: 'Şirket içi düzen: kayıt tutma, arşiv, süreç takibi ve koordinasyon.',
  },
}

// ── Koltuklar (head + worker) ───────────────────────────────────────────────
// Her departman TAM BİR head taşır (company.test.ts korur). Worker koltukları
// hedef organizasyondur — spec'in verdiği Knowledge/Builder kadroları aynen,
// diğerleri departman misyonundan türetilmiş asgari kadro.
//
// v1 izin ilkesi her koltukta aynıdır (permissionSummary): taslak üretir,
// dış eylem (yayın/mesaj/harcama/dış-sistem değişikliği) İSTİSNASIZ yasak.

const DRAFT_ONLY = 'Taslak üretir; dış eylem yok (default-deny, v1)'
const PLANNED = 'Planlandı — ajan henüz kurulmadı'

/** Kısa kurucu: koltukların %90'ı aynı kalıptır. */
function seat(
  departmentId: CompanyDepartmentId,
  role: CompanyAgentRole,
  idSuffix: string,
  title: string,
  mission: string,
  extra?: Partial<Pick<CompanyAgent, 'capabilities' | 'permissionSummary' | 'runtimeAgentName'>>,
): CompanyAgent {
  return {
    id: `${departmentId}-${idSuffix}`,
    departmentId,
    role,
    title,
    mission,
    capabilities: extra?.capabilities ?? [],
    permissionSummary: extra?.permissionSummary ?? (extra?.runtimeAgentName ? DRAFT_ONLY : PLANNED),
    runtimeAgentName: extra?.runtimeAgentName,
  }
}

/** Runtime-bağlı head'lerin fiili yetenekleri — lib/agents registry'sindeki
 *  tool listelerinin yetenek karşılığı (company.test.ts çapraz doğrular). */
const STANDARD_DEPT_CAPS = ['brain.read', 'brain.link', 'tasks.delegate']

export const COMPANY_AGENTS: CompanyAgent[] = [
  // Knowledge — spec kadrosu: Head, Research, Extractor, Reviewer, Librarian
  seat('knowledge', 'head', 'head', 'Head of Knowledge', 'Sinyal→bilgi damıtımının ve kaynak hattının sahibi.', {
    runtimeAgentName: 'knowledge-agent',
    capabilities: ['brain.read', 'brain.link', 'brain.signals.read', 'brain.integrate', 'source.fetch'],
  }),
  seat('knowledge', 'worker', 'research', 'Research', 'Yeni kaynak keşfi ve ön değerlendirme.'),
  seat('knowledge', 'worker', 'extractor', 'Extractor', 'Kaynaktan yapılandırılmış bilgi çıkarımı.'),
  seat('knowledge', 'worker', 'reviewer', 'Reviewer', 'Çıkarılan bilginin kalite ve çelişki denetimi.'),
  seat('knowledge', 'worker', 'librarian', 'Librarian', 'Graf düzeni, etiketleme ve arşiv bakımı.'),

  // Builder — spec kadrosu: Head, Frontend, Backend, QA
  seat('builder', 'head', 'head', 'Head of Builder', 'Teknik tasarım hattının sahibi.', {
    runtimeAgentName: 'builder-agent',
    capabilities: STANDARD_DEPT_CAPS,
  }),
  seat('builder', 'worker', 'frontend', 'Frontend', 'Arayüz bileşen tasarımı ve taslakları.'),
  seat('builder', 'worker', 'backend', 'Backend', 'Servis/veri katmanı tasarım taslakları.'),
  seat('builder', 'worker', 'qa', 'QA', 'Tasarım ve taslakların doğrulama planları.'),

  // AI
  seat('ai', 'head', 'head', 'Head of AI', 'Model/prompt stratejisinin sahibi.'),
  seat('ai', 'worker', 'prompt-engineer', 'Prompt Engineer', 'Ajan persona ve prompt kalibrasyonu.'),
  seat('ai', 'worker', 'model-ops', 'Model Ops', 'Model seçimi, maliyet/başarım gözlemi.'),

  // Operations
  seat('operations', 'head', 'head', 'Head of Operations', 'Sistem sağlığı ve maliyet gözleminin sahibi.', {
    runtimeAgentName: 'operations-agent',
    capabilities: STANDARD_DEPT_CAPS,
  }),
  seat('operations', 'worker', 'monitor', 'Monitor', 'Çalıştırma olaylarının izlenmesi ve alarm önerileri.'),
  seat('operations', 'worker', 'cost-analyst', 'Cost Analyst', 'Token/maliyet analizi ve tasarruf önerileri.'),

  // Integration
  seat('integration', 'head', 'head', 'Head of Integration', 'Dış sistem köprü sözleşmelerinin sahibi.'),
  seat('integration', 'worker', 'connector', 'Connector', 'OpenClaw/MCP bağlantı adaptör tasarımları.'),
  seat('integration', 'worker', 'automation', 'Automation', 'n8n akış taslakları ve onay katmanı planları.'),

  // Creative
  seat('creative', 'head', 'head', 'Head of Creative', 'İçerik üretim hattının sahibi.', {
    runtimeAgentName: 'creative-agent',
    capabilities: STANDARD_DEPT_CAPS,
  }),
  seat('creative', 'worker', 'copywriter', 'Copywriter', 'Metin/başlık taslakları.'),
  seat('creative', 'worker', 'scenarist', 'Scenarist', 'Reels/story/video senaryo taslakları.'),

  // Marketing (runtime: growth)
  seat('marketing', 'head', 'head', 'Head of Marketing', 'Reklam/SEO/dönüşüm stratejisinin sahibi.', {
    runtimeAgentName: 'growth-agent',
    capabilities: [...STANDARD_DEPT_CAPS, 'web.search'],
  }),
  seat('marketing', 'worker', 'seo', 'SEO', 'Anahtar kelime ve içerik-arama stratejisi taslakları.'),
  seat('marketing', 'worker', 'campaign', 'Campaign', 'Kampanya kurgusu ve reklam metni taslakları.'),

  // Sales
  seat('sales', 'head', 'head', 'Head of Sales', 'Satış hattı ve teklif sürecinin sahibi.'),
  seat('sales', 'worker', 'proposal', 'Proposal', 'Teklif/fiyat dokümanı taslakları.'),
  seat('sales', 'worker', 'pipeline', 'Pipeline', 'Aday müşteri hattı analizi ve önceliklendirme.'),

  // Customer Success (runtime: client-success)
  seat('customer-success', 'head', 'head', 'Head of Customer Success', 'Müşteri ihtiyacı damıtma hattının sahibi.', {
    runtimeAgentName: 'client-success-agent',
    capabilities: STANDARD_DEPT_CAPS,
  }),
  seat('customer-success', 'worker', 'onboarding', 'Onboarding', 'Yeni müşteri başlangıç planı taslakları.'),
  seat('customer-success', 'worker', 'support', 'Support', 'Müşteri sorusu → yapılandırılmış yanıt taslağı.'),

  // Business
  seat('business', 'head', 'head', 'Head of Business', 'İş modeli ve strateji analizinin sahibi.'),
  seat('business', 'worker', 'analyst', 'Analyst', 'Pazar/iş modeli analiz raporu taslakları.'),
  seat('business', 'worker', 'strategy', 'Strategy', 'Fiyatlandırma ve büyüme strateji önerileri.'),

  // Research & Development
  seat('research-development', 'head', 'head', 'Head of R&D', 'Keşif ve deney hattının sahibi.'),
  seat('research-development', 'worker', 'researcher', 'Researcher', 'Yeni teknik/yöntem literatür taraması.'),
  seat('research-development', 'worker', 'prototyper', 'Prototyper', 'Prototip ve deney tasarım taslakları.'),

  // Security
  seat('security', 'head', 'head', 'Head of Security', 'İzin modeli ve veri güvenliği denetiminin sahibi.'),
  seat('security', 'worker', 'auditor', 'Auditor', 'Yetki/izin denetim raporları.'),
  seat('security', 'worker', 'risk', 'Risk', 'Risk kaydı ve azaltım önerileri.'),

  // Office Management
  seat('office-management', 'head', 'head', 'Head of Office Management', 'Şirket içi düzen ve koordinasyonun sahibi.'),
  seat('office-management', 'worker', 'coordinator', 'Coordinator', 'Departmanlar arası süreç takibi.'),
  seat('office-management', 'worker', 'archivist', 'Archivist', 'Kayıt/arşiv düzeni ve raporlama.'),
]

// ── Sorgu yardımcıları ──────────────────────────────────────────────────────

export function listCompanyDepartments(): CompanyDepartment[] {
  return COMPANY_DEPARTMENT_IDS.map((id) => COMPANY_DEPARTMENTS[id])
}

export function getCompanyDepartment(id: string): CompanyDepartment | null {
  return (COMPANY_DEPARTMENT_IDS as readonly string[]).includes(id)
    ? COMPANY_DEPARTMENTS[id as CompanyDepartmentId]
    : null
}

export function listCompanyAgents(filter?: {
  departmentId?: CompanyDepartmentId
  role?: CompanyAgentRole
}): CompanyAgent[] {
  return COMPANY_AGENTS.filter(
    (a) =>
      (!filter?.departmentId || a.departmentId === filter.departmentId) &&
      (!filter?.role || a.role === filter.role),
  )
}

export function getHeadAgent(departmentId: CompanyDepartmentId): CompanyAgent {
  const head = COMPANY_AGENTS.find((a) => a.departmentId === departmentId && a.role === 'head')
  // Her departmanın tam bir head'i vardır — company.test.ts bu değişmezi korur.
  if (!head) throw new Error(`${departmentId} departmanının head koltuğu tanımsız`)
  return head
}

/** Runtime ajan adı → koltuk (Ofis sahnesi ajanları odalara bununla dağıtır). */
export function findSeatByRuntimeAgent(runtimeAgentName: string): CompanyAgent | null {
  return COMPANY_AGENTS.find((a) => a.runtimeAgentName === runtimeAgentName) ?? null
}

/** Planned koltuğun sabit presence'ı — mock veri üretilmez, tek değer yeter. */
export function plannedPresence(): AgentPresence {
  return { status: 'planned', currentTask: null, lastActivityAt: null, runtime: null, health: 'unknown' }
}

// ── Executive Council ───────────────────────────────────────────────────────
// Departman DEĞİL, Company Layer: 13 head koltuğu + başkan Sanchez. İleride
// toplantılar (karar turları) bu yapının üzerinde koşacak.

export const EXECUTIVE_COUNCIL: ExecutiveCouncil = {
  chair: { id: 'sanchez', title: 'Sanchez — Orkestratör' },
  memberAgentIds: COMPANY_DEPARTMENT_IDS.map((id) => getHeadAgent(id).id),
}

// ── Business Intelligence ───────────────────────────────────────────────────
// Her müşteri/iş ileride kendi Brain'ine (scope) sahip olacak; Sprint 7'de
// yalnız liste. Statüler bilinçli 'planned' — canlı scope bağlanınca değişir.

export const BUSINESSES: Business[] = [
  { id: 'emfit', name: 'EmFit', description: 'Fitness işletmesi müşteri Brain’i.', status: 'planned' },
  { id: 'veteriner', name: 'Veteriner', description: 'Veteriner kliniği müşteri Brain’i.', status: 'planned' },
  { id: 'dental', name: 'Dental', description: 'Diş kliniği müşteri Brain’i.', status: 'planned' },
  { id: 'airbnb', name: 'Airbnb', description: 'Kısa dönem kiralama operasyonu Brain’i.', status: 'planned' },
  { id: 'ai-influencer', name: 'AI Influencer', description: 'AI influencer içerik hattı Brain’i.', status: 'planned' },
  { id: 'youtube', name: 'YouTube', description: 'YouTube kanal operasyonu Brain’i.', status: 'planned' },
  { id: 'dropshipping', name: 'Dropshipping', description: 'E-ticaret/dropshipping operasyonu Brain’i.', status: 'planned' },
]
