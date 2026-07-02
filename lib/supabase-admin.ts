import { createClient } from '@supabase/supabase-js'

/**
 * Sunucu tarafı admin client. SUPABASE_SERVICE_ROLE_KEY yoksa sessizce
 * anon key'e düşmez — bilerek hata fırlatır. Eskiden `SERVICE_ROLE_KEY ??
 * ANON_KEY` deseni RLS korumalı tabloları anon yetkisiyle sorguluyordu ve
 * bu hiç fark edilmiyordu (bkz. REBORN-DURUM-RAPORU.md §6 madde 2).
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL eksik. .env.local dosyasına ekle.')
  }
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY eksik. Supabase Dashboard > Project Settings > API > ' +
      '"service_role" (secret) key değerini .env.local dosyasına SUPABASE_SERVICE_ROLE_KEY ' +
      'olarak ekle. Bu key olmadan sunucu route\'ları RLS korumalı tablolara (memories, ' +
      'modules, conversations, habits, agent_runs vb.) güvenli şekilde erişemez.'
    )
  }

  return createClient(url, key)
}
