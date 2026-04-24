'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  {
    href: '/',
    label: 'Chat',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/office',
    label: 'Office',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
  },
]

interface Props {
  orientation: 'vertical' | 'horizontal'
}

export default function Navigation({ orientation }: Props) {
  const pathname = usePathname()

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Logo */}
        <div className="mb-4 text-gold">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>

        {tabs.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              title={tab.label}
              className={`
                flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all duration-150
                ${active
                  ? 'text-gold bg-surface-2'
                  : 'text-muted hover:text-foreground hover:bg-surface-2'
                }
              `}
            >
              {tab.icon}
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-around px-2 py-3">
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`
              flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-all duration-150
              ${active ? 'text-gold' : 'text-muted hover:text-foreground'}
            `}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
