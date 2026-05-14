import { createServerClient } from '@supabase/ssr'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function getSupabaseServer() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  return createServerClient(URL, ANON, {
    cookies: {
      getAll()       { return cookieStore.getAll() },
      setAll(list)   {
        try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        catch {}
      },
    },
  })
}
