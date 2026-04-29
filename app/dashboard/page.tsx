'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { loadModules } from '@/lib/modules'
import type { ModuleItem } from '@/lib/modules'

// ─── habit helpers (same store as /aliskanlik) ────────────────────────────────

const HABIT_IDS = ['sleep','eat','social','water','study','exercise','read','journal','plan']

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayISO() { return localISO(new Date()) }

function loadHabitLogs(): Record<string, boolean> {
  try { const r = localStorage.getItem('reborn:habit_logs'); return r ? JSON.parse(r) : {} }
  catch { return {} }
}

function weekDates(ref: Date): Date[] {
  const d = new Date(ref)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i); return x
  })
}

// ─── card base ────────────────────────────────────────────────────────────────

function Card({
  href, color, icon, title, children, dimmed,
}: {
  href: string
  color: string
  icon: string
  title: string
  children: React.ReactNode
  dimmed?: boolean
}) {
  return (
    <Link
      href={href}
      className="group bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-border/70 transition-all duration-150 min-h-[150px]"
      style={{ borderTopColor: color, borderTopWidth: '2px', opacity: dimmed ? 0.55 : 1 }}
    >
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{icon}</span>
        <span className="text-[11px] font-semibold text-muted/60 uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex-1 flex flex-col justify-between gap-2">
        {children}
      </div>
    </Link>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] text-muted/60 w-7 text-right">{pct}%</span>
    </div>
  )
}

// ─── individual cards ────────────────────────────────────────────────────────

function AliskanlikCard({ logs }: { logs: Record<string, boolean> }) {
  const today    = todayISO()
  const days     = weekDates(new Date(today))
  const total    = days.length * HABIT_IDS.length
  const done     = days.reduce(
    (s, d) => s + HABIT_IDS.filter((hid) => logs[`${localISO(d)}|${hid}`]).length, 0,
  )
  const pct      = Math.round((done / total) * 100)
  const todayN   = HABIT_IDS.filter((hid) => logs[`${today}|${hid}`]).length
  const color    = pct >= 70 ? '#6ec8a9' : pct >= 40 ? '#c8a96e' : '#c86e6e'

  return (
    <Card href="/aliskanlik" color="#c8956e" icon="🔥" title="Alışkanlık">
      <div>
        <p className="text-lg font-semibold text-foreground">
          {todayN}<span className="text-sm text-muted font-normal">/{HABIT_IDS.length}</span>
          <span className="text-xs text-muted font-normal ml-2">bugün</span>
        </p>
      </div>
      <Bar pct={pct} color={color} />
      <p className="text-[11px] text-muted/50">Bu hafta {done}/{total} tamamlandı</p>
    </Card>
  )
}

function GunlukCard({ mod }: { mod: ModuleItem | null }) {
  const entries = (mod?.data?.entries as Array<{date:string;mood?:string;free_write?:string}>) ?? []
  const today   = todayISO()
  const todayEntry = entries.find((e) => e.date === today)
  const last    = entries[entries.length - 1]

  return (
    <Card href="/dashboard/daily" color="#c86e9a" icon="📓" title="Günlük">
      {todayEntry ? (
        <>
          <p className="text-2xl leading-none">{todayEntry.mood ?? '—'}</p>
          <p className="text-[11px] text-muted/70 line-clamp-2 leading-relaxed">
            {todayEntry.free_write ? todayEntry.free_write.slice(0, 80) + '…' : 'Bugün yazı yok.'}
          </p>
        </>
      ) : last ? (
        <>
          <p className="text-[11px] text-muted/50">Son kayıt: {last.date}</p>
          <p className="text-[11px] text-muted/70 line-clamp-2 leading-relaxed">
            {last.free_write ? last.free_write.slice(0, 80) + '…' : '—'}
          </p>
        </>
      ) : (
        <p className="text-[11px] text-muted/40 italic">Henüz günlük yok.</p>
      )}
    </Card>
  )
}

function FinansCard({ mod }: { mod: ModuleItem | null }) {
  const now    = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const income   = ((mod?.data?.income   as Array<{date:string;amount:number}>) ?? [])
    .filter((r) => r.date?.startsWith(prefix))
    .reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const expenses = ((mod?.data?.expenses as Array<{date:string;amount:number}>) ?? [])
    .filter((r) => r.date?.startsWith(prefix))
    .reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const balance  = income - expenses

  return (
    <Card href="/dashboard/finance" color="#6ec8a9" icon="💰" title="Finans">
      <div>
        <p className={`text-lg font-semibold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {balance >= 0 ? '+' : ''}₺{balance.toLocaleString('tr-TR')}
        </p>
        <p className="text-[11px] text-muted/50 mt-0.5">Bu ay net bakiye</p>
      </div>
      <div className="flex gap-4 text-[11px]">
        <span className="text-emerald-400/70">↑ ₺{income.toLocaleString('tr-TR')}</span>
        <span className="text-red-400/70">↓ ₺{expenses.toLocaleString('tr-TR')}</span>
      </div>
    </Card>
  )
}

function BedenCard({ mod }: { mod: ModuleItem | null }) {
  const today     = todayISO()
  const workouts  = (mod?.data?.workouts as Array<{date:string;type?:string}>) ?? []
  const todayWork = workouts.find((w) => w.date === today)
  const lastWork  = [...workouts].reverse()[0]

  return (
    <Card href="/dashboard/body" color="#956ec8" icon="⚡" title="Beden">
      {todayWork ? (
        <>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-emerald-400">Bugün yapıldı</span>
          </div>
          <p className="text-[11px] text-muted/60">{todayWork.type ?? 'Antrenman'}</p>
        </>
      ) : (
        <>
          <p className="text-[11px] text-muted/50">Bugün antrenman yok.</p>
          {lastWork && (
            <p className="text-[11px] text-muted/40">Son: {lastWork.date} · {lastWork.type ?? '—'}</p>
          )}
        </>
      )}
    </Card>
  )
}

function IeltsCard({ mod }: { mod: ModuleItem | null }) {
  const target    = (mod?.data?.ielts_target as string) ?? '7.0+'
  const examDate  = (mod?.data?.ielts_date   as string) ?? 'Eylül 2026'
  const level     = (mod?.data?.current_level as string) ?? '—'
  const words     = ((mod?.data?.words as unknown[]) ?? []).length

  // days until Sep 2026
  const daysLeft = Math.max(0, Math.ceil(
    (new Date('2026-09-01').getTime() - Date.now()) / 86400000,
  ))

  return (
    <Card href="/dashboard/english" color="#6eb5c8" icon="📚" title="İngilizce / IELTS">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-foreground">{daysLeft}</span>
        <span className="text-xs text-muted">gün kaldı</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] text-muted/60">Hedef: <span className="text-gold">{target}</span> · {examDate}</p>
        <p className="text-[11px] text-muted/50">Seviye: {level} · {words} kelime</p>
      </div>
    </Card>
  )
}

function RoadmapCard({ mod }: { mod: ModuleItem | null }) {
  const milestones = ((mod?.data?.milestones as Array<{title:string;date:string;status?:string}>) ?? [])
    .filter((m) => m.status !== 'done')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const next = milestones[0]
  const focus = (mod?.data?.current_focus as string) ?? ''

  return (
    <Card href="/dashboard/roadmap" color="#8ec86e" icon="🗺️" title="Yol Haritası">
      {next ? (
        <>
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{next.title}</p>
          <p className="text-[11px] text-muted/60">📅 {next.date}</p>
        </>
      ) : focus ? (
        <p className="text-sm font-medium text-foreground">{focus}</p>
      ) : (
        <p className="text-[11px] text-muted/40 italic">Milestone eklenmemiş.</p>
      )}
    </Card>
  )
}

function KesifCard({ mod }: { mod: ModuleItem | null }) {
  const books   = ((mod?.data?.books   as Array<{title:string;author?:string;status?:string}>) ?? [])
  const courses = ((mod?.data?.courses as Array<{name:string;platform?:string}>) ?? [])
  const lastBook   = books[books.length - 1]
  const lastCourse = courses[courses.length - 1]

  return (
    <Card href="/dashboard/discover" color="#c86e6e" icon="🔭" title="Keşif">
      {lastBook && (
        <div>
          <p className="text-[10px] text-muted/40 uppercase tracking-wider mb-0.5">Kitap</p>
          <p className="text-sm font-medium text-foreground line-clamp-1">{lastBook.title}</p>
          {lastBook.author && <p className="text-[11px] text-muted/50">{lastBook.author}</p>}
        </div>
      )}
      {lastCourse && (
        <div>
          <p className="text-[10px] text-muted/40 uppercase tracking-wider mb-0.5">Kurs</p>
          <p className="text-[11px] text-foreground/70 line-clamp-1">{lastCourse.name}</p>
        </div>
      )}
      {!lastBook && !lastCourse && (
        <p className="text-[11px] text-muted/40 italic">Henüz içerik eklenmemiş.</p>
      )}
    </Card>
  )
}

function AgentCard() {
  return (
    <Card href="/agent-panel" color="#c8a96e" icon="🤖" title="Agent Panel">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-muted/40" />
        <span className="text-sm font-medium text-muted/70">7 agent hazır</span>
      </div>
      <p className="text-[11px] text-muted/40">Agent ofisini aç →</p>
    </Card>
  )
}

function ArsivCard({ mod }: { mod: ModuleItem | null }) {
  const entries = ((mod?.data?.entries as Array<{date:string;summary?:string}>) ?? [])
  const last    = [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]

  return (
    <Card href="/dashboard/daily" color="#4a5568" icon="🗂️" title="Arşiv" dimmed={!last}>
      {last ? (
        <>
          <p className="text-[11px] text-muted/60">Son kayıt: <span className="text-foreground/70">{last.date}</span></p>
          {last.summary && (
            <p className="text-[11px] text-muted/50 line-clamp-2 leading-relaxed">{last.summary}</p>
          )}
        </>
      ) : (
        <p className="text-[11px] text-muted/40 italic">Kayıt yok.</p>
      )}
    </Card>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [logs,    setLogs]    = useState<Record<string, boolean>>({})

  useEffect(() => {
    setLogs(loadHabitLogs())
    try { setModules(loadModules()) } catch {}

    function onUpdate() {
      try { setModules(loadModules()) } catch {}
    }
    window.addEventListener('reborn:modules-updated', onUpdate)
    return () => window.removeEventListener('reborn:modules-updated', onUpdate)
  }, [])

  function mod(id: string) { return modules.find((m) => m.id === id) ?? null }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Reborn — genel bakış</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <AliskanlikCard logs={logs} />
          <GunlukCard     mod={mod('daily')} />
          <FinansCard     mod={mod('finance')} />
          <BedenCard      mod={mod('body')} />
          <IeltsCard      mod={mod('english')} />
          <RoadmapCard    mod={mod('roadmap')} />
          <KesifCard      mod={mod('discover')} />
          <AgentCard />
          <ArsivCard      mod={mod('daily')} />
        </div>

      </div>
    </div>
  )
}
