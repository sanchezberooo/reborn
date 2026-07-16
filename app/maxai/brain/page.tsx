import { redirect } from 'next/navigation'

// "Agent Brain" adı Sprint 7'de emekli edildi — bu ekranın yerini Agent
// Intelligence aldı. Eski URL kırılmasın diye route kalıcı yönlendirir.
export default function MaxaiBrainPage() {
  redirect('/maxai/intelligence')
}
