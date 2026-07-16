// MAXAİ departman modeli — Department / Role / Capability / Permission
// sözlüğü (Sprint 2). Yalnız tip + sabit içerir; runtime bağımlılığı yok,
// her yerden import edilebilir (lib/brain/types.ts deseni).
//
// YERİ: Sanchez bir departman DEĞİLDİR — tek muhatap ilkesi gereği tüm
// departmanların ÜSTÜNDE durur ve tam tool setiyle çalışır. Bu model MAXAİ
// ajanlarının organizasyonunu ve yetki sözleşmesini tanımlar; ajan tanımları
// lib/agents/registry.ts'te yaşar ve department alanıyla buraya bağlanır
// (tek doğruluk kaynağı: ajan→departman ataması AGENTS'tadır, burada ajan
// listesi TUTULMAZ — çift kaynak olurdu).
//
// İZİN MODELİ (Sprint 1 kararının kodu): ayrım bu fazda yapısal/isimseldir —
// gerçek yetkilendirme (Auth/RLS) yok; uygulama registry toolNames listeleri
// + validateRoster testiyle yapılır. Dış-eylem yetenekleri (external.*)
// v1'de İSTİSNASIZ yasak: izin/onay katmanı tasarlanmadan hiçbir departman
// dış dünyaya eylem alamaz. 'approval-required' etkisi o gelecek katmanın
// sözleşmesidir — v1'de hiçbir permission bu etkiyi kullanmaz.

/** MAXAİ departmanları. 'legacy' gerçek bir departman değil, emekli ajanların
 *  (deprecated) geriye-uyumluluk rafıdır — yeni ajan 'legacy'ye AÇILMAZ. */
export const DEPARTMENT_IDS = [
  'knowledge',
  'growth',
  'creative',
  'builder',
  'client-success',
  'operations',
  'legacy',
] as const
export type DepartmentId = (typeof DEPARTMENT_IDS)[number]

/** Sistem yetenek sözlüğü — her tool tam olarak BİR yeteneğe eşlenir
 *  (eşleme: lib/departments/registry.ts TOOL_CAPABILITIES). */
export const CAPABILITY_IDS = [
  // Agent Brain erişimi
  'brain.read',          // brain_get_node — node okuma/keşif
  'brain.link',          // brain_link — graf kenarı kurma
  'brain.signals.read',  // brain_read_signals — sıcak katman taraması (privileged)
  'brain.integrate',     // brain_integrate — soğuk katmana damıtma (privileged)
  // Dış kaynak okuma (salt okuma, domain whitelist'li)
  'source.fetch',        // fetch_source_overview / fetch_source_content
  // Sağlayıcı web araması (AgentDefinition.webSearch bayrağı)
  'web.search',
  // Life OS verisi (Personal Brain silo tabloları)
  'life-data.read',      // read_* tool ailesi
  'life-data.write',     // save_* / update_* / toggle_* / add_* ailesi
  // Orkestrasyon ve iz
  'agents.delegate',     // run_agent — yalnız Sanchez kullanır (senkron çalıştırma)
  'tasks.delegate',      // delegate_task — iş emri açma (asenkron kuyruk, Sprint 3)
  'ops.log',             // log_agent_action
  // Dış-eylem yetenekleri — v1'de HİÇBİR departmana verilemez (aşağıya bkz.)
  'external.publish',    // içerik yayınlama (sosyal medya, blog, deploy…)
  'external.message',    // insanlara mesaj gönderme (mail, DM…)
  'external.spend',      // bütçe harcama (reklam, satın alma…)
  'external.mutate',     // dış sistem durumu değiştirme (config, servis…)
] as const
export type CapabilityId = (typeof CAPABILITY_IDS)[number]

/** İzin/onay katmanı tasarlanana kadar (Sprint 1 kararı) istisnasız yasak
 *  yetenekler — validateRoster bunlara verilen her izni ihlal sayar. */
export const EXTERNAL_ACTION_CAPABILITIES = [
  'external.publish',
  'external.message',
  'external.spend',
  'external.mutate',
] as const satisfies readonly CapabilityId[]

/** allowed: serbest · approval-required: gelecekteki onay katmanından geçer
 *  (v1'de kullanılmaz) · forbidden: açık yasak. Bir departmanın permission
 *  listesinde GEÇMEYEN her yetenek de yasaktır (default-deny). */
export type PermissionEffect = 'allowed' | 'approval-required' | 'forbidden'

export interface Permission {
  capability: CapabilityId
  effect: PermissionEffect
}

/** Departman içi rol — v1'de her departman tek rollüdür (tek ajan). Rol,
 *  organizasyon semantiğidir; ajan ataması AGENTS.department üzerindendir. */
export interface DepartmentRole {
  id: string
  title: string
  mission: string
}

export interface Department {
  id: DepartmentId
  displayName: string
  mission: string
  roles: DepartmentRole[]
  /** Default-deny: burada 'allowed' olmayan her yetenek bu departmanda yasak. */
  permissions: Permission[]
}
