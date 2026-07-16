'use client'

// MAXAI — ortak layout. Sol nav'daki tek "MAXAİ" item'ının altında URL-bazlı
// 4 ana sekme (Sprint 7 — MAXAI Company Foundation): Ofis (varsayılan),
// Agent Panel, Agent Intelligence, Business Intelligence. Başka ana sekme
// eklenmez; "Agent Brain" adı emekli edildi (/maxai/brain → /maxai/intelligence).

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/maxai/ofis', label: 'Ofis' },
  { href: '/maxai/panel', label: 'Agent Panel' },
  { href: '/maxai/intelligence', label: 'Agent Intelligence' },
  { href: '/maxai/business', label: 'Business Intelligence' },
]

export default function MaxaiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-6 py-3">
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
