// Modül çerçevesi v1 (Faz 2, Görev 4) — aç/kapat altyapısı.
//
// lib/modules.ts ile KARIŞTIRMA: o dosya legacy `modules` tablosunun
// (jsonb `data` çuvalı) tip/varsayılan tanımlarıdır ve bir aç/kapat
// çerçevesi DEĞİLDİR. Bu dosya onun yanına kurulan yeni, bağımsız
// sistemdir: hangi modüllerin UI'da görünür olduğunu yönetir; veriye
// hiç dokunmaz. Modül kapatmak = yalnız görünürlük tercihi yazmak
// (profiles.module_settings); entities/goals/journal_* satırları
// olduğu gibi kalır (roadmap Faz 2 kriteri: "Bir modül kapatıldığında
// UI'dan kayboluyor, verisi korunuyor").
//
// Tasarım: yalnız SAPMALAR saklanır (override haritası). Kayıt yoksa
// modül AÇIK kabul edilir — böylece ileride eklenen yeni modüller
// (fitness, finance, ...) migration/veri işi gerektirmeden varsayılan
// açık doğar ve boş '{}' değeri "her şey açık" demektir.

export interface ModuleDef {
  /** Kalıcı kimlik — profiles.module_settings anahtarı. Değiştirme. */
  id: string
  name: string
  icon: string
  route: string
}

/** Çerçevenin üyeleri. Yeni modül eklemek = buraya satır eklemek;
 *  görünürlük (Dashboard kartı, route kapısı, ayar anahtarı) kayıttan türer.
 *
 *  Navigasyon yeniden yapılandırması (üst nav 4 sabit sekmeye indirildi —
 *  Sanchez/Dashboard/MAXAİ/Brain, bkz. components/AppNav.tsx): modül route'ları artık üst
 *  seviyede DEĞİL, /dashboard altında yaşar (ör. /dashboard/gunluk). Header
 *  bu registry'den artık sekme türetmiyor — yalnız ModuleGate (route kapısı)
 *  ve Dashboard'un kart listesi kullanıyor. Eski üst-seviye route'lar
 *  (app/gunluk, app/hedefler, app/essay) yeni yola redirect eden birer
 *  yer tutucudur. */
export const MODULE_REGISTRY: readonly ModuleDef[] = [
  { id: 'journal', name: 'Günlük',   icon: '📓', route: '/dashboard/gunluk' },
  { id: 'goals',   name: 'Hedefler', icon: '🎯', route: '/dashboard/hedefler' },
  { id: 'essay',   name: 'Essay',    icon: '✍️', route: '/dashboard/essay' },
]

/** profiles.module_settings içeriği: { [moduleId]: false } — yalnız
 *  kapatılanlar yazılır; true değerler normalize edilip silinir. */
export type ModuleSettings = Record<string, boolean>

export const MODULE_SETTINGS_EVENT = 'reborn:module-settings-updated'

export function isModuleEnabled(settings: ModuleSettings, moduleId: string): boolean {
  return settings[moduleId] !== false
}

export function activeModules(settings: ModuleSettings): ModuleDef[] {
  return MODULE_REGISTRY.filter((m) => isModuleEnabled(settings, m.id))
}

/** Toggle'ı override haritasına uygular (saf — DB'ye yazmaz).
 *  Açmak anahtarı SİLER (varsayılan zaten açık), kapatmak false yazar. */
export function applyModuleToggle(
  settings: ModuleSettings,
  moduleId: string,
  enabled: boolean,
): ModuleSettings {
  const next = { ...settings }
  if (enabled) delete next[moduleId]
  else next[moduleId] = false
  return next
}

/** Pathname hangi modülün alanındaysa onu döner (route kapısı için). */
export function moduleForPath(pathname: string): ModuleDef | undefined {
  return MODULE_REGISTRY.find(
    (m) => pathname === m.route || pathname.startsWith(m.route + '/'),
  )
}
