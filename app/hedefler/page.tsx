import { redirect } from 'next/navigation'

// Navigasyon yeniden yapılandırması: Hedefler artık üst-seviye sekme değil,
// Dashboard içi bir modül (bkz. lib/module-registry.ts route'u
// '/dashboard/hedefler'). Sayfa mantığı taşındı — bu dosya yalnız eski
// bağlantıların/bookmark'ların kırılmaması için yönlendirme yapar.
export default function HedeflerRedirect() {
  redirect('/dashboard/hedefler')
}
