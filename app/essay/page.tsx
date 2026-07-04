import { redirect } from 'next/navigation'

// Navigasyon yeniden yapılandırması: Essay artık üst-seviye sekme değil,
// Dashboard içi bir modül (bkz. lib/module-registry.ts route'u
// '/dashboard/essay'). Sayfa mantığı taşındı — bu dosya yalnız eski
// bağlantıların/bookmark'ların kırılmaması için yönlendirme yapar.
export default function EssayRedirect() {
  redirect('/dashboard/essay')
}
