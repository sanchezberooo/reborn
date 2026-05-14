'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'

const tabs = [
  { href: '/', label: 'Sanchez' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/agent-panel', label: 'Agent Panel' },
]

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header
      className="shrink-0 flex items-stretch justify-between px-5 border-b"
      style={{ height: '52px', background: '#0a0a0a', borderColor: '#1a1a1a' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          style={{ background: 'rgba(200,169,110,0.12)', border: '1px solid rgba(200,169,110,0.2)' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#c8a96e' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="font-display font-semibold text-[17px] tracking-wide" style={{ color: '#c8a96e' }}>
          Reborn
        </span>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-stretch gap-0 flex-1 px-6 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex items-center px-4 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap"
              style={{
                color: active ? '#c8a96e' : '#a0a0a0',
                borderBottomColor: active ? '#c8a96e' : 'transparent',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Right: logout */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ color: '#3a3a3a', border: '1px solid #1a1a1a' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#c86e6e'
            e.currentTarget.style.borderColor = 'rgba(200,110,110,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#3a3a3a'
            e.currentTarget.style.borderColor = '#1a1a1a'
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Çıkış
        </button>
      </div>
    </header>
  )
}
