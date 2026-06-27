'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Sanchez' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/agent-panel', label: 'Agent Panel' },
]

export default function Header() {
  const pathname = usePathname()

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

    </header>
  )
}
