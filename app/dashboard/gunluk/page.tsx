'use client'

// Günlük — UI v1 nötr dil. Görsel katman yeni tasarım sistemine taşındı;
// veri/durum mantığı DEĞİŞMEDİ (dbLoad/dbSaveJournal*, soru seçimi,
// takvim hesapları aynen duruyor).

import { useState, useEffect, useCallback } from 'react'
import {
  dbLoadJournalEntry,
  dbSaveJournalEntry,
  dbLoadJournalDates,
  dbLoadJournalQuestions,
  dbLoadRecentJournalEntries,
} from '@/lib/db'
import type { JournalEntry, JournalQuestion } from '@/lib/db'
import SectionHeader from '@/components/SectionHeader'
import { cn } from '@/lib/utils'

// ─── constants ────────────────────────────────────────────────────────────────

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const DAYS_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MOOD_EMOJI = ['', '😔', '😢', '😕', '😌', '😐', '🙂', '😊', '😁', '😄', '🤩']

// Ruh hali için semantik ton — nötr dilde renk yalnız anlam taşıdığında
// kullanılır (iyi/orta/zor).
const MOOD_GOOD = 'var(--success)'
const MOOD_MID = 'var(--warning)'
const MOOD_BAD = 'var(--destructive)'
const MOOD_EMPTY = 'var(--secondary)'

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
      dbLoadRecentJournalEntries(7),
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
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeader title="Günlük" subtitle="Düşüncelerini yaz, her günü belgele." />

      <div className="no-scrollbar flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">

          {/* Haftalık ruh hali grafiği */}
          {(() => {
            const today2 = new Date()
            const days7 = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(today2)
              d.setDate(today2.getDate() - (6 - i))
              return d
            })
            const maxH = 52
            return (
              <div className="mb-8 rounded-2xl border border-border bg-card p-5">
                <p className="mb-4 text-3xs font-medium uppercase tracking-widest text-muted-foreground">
                  Haftalık Ruh Hali
                </p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: maxH + 28 }}>
                  {days7.map((d) => {
                    const iso = localISO(d)
                    const entry = recentEntries.find((e) => e.date === iso)
                    const moodVal = entry?.mood ?? 0
                    const barH = moodVal > 0 ? Math.round((moodVal / 10) * maxH) : 4
                    const isToday2 = iso === today
                    const moodColor = moodVal === 0
                      ? MOOD_EMPTY
                      : moodVal >= 8 ? MOOD_GOOD
                      : moodVal >= 5 ? MOOD_MID
                      : MOOD_BAD
                    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
                    return (
                      <div
                        key={iso}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                        onClick={() => setSelectedDate(iso)}
                        title={moodVal > 0 ? `${iso}: Ruh hali ${moodVal}/10` : `${iso}: Kayıt yok`}
                      >
                        <span style={{ fontSize: 9, color: moodVal > 0 ? moodColor : 'var(--text-tertiary)', fontWeight: 600 }}>
                          {moodVal > 0 ? moodVal : ''}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            height: barH,
                            background: moodColor,
                            borderRadius: 4,
                            opacity: moodVal === 0 ? 0.5 : 1,
                            transition: 'height 0.3s ease',
                            border: isToday2 ? '2px solid var(--ring)' : 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                        <span
                          style={{
                            fontSize: 9,
                            color: isToday2 ? 'var(--foreground)' : 'var(--muted-foreground)',
                            fontWeight: isToday2 ? 700 : 400,
                          }}
                        >
                          {DAYS_SHORT[dow]}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  {[[MOOD_GOOD, '8-10 İyi'], [MOOD_MID, '5-7 Orta'], [MOOD_BAD, '1-4 Zor']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: c, display: 'inline-block' }} />
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Main grid: form (2/3) | sidebar (1/3) */}
          <div className="mb-10 grid grid-cols-3 gap-5">

            {/* ── Left: Form (2/3) ── */}
            <div className="col-span-2 flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
              {/* Date title */}
              <h2 className="text-2xl font-semibold leading-tight text-foreground">
                {formatDateTR(selectedDate)}
              </h2>

              {/* Free write */}
              <div className="flex flex-col gap-1.5">
                <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Serbest Yazı
                </label>
                <textarea
                  value={freeWrite}
                  onChange={(e) => setFreeWrite(e.target.value)}
                  placeholder="Bugün ne oldu, ne hissettin..."
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground transition placeholder:text-muted-foreground/40 focus:border-ring/50 focus:outline-none"
                  style={{ minHeight: '200px' }}
                />
              </div>

              {/* Question 1 */}
              {dq1 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {dq1.question}
                  </label>
                  <textarea
                    value={q1Answer}
                    onChange={(e) => setQ1Answer(e.target.value)}
                    rows={2}
                    placeholder="Düşüncelerini yaz..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground transition placeholder:text-muted-foreground/40 focus:border-ring/50 focus:outline-none"
                  />
                </div>
              )}

              {/* Question 2 */}
              {dq2 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {dq2.question}
                  </label>
                  <textarea
                    value={q2Answer}
                    onChange={(e) => setQ2Answer(e.target.value)}
                    rows={2}
                    placeholder="Düşüncelerini yaz..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground transition placeholder:text-muted-foreground/40 focus:border-ring/50 focus:outline-none"
                  />
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'mt-auto w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-300 disabled:opacity-60',
                  saved ? 'bg-success text-background' : 'bg-primary text-primary-foreground hover:opacity-90',
                )}
              >
                {saving ? 'Kaydediliyor…' : saved ? '✓ Kaydedildi' : 'Kaydet'}
              </button>
            </div>

            {/* ── Right: Calendar + Mood + Score (1/3) ── */}
            <div className="flex flex-col gap-4">

              {/* Calendar */}
              <div className="rounded-2xl border border-border bg-card p-4">
                {/* Month nav */}
                <div className="mb-3 flex items-center justify-between">
                  <button
                    onClick={prevMonth}
                    className="flex size-7 items-center justify-center rounded-lg text-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    ‹
                  </button>
                  <span className="text-xs font-semibold text-foreground">
                    {MONTHS_TR[calMonth]} {calYear}
                  </span>
                  <button
                    onClick={nextMonth}
                    className="flex size-7 items-center justify-center rounded-lg text-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    ›
                  </button>
                </div>

                {/* Day headers */}
                <div className="mb-1 grid grid-cols-7">
                  {DAYS_SHORT.map((d) => (
                    <span key={d} className="py-0.5 text-center text-[9px] font-medium uppercase text-muted-foreground/70">
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
                        className={cn(
                          'relative mx-auto flex size-7 flex-col items-center justify-center rounded-lg text-2xs font-medium transition-all',
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : isToday
                            ? 'text-foreground ring-1 ring-ring'
                            : isFilled
                            ? 'text-foreground hover:bg-secondary'
                            : 'text-muted-foreground/50 hover:bg-secondary/60 hover:text-muted-foreground',
                        )}
                      >
                        {day.getDate()}
                        {isFilled && !isSelected && (
                          <span className="absolute bottom-0.5 size-1 rounded-full bg-foreground/70" />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3 text-[9px] text-muted-foreground/70">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-foreground/70" /> Dolu
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2.5 rounded-md ring-1 ring-ring" /> Bugün
                  </span>
                </div>
              </div>

              {/* Mood slider */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ruh Hali
                  </label>
                  <span className="text-2xl leading-none">{MOOD_EMOJI[mood]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">😔</span>
                  <input
                    type="range" min="1" max="10" value={mood}
                    onChange={(e) => setMood(Number(e.target.value))}
                    className="flex-1 cursor-pointer"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="text-sm">😄</span>
                </div>
                <div className="mt-1 text-center text-xs font-bold text-foreground">{mood} / 10</div>
              </div>

              {/* Day score */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <label className="mb-3 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Güne Puan
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScore(s)}
                      className={cn(
                        'text-center text-xl transition-all hover:scale-125',
                        s <= score ? 'text-foreground' : 'text-muted-foreground/25',
                      )}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-center text-xs font-bold text-foreground">{score} / 10</div>
              </div>

            </div>
          </div>

          {/* Recent entries */}
          {recentEntries.length > 0 && (
            <div>
              <p className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Son Kayıtlar
              </p>
              <div className="grid grid-cols-5 gap-3">
                {recentEntries.map((e) => (
                  <button
                    key={e.date}
                    onClick={() => setSelectedDate(e.date)}
                    className={cn(
                      'rounded-2xl border bg-card p-3 text-left transition-all hover:border-ring/40',
                      selectedDate === e.date ? 'border-ring/60' : 'border-border',
                    )}
                  >
                    <div className="mb-1 text-xl">{MOOD_EMOJI[e.mood] ?? '—'}</div>
                    <div className="mb-1 text-3xs font-medium text-muted-foreground">{e.date}</div>
                    <div className="line-clamp-2 text-2xs leading-relaxed text-muted-foreground">
                      {e.free_write
                        ? e.free_write.slice(0, 55) + (e.free_write.length > 55 ? '…' : '')
                        : <span className="italic text-muted-foreground/50">Boş</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
