'use client'

// Navigasyon v1 (UI v1, nötr dil) — 4 kalıcı bölüm: Sanchez, Dashboard,
// MAXAİ, Brain (roadmap §6.1). Yeni üst seviye sekme EKLENMEZ; büyüme bu
// dördünün içinde olur. Ayarlar 5. sekme değildir — sol alttaki profil
// avatarından açılan panelde yaşar (SettingsPanel).

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, LayoutGrid, Building2, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import SettingsPanel from './SettingsPanel'
import GlobalSearch from './search/GlobalSearch'

const items = [
  { href: '/', label: 'Sanchez', icon: Sparkles },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/maxai', label: 'MAXAİ', icon: Building2 },
  { href: '/brain', label: 'Brain', icon: Brain },
]

export default function AppNav() {
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <nav className="flex h-full w-[76px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-4">
        <Link
          href="/"
          className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          aria-label="Reborn ana sayfa"
        >
          <span className="font-mono text-lg font-semibold">R</span>
        </Link>

        <div className="flex flex-1 flex-col items-center gap-1">
          {items.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 transition-colors',
                  active
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                )}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 h-6 -translate-y-1/2 -translate-x-[13px] rounded-r-full bg-primary"
                    style={{ width: 3 }}
                  />
                )}
                <Icon className={cn('size-[20px]', active && 'text-primary')} strokeWidth={1.75} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            )
          })}
        </div>

        <GlobalSearch />

        <button
          onClick={() => setSettingsOpen(true)}
          className="mt-1 flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-xs font-bold text-foreground transition-colors hover:border-ring/40"
          aria-label="Profil ve ayarlar"
        >
          B
        </button>
      </nav>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
