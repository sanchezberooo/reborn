'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  dbLoadJournalEntry,
  dbSaveJournalEntry,
  dbLoadJournalDates,
  dbLoadJournalQuestions,
  dbLoadRecentJournalEntries,
} from '@/lib/db'
import type { JournalEntry, JournalQuestion } from '@/lib/db'

// ─── constants ────────────────────────────────────────────────────────────────

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const DAYS_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MOOD_EMOJI = ['', '😔', '😢', '😕', '😌', '😐', '🙂', '😊', '😁', '😄', '🤩']

// ─── helpers ──────────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayISO(): string {
  return localISO(new Date())
}

function formatDateTR(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  return `${DAYS_LONG[dow]}, ${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1
  const days: (Date | null)[] = Array.from({ length: offset }, () => null)
  for (let i = 1; i <= last.getDate(); i++) days.push(new Date(year, month, i))
  return days
}

function getQuestionsForDate(
  dateStr: string,
  qs: JournalQuestion[],
): [JournalQuestion | null, JournalQuestion | null] {
  if (qs.length === 0) return [null, null]
  const seed = dateStr.replace(/-/g, '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const i1 = seed % qs.length
  const i2Raw = (seed * 7 + 3) % qs.length
  const i2 = i2Raw === i1 ? (i1 + 1) % qs.length : i2Raw
  return [qs[i1], qs[i2]]
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function GunlukPage() {
  const today = todayISO()
  const [selectedDate, setSelectedDate] = useState(today)
  const [calYear, setCalYear]   = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())

  const [filledDates,   setFilledDates]   = useState<Set<string>>(new Set())
  const [questions,     setQuestions]     = useState<JournalQuestion[]>([])
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([])

  const [mood,      setMood]      = useState(5)
  const [score,     setScore]     = useState(5)
  const [q1Answer,  setQ1Answer]  = useState('')
  const [q2Answer,  setQ2Answer]  = useState('')
  const [freeWrite, setFreeWrite] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  // Initial load
  useEffect(() => {
    Promise.all([
      dbLoadJournalDates(),
      dbLoadJournalQuestions(),
      dbLoadRecentJournalEntries(5),
    ]).then(([dates, qs, recent]) => {
      setFilledDates(new Set(dates))
      setQuestions(qs)
      setRecentEntries(recent)
    }).catch(() => {})
  }, [])

  // Load entry when date changes
  const loadEntry = useCallback((date: string) => {
    dbLoadJournalEntry(date).then((entry) => {
      if (entry) {
        setMood(entry.mood ?? 5)
        setScore(entry.day_score ?? 5)
        setQ1Answer(entry.answer_1 ?? '')
        setQ2Answer(entry.answer_2 ?? '')
        setFreeWrite(entry.free_write ?? '')
      } else {
        setMood(5); setScore(5); setQ1Answer(''); setQ2Answer(''); setFreeWrite('')
      }
      setSaved(false)
    }).catch(() => {})
  }, [])

  useEffect(() => { loadEntry(selectedDate) }, [selectedDate, loadEntry])

  const [dq1, dq2] = getQuestionsForDate(selectedDate, questions)

  async function handleSave() {
    setSaving(true)
    try {
      await dbSaveJournalEntry({
        date:       selectedDate,
        mood,
        day_score:  score,
        question_1: dq1?.question ?? '',
        answer_1:   q1Answer,
        question_2: dq2?.question ?? '',
        answer_2:   q2Answer,
        free_write: freeWrite,
      })
      setFilledDates((prev) => new Set([...prev, selectedDate]))
      const recent = await dbLoadRecentJournalEntries(5)
      setRecentEntries(recent)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      console.error('[Günlük] save error:', e)
    } finally {
      setSaving(false)
    }
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11) }
    else setCalMonth((m) => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0) }
    else setCalMonth((m) => m + 1)
  }

  const calDays = getCalendarDays(calYear, calMonth)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-foreground">Günlük</h1>
          <p className="text-sm text-muted mt-1">Düşüncelerini yaz, her günü belgele.</p>
        </div>

        {/* Main grid: form (2/3) | sidebar (1/3) */}
        <div className="grid grid-cols-3 gap-5 mb-10">

          {/* ── Left: Form (2/3) ── */}
          <div
            className="col-span-2 bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5"
            style={{ borderTopColor: '#c86e9a', borderTopWidth: '2px' }}
          >
            {/* Date title */}
            <h2 className="font-display text-3xl font-semibold text-foreground leading-tight">
              {formatDateTR(selectedDate)}
            </h2>

            {/* Free write */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-muted/50 uppercase tracking-wider font-semibold">
                Serbest Yazı
              </label>
              <textarea
                value={freeWrite}
                onChange={(e) => setFreeWrite(e.target.value)}
                placeholder="Bugün ne oldu, ne hissettin..."
                className="w-full bg-background border border-border rounded-xl px-3 py-3 text-sm text-foreground placeholder:text-muted/25 resize-none focus:outline-none focus:border-[#c8a96e]/50 transition leading-relaxed"
                style={{ minHeight: '200px' }}
              />
            </div>

            {/* Question 1 */}
            {dq1 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted/50 uppercase tracking-wider font-semibold">
                  {dq1.question}
                </label>
                <textarea
                  value={q1Answer}
                  onChange={(e) => setQ1Answer(e.target.value)}
                  rows={2}
                  placeholder="Düşüncelerini yaz..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/25 resize-none focus:outline-none focus:border-[#c8a96e]/50 transition leading-relaxed"
                />
              </div>
            )}

            {/* Question 2 */}
            {dq2 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-muted/50 uppercase tracking-wider font-semibold">
                  {dq2.question}
                </label>
                <textarea
                  value={q2Answer}
                  onChange={(e) => setQ2Answer(e.target.value)}
                  rows={2}
                  placeholder="Düşüncelerini yaz..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/25 resize-none focus:outline-none focus:border-[#c8a96e]/50 transition leading-relaxed"
                />
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-60 mt-auto"
              style={{ background: saved ? '#6ec8a9' : '#c8a96e', color: '#1a1209' }}
            >
              {saving ? 'Kaydediliyor…' : saved ? '✓ Kaydedildi' : 'Kaydet'}
            </button>
          </div>

          {/* ── Right: Calendar + Mood + Score (1/3) ── */}
          <div className="flex flex-col gap-4">

            {/* Calendar */}
            <div
              className="bg-surface border border-border rounded-2xl p-4"
              style={{ borderTopColor: '#c86e9a', borderTopWidth: '2px' }}
            >
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={prevMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-border/30 transition text-lg"
                >
                  ‹
                </button>
                <span className="text-xs font-semibold text-foreground">
                  {MONTHS_TR[calMonth]} {calYear}
                </span>
                <button
                  onClick={nextMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-border/30 transition text-lg"
                >
                  ›
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_SHORT.map((d) => (
                  <span key={d} className="text-center text-[9px] text-muted/35 font-medium uppercase py-0.5">
                    {d}
                  </span>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {calDays.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />
                  const ds = localISO(day)
                  const isFilled   = filledDates.has(ds)
                  const isToday    = ds === today
                  const isSelected = ds === selectedDate

                  return (
                    <button
                      key={ds}
                      onClick={() => setSelectedDate(ds)}
                      className={[
                        'relative flex flex-col items-center justify-center w-7 h-7 mx-auto rounded-lg text-[11px] font-medium transition-all',
                        isSelected
                          ? 'bg-[#c8a96e] text-[#1a1209] shadow-sm'
                          : isToday
                          ? 'ring-1 ring-[#c8a96e] text-[#c8a96e]'
                          : isFilled
                          ? 'text-foreground hover:bg-border/30'
                          : 'text-muted/40 hover:bg-border/20 hover:text-muted/60',
                      ].join(' ')}
                    >
                      {day.getDate()}
                      {isFilled && !isSelected && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#c8a96e]" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-3 text-[9px] text-muted/40">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#c8a96e]" /> Dolu
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-md ring-1 ring-[#c8a96e]" /> Bugün
                </span>
              </div>
            </div>

            {/* Mood slider */}
            <div
              className="bg-surface border border-border rounded-2xl p-4"
              style={{ borderTopColor: '#c86e9a', borderTopWidth: '2px' }}
            >
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] text-muted/50 uppercase tracking-wider font-semibold">
                  Ruh Hali
                </label>
                <span className="text-2xl leading-none">{MOOD_EMOJI[mood]}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">😔</span>
                <input
                  type="range" min="1" max="10" value={mood}
                  onChange={(e) => setMood(Number(e.target.value))}
                  className="flex-1 cursor-pointer accent-[#c8a96e]"
                />
                <span className="text-sm">😄</span>
              </div>
              <div className="text-center mt-1 text-xs font-bold text-[#c8a96e]">{mood} / 10</div>
            </div>

            {/* Day score */}
            <div
              className="bg-surface border border-border rounded-2xl p-4"
              style={{ borderTopColor: '#c86e9a', borderTopWidth: '2px' }}
            >
              <label className="text-[11px] text-muted/50 uppercase tracking-wider font-semibold block mb-3">
                Güne Puan
              </label>
              <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScore(s)}
                    className={`text-xl transition-all hover:scale-125 text-center ${s <= score ? 'text-[#c8a96e]' : 'text-muted/20'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="text-center mt-2 text-xs font-bold text-[#c8a96e]">{score} / 10</div>
            </div>

          </div>
        </div>

        {/* Recent entries */}
        {recentEntries.length > 0 && (
          <div>
            <p className="text-[11px] text-muted/40 uppercase tracking-wider font-semibold mb-3">
              Son Kayıtlar
            </p>
            <div className="grid grid-cols-5 gap-3">
              {recentEntries.map((e) => (
                <button
                  key={e.date}
                  onClick={() => setSelectedDate(e.date)}
                  className={[
                    'bg-surface border rounded-2xl p-3 text-left transition-all hover:border-[#c86e9a]/40',
                    selectedDate === e.date ? 'border-[#c86e9a]/60' : 'border-border',
                  ].join(' ')}
                >
                  <div className="text-xl mb-1">{MOOD_EMOJI[e.mood] ?? '—'}</div>
                  <div className="text-[10px] text-muted/50 font-medium mb-1">{e.date}</div>
                  <div className="text-[11px] text-muted/60 line-clamp-2 leading-relaxed">
                    {e.free_write
                      ? e.free_write.slice(0, 55) + (e.free_write.length > 55 ? '…' : '')
                      : <span className="text-muted/30 italic">Boş</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
