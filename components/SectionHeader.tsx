// Bölüm başlığı — 4 ana bölümün (Dashboard, Office, Brain) ortak üst şeridi.
// v0 portu; nötr dil.

import type { LucideIcon } from 'lucide-react'
import type React from 'react'

export default function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon?: LucideIcon
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
            <Icon className="size-[18px]" strokeWidth={1.75} />
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground text-balance">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  )
}
