'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Chat' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/agent-panel', label: 'Agent Panel' },
  { href: '/community', label: 'Topluluk' },
]

export default function Header() {
  const pathname = usePathname()

  return (
    <header className="shrink-0 flex items-stretch justify-between px-5 bg-background border-b border-border" style={{ height: '52px' }}>
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-gold/15 border border-gold/25 flex items-center justify-center shrink-0">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-gold">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="font-display text-gold font-semibold text-[17px] tracking-wide">Reborn</span>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-stretch gap-0">
        {tabs.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center px-5 text-sm font-medium border-b-2 transition-all duration-150 ${
                active
                  ? 'text-gold border-gold'
                  : 'text-muted hover:text-foreground border-transparent'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
