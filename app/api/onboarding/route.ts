// Onboarding durumu (Faz 2, Görev 3) — istemci yalnızca boş sohbet ekranını
// tanışma moduna çevirmek için okur; senaryonun kendisi sunucuda bağlanır
// (app/api/chat/route.ts system prompt marker'ı). Hata durumunda onboarding
// gösterilmez — normal ekran güvenli varsayılandır.

import { needsOnboarding, resolveSingleUserId } from '@/lib/db-server'

export async function GET() {
  try {
    const userId = await resolveSingleUserId()
    return Response.json({ onboarding: await needsOnboarding(userId) })
  } catch (error) {
    console.error('[api/onboarding] GET hata:', error)
    return Response.json({ onboarding: false })
  }
}
