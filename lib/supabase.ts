import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Auth-aware browser client — attaches session JWT automatically
export function getSupabaseBrowser() {
  return createBrowserClient(URL, ANON)
}

// Anon client — kept for backward compat; use auth-aware clients for RLS
export const supabase = createClient(URL, ANON)
