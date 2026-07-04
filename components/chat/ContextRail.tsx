'use client'

// Sanchez bağlam rayı (UI v1) — sohbetin sağında, Sanchez'in "neyi bildiğini"
// gösteren pasif panel. Şimdilik MOCK içerik (lib/context-rail-data.ts);
// gerçek veri bağlantısı sonraki adım. xl altı ekranlarda gizlenir.

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, Target, CircleDot, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  todayFocus,
  activeGoals,
  memoryInsights,
  runningAgents,
  suggestedActions,
} from '@/lib/context-rail-data'

function Panel({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: { label: string; href: string }
}) {
  return (
    <section className="border-b border-border px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {action && (
          <Link href={action.href} className="text-2xs text-foreground/70 hover:text-foreground hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export default function ContextRail() {
  const [focus, setFocus] = useState(todayFocus)

  return (
    <aside className="no-scrollbar hidden w-[336px] shrink-0 overflow-y-auto border-l border-border bg-sidebar xl:block">
      <Panel title="Bugünün odağı" action={{ label: 'Dashboard', href: '/dashboard' }}>
        <div className="flex flex-col gap-1">
          {focus.map((t) => (
            <button
              key={t.id}
              onClick={() => setFocus((f) => f.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent/60"
            >
              <span
                className={cn(
                  'flex size-4 items-center justify-center rounded-md border transition-colors',
                  t.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                )}
              >
                {t.done && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className={cn('flex-1 text-sm', t.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                {t.label}
              </span>
              <span className="text-3xs text-muted-foreground">{t.area}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Aktif hedefler" action={{ label: 'Tümü', href: '/dashboard/hedefler' }}>
        <div className="flex flex-col gap-3">
          {activeGoals.map((g) => (
            <div key={g.id}>
              <div className="mb-1.5 flex items-center gap-2">
                <Target className="size-3.5 text-foreground/70" strokeWidth={1.75} />
                <span className="flex-1 truncate text-sm text-foreground">{g.title}</span>
                <span className="text-xs font-medium text-muted-foreground">{g.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${g.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Hafıza içgörüleri">
        <div className="flex flex-col gap-2.5">
          {memoryInsights.map((m, i) => (
            <div key={i} className="flex gap-2.5">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-foreground/70" strokeWidth={1.75} />
              <p className="text-sm leading-snug text-muted-foreground">{m}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Çalışan ajanlar" action={{ label: 'Office', href: '/office' }}>
        <div className="flex flex-col gap-3">
          {runningAgents.map((a) => (
            <div key={a.name} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-center gap-2">
                <CircleDot className="size-3.5 animate-pulse text-success" strokeWidth={2} />
                <span className="text-sm font-medium text-foreground">{a.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{a.pct}%</span>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">{a.task}</p>
              <div className="h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-success" style={{ width: `${a.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Önerilen eylemler">
        <div className="flex flex-col gap-1">
          {suggestedActions.map((s) => (
            <button
              key={s}
              className="group flex items-center gap-2 rounded-lg px-1.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-sidebar-accent/60"
            >
              <span className="flex-1">{s}</span>
              <ArrowRight
                className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                strokeWidth={1.75}
              />
            </button>
          ))}
        </div>
      </Panel>
    </aside>
  )
}
