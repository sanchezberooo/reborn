'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── types ────────────────────────────────────────────────────────────────────

interface Habit {
  id: string
  name: string
  icon: string
  color: string
}

type LogStore = Record<string, boolean> // key: `${date}|${habitId}`

// ─── constants ────────────────────────────────────────────────────────────────

const LOGS_KEY = 'reborn:habit_logs'
const BERO_ID  = process.env.NEXT_PUBLIC_BERO_ID ?? '00000000-0000-0000-0000-000000000001'

const DEFAULT_HABITS: Habit[] = [
  { id: 'sleep',    name: 'Uyku 7-8 saat',        icon: '😴', color: '#6eb5c8' },
  { id: 'eat',      name: 'Sağlıklı beslen',       icon: '🥗', color: '#6ec8a9' },
  { id: 'social',   name: 'Sos. medya max 90dk',  icon: '📵', color: '#c86e6e' },
  { id: 'water',    name: '2L su iç',              icon: '💧', color: '#5ab8d4' },
  { id: 'study',    name: '2 saat çalış',          icon: '📖', color: '#c8a96e' },
  { id: 'exercise', name: '30dk egzersiz',         icon: '🏃', color: '#c8956e' },
  { id: 'read',     name: '30dk oku',              icon: '📚', color: '#956ec8' },
  { id: 'journal',  name: 'Günlük yaz',            icon: '✍️', color: '#c86e9a' },
  { id: 'plan',     name: 'Yarını planla',         icon: '🗓️', color: '#8ec86e' },
]

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTH_NAMES = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

// ─── helpers ──────────────────────────────────────────────────────────────────

function logKey(date: string, habitId: string): string {
  return `${date}|${habitId}`
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getWeekDates(today: Date): Date[] {
  const d = new Date(today)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1 // Mon=0
  d.setDate(d.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    return day
  })
}

function getMonthDates(year: number, month: number): Date[] {
  const days = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))
}

function completionRate(dates: Date[], habits: Habit[], logs: LogStore): number {
  const total = dates.length * habits.length
  if (!total) return 0
  const done = dates.reduce(
    (acc, d) => acc + habits.filter((h) => logs[logKey(toISO(d), h.id)]).length,
    0,
  )
  return Math.round((done / total) * 100)
}

function dayRate(date: Date, habits: Habit[], logs: LogStore): number {
  const done = habits.filter((h) => logs[logKey(toISO(date), h.id)]).length
  return Math.round((done / habits.length) * 100)
}

// ─── localStorage + supabase ──────────────────────────────────────────────────

function loadLogsLocal(): LogStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LOGS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveLogsLocal(logs: LogStore) {
  try { localStorage.setItem(LOGS_KEY, JSON.stringify(logs)) } catch {}
}

async function syncLogToSupabase(date: string, habitId: string, completed: boolean) {
  try {
    if (completed) {
      await supabase.from('habit_logs').upsert({
        user_id: BERO_ID, date, habit_id: habitId, completed: true,
      }, { onConflict: 'user_id,date,habit_id' })
    } else {
      await supabase.from('habit_logs')
        .delete()
        .eq('user_id', BERO_ID)
        .eq('date', date)
        .eq('habit_id', habitId)
    }
  } catch {}
}

async function loadLogsFromSupabase(): Promise<LogStore> {
  try {
    const { data } = await supabase
      .from('habit_logs')
      .select('date, habit_id, completed')
      .eq('user_id', BERO_ID)
    if (!data) return {}
    const store: LogStore = {}
    for (const row of data) {
      if (row.completed) store[logKey(row.date, row.habit_id)] = true
    }
    return store
  } catch { return {} }
}

// ─── progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, color = '#c8a96e' }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: pct > 0 ? color : 'transparent' }}
        />
      </div>
      <span className="text-[10px] text-muted w-8 text-right shrink-0">{pct}%</span>
    </div>
  )
}

// ─── checkbox ─────────────────────────────────────────────────────────────────

function HabitCheck({
  checked, color, onChange,
}: { checked: boolean; color: string; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="w-6 h-6 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
      style={{
        borderColor: checked ? color : '#1e2530',
        background: checked ? color + '25' : 'transparent',
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

// ─── week tab ─────────────────────────────────────────────────────────────────

function WeekTab({ habits, logs, toggle, today }: {
  habits: Habit[]
  logs: LogStore
  toggle: (date: string, habitId: string) => void
  today: string
}) {
  const weekDates = getWeekDates(new Date(today))

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth: `${180 + habits.length * 40 + 80}px` }}>
        <thead>
          <tr>
            <th className="text-left py-2 pr-3 text-[10px] text-muted/50 uppercase tracking-wider font-medium w-28 shrink-0">
              Gün
            </th>
            {habits.map((h) => (
              <th key={h.id} className="py-2 px-1 w-10" title={h.name}>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm">{h.icon}</span>
                </div>
              </th>
            ))}
            <th className="text-left py-2 pl-3 text-[10px] text-muted/50 uppercase tracking-wider font-medium w-28">
              İlerleme
            </th>
          </tr>
        </thead>
        <tbody>
          {weekDates.map((d, di) => {
            const iso = toISO(d)
            const isToday = iso === today
            const pct = dayRate(d, habits, logs)
            return (
              <tr
                key={iso}
                className={`border-t transition-colors ${
                  isToday ? 'border-gold/20 bg-gold/5' : 'border-border/30 hover:bg-surface/50'
                }`}
              >
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${isToday ? 'text-gold' : 'text-foreground/70'}`}>
                      {DAY_NAMES[di]}
                    </span>
                    <span className="text-[10px] text-muted/50">
                      {d.getDate()}/{d.getMonth() + 1}
                    </span>
                    {isToday && (
                      <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-medium">
                        bugün
                      </span>
                    )}
                  </div>
                </td>
                {habits.map((h) => (
                  <td key={h.id} className="py-2 px-1 text-center">
                    <div className="flex justify-center">
                      <HabitCheck
                        checked={!!logs[logKey(iso, h.id)]}
                        color={h.color}
                        onChange={() => toggle(iso, h.id)}
                      />
                    </div>
                  </td>
                ))}
                <td className="py-2 pl-3">
                  <ProgressBar pct={pct} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* weekly summary */}
      <div className="mt-6 flex items-center gap-4 py-3 border-t border-border/30">
        <span className="text-xs text-muted">Haftalık tamamlanma:</span>
        <div className="flex-1 max-w-xs">
          <ProgressBar pct={completionRate(weekDates, habits, logs)} />
        </div>
        <span className="text-xs text-muted ml-auto">
          {weekDates.filter((d) => dayRate(d, habits, logs) >= 80).length}/7 gün ≥80%
        </span>
      </div>
    </div>
  )
}

// ─── month tab ────────────────────────────────────────────────────────────────

function MonthTab({ habits, logs, toggle, today }: {
  habits: Habit[]
  logs: LogStore
  toggle: (date: string, habitId: string) => void
  today: string
}) {
  const now = new Date(today)
  const monthDates = getMonthDates(now.getFullYear(), now.getMonth())

  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex items-center gap-3">
        <span className="font-display text-base text-foreground">
          {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}
        </span>
        <div className="flex-1 max-w-xs">
          <ProgressBar pct={completionRate(monthDates, habits, logs)} />
        </div>
      </div>
      <table className="w-full" style={{ minWidth: `${180 + habits.length * 40 + 80}px` }}>
        <thead>
          <tr>
            <th className="text-left py-2 pr-3 text-[10px] text-muted/50 uppercase tracking-wider font-medium w-16">
              Gün
            </th>
            {habits.map((h) => (
              <th key={h.id} className="py-2 px-1 w-10" title={h.name}>
                <span className="text-sm">{h.icon}</span>
              </th>
            ))}
            <th className="text-left py-2 pl-3 text-[10px] text-muted/50 uppercase tracking-wider font-medium w-28">
              İlerleme
            </th>
          </tr>
        </thead>
        <tbody>
          {monthDates.map((d) => {
            const iso = toISO(d)
            const isToday = iso === today
            const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
            const pct = dayRate(d, habits, logs)
            return (
              <tr
                key={iso}
                className={`border-t transition-colors ${
                  isToday ? 'border-gold/20 bg-gold/5' : 'border-border/30 hover:bg-surface/50'
                }`}
              >
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium w-6 ${isToday ? 'text-gold' : 'text-foreground/70'}`}>
                      {d.getDate()}
                    </span>
                    <span className="text-[10px] text-muted/40">{DAY_NAMES[dow]}</span>
                  </div>
                </td>
                {habits.map((h) => (
                  <td key={h.id} className="py-1.5 px-1 text-center">
                    <div className="flex justify-center">
                      <HabitCheck
                        checked={!!logs[logKey(iso, h.id)]}
                        color={h.color}
                        onChange={() => toggle(iso, h.id)}
                      />
                    </div>
                  </td>
                ))}
                <td className="py-1.5 pl-3">
                  <ProgressBar pct={pct} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── year tab ─────────────────────────────────────────────────────────────────

function YearTab({ habits, logs, today }: {
  habits: Habit[]
  logs: LogStore
  today: string
}) {
  const now = new Date(today)
  const year = now.getFullYear()

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-base text-foreground">{year} Genel Bakış</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }, (_, mi) => {
          const dates = getMonthDates(year, mi)
          const pct = completionRate(dates, habits, logs)
          const isCurrentMonth = mi === now.getMonth()
          const isFuture = mi > now.getMonth()
          const bestDay = dates.reduce(
            (best, d) => Math.max(best, dayRate(d, habits, logs)), 0,
          )
          return (
            <div
              key={mi}
              className={`rounded-2xl border p-4 flex flex-col gap-3 transition-colors ${
                isCurrentMonth
                  ? 'border-gold/30 bg-gold/5'
                  : 'border-border bg-surface hover:border-border/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${
                  isCurrentMonth ? 'text-gold' : isFuture ? 'text-muted/40' : 'text-foreground/80'
                }`}>
                  {MONTH_NAMES[mi]}
                </span>
                {isCurrentMonth && (
                  <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-medium">
                    aktif
                  </span>
                )}
              </div>

              {isFuture ? (
                <div className="flex-1 flex items-end">
                  <div className="w-full h-1.5 bg-border/30 rounded-full" />
                </div>
              ) : (
                <>
                  <div className="text-2xl font-semibold text-foreground">
                    {pct}
                    <span className="text-sm text-muted font-normal">%</span>
                  </div>
                  <ProgressBar pct={pct} />
                  <div className="flex items-center justify-between text-[10px] text-muted/50">
                    <span>{dates.length} gün</span>
                    <span>en iyi: {bestDay}%</span>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* habit breakdown */}
      <div className="mt-8">
        <p className="text-xs text-muted/50 uppercase tracking-wider font-medium mb-3">Alışkanlık Bazında</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {habits.map((h) => {
            const allDaysThisYear = Array.from(
              { length: now.getDayOfYear?.() ?? (
                Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1
              ) },
              (_, i) => {
                const d = new Date(year, 0, 1)
                d.setDate(d.getDate() + i)
                return d
              },
            )
            const done = allDaysThisYear.filter((d) => logs[logKey(toISO(d), h.id)]).length
            const pct = allDaysThisYear.length ? Math.round((done / allDaysThisYear.length) * 100) : 0
            return (
              <div key={h.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-surface border border-border">
                <span className="text-base">{h.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/80 truncate">{h.name}</p>
                  <ProgressBar pct={pct} color={h.color} />
                </div>
                <span className="text-xs font-medium shrink-0" style={{ color: h.color }}>{done}g</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

type Tab = 'hafta' | 'ay' | 'yil'

export default function AliskanlikPage() {
  const [tab, setTab]   = useState<Tab>('hafta')
  const [logs, setLogs] = useState<LogStore>({})
  const today = toISO(new Date())

  // load from localStorage on mount, then try Supabase
  useEffect(() => {
    const local = loadLogsLocal()
    setLogs(local)
    loadLogsFromSupabase().then((remote) => {
      if (Object.keys(remote).length > 0) {
        const merged = { ...local, ...remote }
        setLogs(merged)
        saveLogsLocal(merged)
      }
    })
  }, [])

  const toggle = useCallback((date: string, habitId: string) => {
    setLogs((prev) => {
      const k = logKey(date, habitId)
      const next = { ...prev, [k]: !prev[k] }
      if (!next[k]) delete next[k]
      saveLogsLocal(next)
      syncLogToSupabase(date, habitId, !!next[k])
      return next
    })
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'hafta', label: 'Bu Hafta' },
    { id: 'ay',    label: 'Bu Ay' },
    { id: 'yil',   label: 'Yıllık' },
  ]

  // weekly stats for header
  const weekDates   = getWeekDates(new Date(today))
  const weekPct     = completionRate(weekDates, DEFAULT_HABITS, logs)
  const todayPct    = dayRate(new Date(today), DEFAULT_HABITS, logs)
  const doneTodayN  = DEFAULT_HABITS.filter((h) => logs[logKey(today, h.id)]).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-6 gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Alışkanlık</h1>
              <p className="text-sm text-muted mt-1">
                Bugün{' '}
                <span className="text-gold font-medium">{doneTodayN}/{DEFAULT_HABITS.length}</span>
                {' '}· Haftalık{' '}
                <span className="text-emerald-400 font-medium">{weekPct}%</span>
              </p>
            </div>

            {/* today mini rings */}
            <div className="flex items-center gap-1.5 shrink-0">
              {DEFAULT_HABITS.map((h) => {
                const done = !!logs[logKey(today, h.id)]
                return (
                  <button
                    key={h.id}
                    onClick={() => toggle(today, h.id)}
                    title={h.name}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all"
                    style={{
                      background: done ? h.color + '30' : 'transparent',
                      border: `1.5px solid ${done ? h.color : '#1e2530'}`,
                      filter: done ? 'none' : 'grayscale(1) opacity(0.5)',
                    }}
                  >
                    {h.icon}
                  </button>
                )
              })}
            </div>
          </div>

          {/* today progress bar */}
          <div className="mb-6">
            <div className="h-1 w-full bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${todayPct}%`, background: '#c8a96e' }}
              />
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex items-center gap-1 mb-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-xs px-4 py-2 rounded-xl font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-gold text-background'
                    : 'text-muted hover:text-foreground border border-border'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            {tab === 'hafta' && (
              <WeekTab habits={DEFAULT_HABITS} logs={logs} toggle={toggle} today={today} />
            )}
            {tab === 'ay' && (
              <MonthTab habits={DEFAULT_HABITS} logs={logs} toggle={toggle} today={today} />
            )}
            {tab === 'yil' && (
              <YearTab habits={DEFAULT_HABITS} logs={logs} today={today} />
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
