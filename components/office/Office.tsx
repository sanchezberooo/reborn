'use client'

// Office — Sanchez'in yönettiği AI şirketinin görsel iskeleti (UI v1, v0
// portu). Veri lib/office-data.ts'ten gelen statik Türkçe MOCK'tur; gerçek
// ajan/departman altyapısı (kuyruk, durum makinesi, izleme) Faz 4'ün işidir.

import { useState } from 'react'
import {
  Sparkles,
  X,
  Wrench,
  Brain,
  Activity,
  CircleDollarSign,
  Check,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import SectionHeader from '@/components/SectionHeader'
import { teams, workflow, type Agent, type AgentStatus, type Team } from '@/lib/office-data'

const statusMeta: Record<AgentStatus, { label: string; dot: string; text: string }> = {
  working: { label: 'Çalışıyor', dot: 'bg-success animate-pulse', text: 'text-success' },
  review: { label: 'İncelemede', dot: 'bg-foreground', text: 'text-foreground' },
  idle: { label: 'Boşta', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  blocked: { label: 'Engellendi', dot: 'bg-destructive', text: 'text-destructive' },
}

function healthTone(h: number) {
  if (h >= 95) return 'bg-success'
  if (h >= 80) return 'bg-foreground'
  return 'bg-destructive'
}

function AgentCard({ a, onOpen }: { a: Agent; onOpen: () => void }) {
  const s = statusMeta[a.status]
  return (
    <button
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-ring/40"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-secondary font-mono text-sm font-semibold text-foreground">
          {a.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
          <p className="truncate text-xs text-muted-foreground">{a.role}</p>
        </div>
        <span className={cn('flex items-center gap-1.5 text-2xs', s.text)}>
          <span className={cn('size-1.5 rounded-full', s.dot)} />
          {s.label}
        </span>
      </div>
      <p className="text-sm text-foreground/90">{a.task}</p>
      <div>
        <div className="mb-1 flex justify-between text-2xs text-muted-foreground">
          <span>İlerleme</span>
          <span>{a.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${a.progress}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between text-2xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Activity className="size-3.5" /> Sağlık {a.health}
        </span>
        <span className="flex items-center gap-1.5">
          <CircleDollarSign className="size-3.5" /> {a.costToday}
        </span>
      </div>
    </button>
  )
}

function AgentDrawer({ a, team, onClose }: { a: Agent; team: Team; onClose: () => void }) {
  const s = statusMeta[a.status]
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="no-scrollbar relative z-10 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-secondary font-mono text-base font-semibold text-foreground">
              {a.name[0]}
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{a.name}</h2>
              <p className="text-xs text-muted-foreground">
                {a.role} · {team.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Kapat">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
            <span className={cn('flex items-center gap-2 text-sm font-medium', s.text)}>
              <span className={cn('size-2 rounded-full', s.dot)} /> {s.label}
            </span>
            <span className="text-sm text-muted-foreground">bugün {a.costToday}</span>
          </div>

          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Mevcut görev</p>
            <p className="text-sm text-foreground">{a.task}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${a.progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <p className="mb-1 text-2xs text-muted-foreground">Sağlık</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground">{a.health}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className={cn('h-full rounded-full', healthTone(a.health))} style={{ width: `${a.health}%` }} />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-3">
              <p className="mb-1 text-2xs text-muted-foreground">İlerleme</p>
              <span className="text-lg font-semibold text-foreground">{a.progress}%</span>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Wrench className="size-3.5" /> Araçlar
            </p>
            <div className="flex flex-wrap gap-2">
              {a.tools.map((t) => (
                <span key={t} className="rounded-lg bg-secondary px-2.5 py-1 text-xs text-foreground">{t}</span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Brain className="size-3.5" /> Hafıza
            </p>
            <p className="rounded-xl border border-border bg-background/40 p-3 text-sm text-muted-foreground">{a.memory}</p>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Activity className="size-3.5" /> Son etkinlik ve loglar
            </p>
            <div className="flex flex-col">
              {a.activity.map((act, i) => (
                <div key={i} className="flex gap-3 border-l border-border py-2 pl-3">
                  <span className="w-12 shrink-0 text-2xs text-muted-foreground">{act.time}</span>
                  <span className="text-sm text-foreground/90">{act.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

const wfState = {
  done: { icon: Check, ring: 'border-success text-success', line: 'bg-success' },
  active: { icon: Circle, ring: 'border-foreground text-foreground animate-pulse', line: 'bg-foreground/40' },
  queued: { icon: Circle, ring: 'border-border text-muted-foreground', line: 'bg-border' },
}

export default function Office() {
  const [activeTeam, setActiveTeam] = useState('research')
  const [openAgent, setOpenAgent] = useState<Agent | null>(null)

  const team = teams.find((t) => t.id === activeTeam)!
  const totalAgents = teams.reduce((n, t) => n + t.agents.length, 0)
  const working = teams.reduce((n, t) => n + t.agents.filter((a) => a.status === 'working').length, 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeader title="Office" subtitle="Senin AI şirketin. CEO'su Sanchez.">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{totalAgents} ajan</span>
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" /> {working} çalışıyor</span>
          <span>bugün $5.60</span>
        </div>
      </SectionHeader>

      <div className="flex min-h-0 flex-1">
        {/* Departman rayı */}
        <div className="no-scrollbar hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-sidebar p-3 md:block">
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-secondary/60 p-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-primary/40">
              <Sparkles className="size-4 text-primary-foreground" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Sanchez</p>
              <p className="text-2xs text-muted-foreground">Genel Müdür</p>
            </div>
          </div>
          <p className="px-2 py-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Departmanlar</p>
          {teams.map((t) => {
            const Icon = t.icon
            const active = t.id === activeTeam
            const busy = t.agents.some((a) => a.status === 'working')
            return (
              <button
                key={t.id}
                onClick={() => setActiveTeam(t.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                  active ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                )}
              >
                <Icon className={cn('size-4', active && 'text-primary')} strokeWidth={1.75} />
                <span className="flex-1 text-sm">{t.name}</span>
                {busy && <span className="size-1.5 rounded-full bg-success" />}
                <span className="text-2xs text-muted-foreground">{t.agents.length}</span>
              </button>
            )
          })}
        </div>

        {/* Ana alan */}
        <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto p-6">
          {/* Workflow */}
          <section className="mb-8 rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Aktif workflow · Günlük burs taraması</h2>
                <p className="text-xs text-muted-foreground">Relay yönetiyor · her sabah 06:00&apos;da çalışır</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-2xs text-success">
                <span className="size-1.5 animate-pulse rounded-full bg-success" /> Çalışıyor
              </span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {workflow.map((step, i) => {
                const st = wfState[step.state]
                const Icon = st.icon
                return (
                  <div key={step.name} className="flex items-center gap-1">
                    <div className="flex min-w-[92px] flex-col items-center gap-1.5">
                      <span className={cn('flex size-8 items-center justify-center rounded-full border-2 bg-card', st.ring)}>
                        <Icon className="size-3.5" strokeWidth={2.5} />
                      </span>
                      <span className="text-xs font-medium text-foreground">{step.name}</span>
                      <span className="text-3xs text-muted-foreground">{step.agent}</span>
                    </div>
                    {i < workflow.length - 1 && <span className={cn('h-0.5 w-6 rounded-full', st.line)} />}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Departman başlığı */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-secondary">
              <team.icon className="size-5 text-foreground/80" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{team.name}</h2>
              <p className="text-sm text-muted-foreground">{team.mission}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {team.agents.map((a) => (
              <AgentCard key={a.id} a={a} onOpen={() => setOpenAgent(a)} />
            ))}
          </div>
        </div>
      </div>

      {openAgent && <AgentDrawer a={openAgent} team={team} onClose={() => setOpenAgent(null)} />}
    </div>
  )
}
