'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { loadMemories } from '@/lib/memory'
import type { Memory } from '@/lib/memory'

const navItems = [
  {
    href: '/',
    label: 'Chat',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/office',
    label: 'Agent Panel',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    href: '/community',
    label: 'Topluluk',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
]

export default function Navigation() {
  const pathname = usePathname()
  const [memories, setMemories] = useState<Memory[]>([])

  const refresh = useCallback(() => {
    setMemories(loadMemories())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('reborn:new-memory', refresh)
    return () => window.removeEventListener('reborn:new-memory', refresh)
  }, [refresh])

  const isChat = pathname === '/'

  function triggerNewChat() {
    window.dispatchEvent(new CustomEvent('reborn:new-chat'))
  }

  return (
    <aside className="w-[260px] h-full flex flex-col border-r border-border bg-surface shrink-0">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/25 flex items-center justify-center shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-gold">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="font-display text-gold font-semibold text-[17px] tracking-wide">Reborn</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">

        {/* Nav tabs */}
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-gold/10 text-gold'
                      : 'text-muted hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <span className={`shrink-0 ${active ? 'text-gold' : 'text-muted'}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>

                {/* Chat history — only under Chat tab when on / */}
                {item.href === '/' && isChat && (
                  <div className="mt-1 mb-1.5">
                    {/* New Chat button */}
                    <button
                      onClick={triggerNewChat}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gold hover:bg-gold/10 rounded-xl transition-colors font-medium"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Yeni Sohbet
                    </button>

                    {/* Past conversations */}
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {memories.length === 0 ? (
                        <p className="px-3 py-1.5 text-[11px] text-muted/40">
                          Henüz sohbet yok
                        </p>
                      ) : (
                        memories.map((m) => (
                          <div
                            key={m.id}
                            className="group flex items-start px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-muted group-hover:text-foreground/80 line-clamp-2 leading-snug transition-colors">
                                {m.summary}
                              </p>
                              <p className="text-[10px] text-muted/35 mt-0.5">{m.date}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
