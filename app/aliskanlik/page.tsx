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

type LogStore = Record<string, boolean> // `${YYYY-MM-DD}|${habitId}` → true

// ─── constants ────────────────────────────────────────────────────────────────

const LOGS_KEY = 'reborn:habit_logs'
const BERO_ID  = process.env.NEXT_PUBLIC_BERO_ID ?? '00000000-0000-0000-0000-000000000001'

const HABITS: Habit[] = [
  { id: 'sleep',    name: 'Uyku 7-8 saat',       icon: '😴', color: '#6eb5c8' },
  { id: 'eat',      name: 'Sağlıklı beslen',      icon: '🥗', color: '#6ec8a9' },
  { id: 'social',   name: 'Sosyal medya ≤90dk',  icon: '📵', color: '#c86e6e' },
  { id: 'water',    name: '2L su iç',             icon: '💧', color: '#5ab8d4' },
  { id: 'study',    name: '2 saat çalış',         icon: '📖', color: '#c8a96e' },
  { id: 'exercise', name: '30dk egzersiz',        icon: '🏃', color: '#c8956e' },
  { id: 'read',     name: '30dk oku',             icon: '📚', color: '#956ec8' },
  { id: 'journal',  name: 'Günlük yaz',           icon: '✍️', color: '#c86e9a' },
  { id: 'plan',     name: 'Yarını planla',        icon: '🗓️', color: '#8ec86e' },
]

const DAY_TR   = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTH_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

// ─── date helpers ─────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  const y  = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${dd}`
}

function todayISO(): string { return localISO(new Date()) }

function weekDates(ref: Date): Date[] {
  const d   = new Date(ref)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i); return x
  })
}

function monthDates(year: number, month: number): Date[] {
  const n = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: n }, (_, i) => new Date(year, month, i + 1))
}

function daysBetween(from: Date, to: Date): Date[] {
  const days: Date[] = []
  const d = new Date(from)
  while (d <= to) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

function dowIndex(d: Date): number { return d.getDay() === 0 ? 6 : d.getDay() - 1 }

function logKey(date: string, hid: string) { return `${date}|${hid}` }

function rate(dates: Date[], habits: Habit[], logs: LogStore): number {
  const total = dates.length * habits.length
  if (!total) return 0
  const done = dates.reduce(
    (s, d) => s + habits.filter((h) => logs[logKey(localISO(d), h.id)]).length, 0,
  )
  return Math.round((done / total) * 100)
}

function dayRate(d: Date, habits: Habit[], logs: LogStore): number {
  if (!habits.length) return 0
  return Math.round(
    (habits.filter((h) => logs[logKey(localISO(d), h.id)]).length / habits.length) * 100,
  )
}

// ─── storage ──────────────────────────────────────────────────────────────────

function localLoad(): LogStore {
  if (typeof window === 'undefined') return {}
  try { const r = localStorage.getItem(LOGS_KEY); return r ? JSON.parse(r) : {} }
  catch { return {} }
}

function localSave(logs: LogStore) {
  try { localStorage.setItem(LOGS_KEY, JSON.stringify(logs)) } catch {}
}

async function dbToggle(date: string, habitId: string, on: boolean) {
  try {
    if (on) {
      await supabase.from('habit_logs').upsert(
        { user_id: BERO_ID, date, habit_id: habitId, completed: true },
        { onConflict: 'user_id,date,habit_id' },
      )
    } else {
      await supabase.from('habit_logs')
        .delete().eq('user_id', BERO_ID).eq('date', date).eq('habit_id', habitId)
    }
  } catch {}
}

async function dbLoad(): Promise<LogStore> {
  try {
    const { data } = await supabase
      .from('habit_logs').select('date,habit_id,completed').eq('user_id', BERO_ID)
    if (!data) return {}
    const out: LogStore = {}
    data.forEach((r) => { if (r.completed) out[logKey(r.date, r.habit_id)] = true })
    return out
  } catch { return {} }
}

// ─── ui atoms ─────────────────────────────────────────────────────────────────

function Bar({ pct, color = '#c8a96e', thin }: { pct: number; color?: string; thin?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${thin ? 'w-full' : ''}`}>
      <div className={`flex-1 bg-border/40 rounded-full overflow-hidden ${thin ? 'h-1' : 'h-1.5'}`}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: pct > 0 ? color : 'transparent' }}
        />
      </div>
      <span className="text-[10px] text-muted/70 w-8 text-right shrink-0">{pct}%</span>
    </div>
  )
}

function Check({ on, color, onChange }: { on: boolean; color: string; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="w-6 h-6 rounded-md border flex items-center justify-center transition-all duration-100 shrink-0 mx-auto"
      style={{
        borderColor: on ? color : '#1c2433',
        background: on ? `${color}22` : 'transparent',
      }}
    >
      {on && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l3 3 5-6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

// ─── table header (shared) ────────────────────────────────────────────────────

function THead({ habits }: { habits: Habit[] }) {
  return (
    <thead>
      <tr>
        <th className="text-left py-2.5 pr-4 text-[10px] text-muted/40 uppercase tracking-widest font-medium sticky left-0 bg-surface z-10 w-32">
          Gün
        </th>
        {habits.map((h) => (
          <th key={h.id} className="py-2.5 px-1 w-9 text-center" title={h.name}>
            <span className="text-[15px] leading-none">{h.icon}</span>
          </th>
        ))}
        <th className="text-left py-2.5 pl-3 text-[10px] text-muted/40 uppercase tracking-widest font-medium w-32">
          İlerleme
        </th>
      </tr>
    </thead>
  )
}

// ─── week tab ─────────────────────────────────────────────────────────────────

function WeekTab({
  logs, toggle, today,
}: { logs: LogStore; toggle: (d: string, h: string) => void; today: string }) {
  const days = weekDates(new Date(today))
  const weekPct = rate(days, HABITS, logs)

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-muted">Bu Hafta</span>
        <div className="flex-1 max-w-[200px]">
          <Bar pct={weekPct} />
        </div>
        <span className="text-xs text-muted ml-auto">
          {days.filter((d) => dayRate(d, HABITS, logs) === 100).length}/7 tam gün
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <THead habits={HABITS} />
          <tbody>
            {days.map((d, i) => {
              const iso = localISO(d)
              const isToday = iso === today
              const pct = dayRate(d, HABITS, logs)
              return (
                <tr
                  key={iso}
                  className={`border-t transition-colors group ${
                    isToday
                      ? 'border-gold/15 bg-gold/[0.04]'
                      : 'border-border/20 hover:bg-white/[0.015]'
                  }`}
                >
                  <td className="py-2.5 pr-4 sticky left-0 bg-inherit z-10">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold w-7 ${isToday ? 'text-gold' : 'text-foreground/60'}`}>
                        {DAY_TR[i]}
                      </span>
                      <span className="text-[11px] text-muted/40">{d.getDate()}/{d.getMonth() + 1}</span>
                      {isToday && (
                        <span className="text-[8px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-semibold tracking-wide">
                          BUGÜN
                        </span>
                      )}
                    </div>
                  </td>
                  {HABITS.map((h) => (
                    <td key={h.id} className="py-2.5 px-1">
                      <Check
                        on={!!logs[logKey(iso, h.id)]}
                        color={h.color}
                        onChange={() => toggle(iso, h.id)}
                      />
                    </td>
                  ))}
                  <td className="py-2.5 pl-3">
                    <Bar pct={pct} color={pct === 100 ? '#6ec8a9' : pct >= 60 ? '#c8a96e' : '#c86e6e'} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── month tab ────────────────────────────────────────────────────────────────

function MonthTab({
  logs, toggle, today,
}: { logs: LogStore; toggle: (d: string, h: string) => void; today: string }) {
  const ref   = new Date(today)
  const days  = monthDates(ref.getFullYear(), ref.getMonth())
  const mPct  = rate(days, HABITS, logs)

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="font-display text-sm text-foreground/80">
          {MONTH_TR[ref.getMonth()]} {ref.getFullYear()}
        </span>
        <div className="flex-1 max-w-[200px]">
          <Bar pct={mPct} />
        </div>
        <span className="text-xs text-muted ml-auto">
          {days.filter((d) => dayRate(d, HABITS, logs) === 100).length} tam gün
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <THead habits={HABITS} />
          <tbody>
            {days.map((d) => {
              const iso    = localISO(d)
              const isToday = iso === today
              const pct    = dayRate(d, HABITS, logs)
              const dow    = dowIndex(d)
              return (
                <tr
                  key={iso}
                  className={`border-t transition-colors ${
                    isToday
                      ? 'border-gold/15 bg-gold/[0.04]'
                      : 'border-border/20 hover:bg-white/[0.015]'
                  }`}
                >
                  <td className="py-1.5 pr-4 sticky left-0 bg-inherit z-10">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold w-6 ${isToday ? 'text-gold' : 'text-foreground/60'}`}>
                        {d.getDate()}
                      </span>
                      <span className="text-[10px] text-muted/30">{DAY_TR[dow]}</span>
                    </div>
                  </td>
                  {HABITS.map((h) => (
                    <td key={h.id} className="py-1.5 px-1">
                      <Check
                        on={!!logs[logKey(iso, h.id)]}
                        color={h.color}
                        onChange={() => toggle(iso, h.id)}
                      />
                    </td>
                  ))}
                  <td className="py-1.5 pl-3">
                    <Bar pct={pct} color={pct === 100 ? '#6ec8a9' : pct >= 60 ? '#c8a96e' : '#c86e6e'} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── year tab ─────────────────────────────────────────────────────────────────

function YearTab({ logs, today }: { logs: LogStore; today: string }) {
  const now  = new Date(today)
  const year = now.getFullYear()
  const yearStart = new Date(year, 0, 1)

  // days elapsed this year up to today
  const daysThisYear = daysBetween(yearStart, now)
  const yearPct      = rate(daysThisYear, HABITS, logs)

  return (
    <>
      {/* year header */}
      <div className="flex items-center gap-4 mb-6">
        <span className="font-display text-lg text-foreground">{year}</span>
        <div className="flex-1 max-w-xs">
          <Bar pct={yearPct} />
        </div>
        <span className="text-xs text-muted">
          {daysThisYear.filter((d) => dayRate(d, HABITS, logs) === 100).length} tam gün
        </span>
      </div>

      {/* 12 month cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {Array.from({ length: 12 }, (_, mi) => {
          const days         = monthDates(year, mi)
          const isCurrent    = mi === now.getMonth()
          const isFuture     = mi > now.getMonth()
          const effectiveDays = isCurrent ? daysBetween(new Date(year, mi, 1), now) : days
          const pct          = isFuture ? 0 : rate(effectiveDays, HABITS, logs)
          const fullDays     = effectiveDays.filter((d) => dayRate(d, HABITS, logs) === 100).length

          return (
            <div
              key={mi}
              className={`rounded-2xl border p-4 flex flex-col gap-2.5 ${
                isCurrent
                  ? 'border-gold/30 bg-gold/[0.04]'
                  : isFuture
                  ? 'border-border/30 opacity-40'
                  : 'border-border bg-surface hover:border-border/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold font-display ${
                  isCurrent ? 'text-gold' : isFuture ? 'text-muted/30' : 'text-foreground/80'
                }`}>
                  {MONTH_SHORT[mi]}
                </span>
                {isCurrent && (
                  <span className="text-[8px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-semibold tracking-wide">
                    AKTİF
                  </span>
                )}
              </div>

              {!isFuture && (
                <>
                  <div>
                    <span className="text-2xl font-semibold text-foreground">{pct}</span>
                    <span className="text-sm text-muted">%</span>
                  </div>
                  <Bar pct={pct} color={pct >= 80 ? '#6ec8a9' : pct >= 50 ? '#c8a96e' : '#c86e6e'} thin />
                  <div className="flex justify-between text-[10px] text-muted/40">
                    <span>{days.length}g</span>
                    <span>{fullDays} tam</span>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* habit breakdown for this year */}
      <div>
        <p className="text-[10px] text-muted/40 uppercase tracking-widest font-medium mb-3">
          Alışkanlık Bazında — {year}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {HABITS.map((h) => {
            const done = daysThisYear.filter((d) => logs[logKey(localISO(d), h.id)]).length
            const pct  = daysThisYear.length
              ? Math.round((done / daysThisYear.length) * 100) : 0
            return (
              <div
                key={h.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-surface border border-border"
              >
                <span className="text-base shrink-0">{h.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/80 truncate mb-1">{h.name}</p>
                  <Bar pct={pct} color={h.color} thin />
                </div>
                <span className="text-xs font-semibold shrink-0" style={{ color: h.color }}>
                  {done}g
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

type TabId = 'hafta' | 'ay' | 'yil'

const TABS: { id: TabId; label: string }[] = [
  { id: 'hafta', label: 'Bu Hafta' },
  { id: 'ay',    label: 'Bu Ay' },
  { id: 'yil',   label: 'Yıllık' },
]

export default function AliskanlikPage() {
  const [tab,  setTab]  = useState<TabId>('hafta')
  const [logs, setLogs] = useState<LogStore>({})
  const today = todayISO()

  useEffect(() => {
    const local = localLoad()
    setLogs(local)
    dbLoad().then((remote) => {
      if (Object.keys(remote).length > 0) {
        const merged = { ...local, ...remote }
        setLogs(merged)
        localSave(merged)
      }
    })
  }, [])

  const toggle = useCallback((date: string, habitId: string) => {
    setLogs((prev) => {
      const k    = logKey(date, habitId)
      const next = { ...prev }
      if (next[k]) { delete next[k] } else { next[k] = true }
      localSave(next)
      dbToggle(date, habitId, !!next[k])
      return next
    })
  }, [])

  // header stats
  const todayDone  = HABITS.filter((h) => logs[logKey(today, h.id)]).length
  const todayPct   = Math.round((todayDone / HABITS.length) * 100)
  const wkDays     = weekDates(new Date(today))
  const weekPct    = rate(wkDays, HABITS, logs)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Alışkanlık</h1>
              <p className="text-sm text-muted mt-1">
                Bugün{' '}
                <span className="text-gold font-medium">{todayDone}/{HABITS.length}</span>
                {' '}· Haftalık{' '}
                <span
                  className="font-medium"
                  style={{ color: weekPct >= 70 ? '#6ec8a9' : weekPct >= 40 ? '#c8a96e' : '#c86e6e' }}
                >
                  {weekPct}%
                </span>
              </p>
            </div>

            {/* quick toggle: today's habit icons */}
            <div className="flex items-center gap-1 flex-wrap justify-end max-w-[260px] shrink-0">
              {HABITS.map((h) => {
                const on = !!logs[logKey(today, h.id)]
                return (
                  <button
                    key={h.id}
                    onClick={() => toggle(today, h.id)}
                    title={h.name}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm leading-none transition-all duration-150"
                    style={{
                      background: on ? `${h.color}28` : 'transparent',
                      border: `1.5px solid ${on ? h.color : '#1c2433'}`,
                      opacity: on ? 1 : 0.45,
                    }}
                  >
                    {h.icon}
                  </button>
                )
              })}
            </div>
          </div>

          {/* today progress strip */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex-1 h-1 bg-border/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${todayPct}%`,
                  background: todayPct === 100 ? '#6ec8a9' : '#c8a96e',
                }}
              />
            </div>
            {todayPct === 100 && (
              <span className="text-[11px] text-emerald-400 font-semibold shrink-0">🔥 Tam gün!</span>
            )}
          </div>

          {/* ── Tab bar ── */}
          <div className="flex items-center gap-1 mb-5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-xs px-4 py-2 rounded-xl font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-gold text-background'
                    : 'text-muted hover:text-foreground border border-border/50 hover:border-border'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Content ── */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            {tab === 'hafta' && <WeekTab  logs={logs} toggle={toggle} today={today} />}
            {tab === 'ay'    && <MonthTab logs={logs} toggle={toggle} today={today} />}
            {tab === 'yil'   && <YearTab  logs={logs} today={today} />}
          </div>

        </div>
      </div>
    </div>
  )
}
