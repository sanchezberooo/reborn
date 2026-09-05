import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Auth-aware browser client — attaches session JWT automatically
export function getSupabaseBrowser() {
  return createBrowserClient(URL, ANON)
}

// Anon client — kept for backward compat; use auth-aware clients for RLS.
// Proxy ile lazy: gerçek createClient() ilk property erişiminde çalışır,
// modül import edilir edilmez DEĞİL — env değişkenleri yoksa (CI, next
// build'in credential'sız modül yükleme geçişi) import anında patlamaz.
// Fonksiyonlar realClient'a bind edilir (Reflect.get + receiver=proxy DEĞİL):
// supabase-js istemcisi private class field kullanıyor, `this` proxy'ye
// düşerse "private member" hatası fırlatır.
let realClient: SupabaseClient | null = null
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    realClient ??= createClient(URL, ANON)
    const value = Reflect.get(realClient, prop, realClient)
    return typeof value === 'function' ? value.bind(realClient) : value
  },
})
