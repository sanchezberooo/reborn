'use client'

import { useState } from 'react'
import { dbExecuteAction } from '@/lib/db'
import type { ModuleType } from '../lib/types'

// ── types ────────────────────────────────────────────────────────────────────

export interface PlanBlock {
  duration: string
  skill: string
  task: string
}

export interface PlanDay {
  dayNumber: number
  dayName?: string
  weekday?: string
  date: string
  focus?: string
  totalHours?: string | number
  blocks: PlanBlock[]
}

export interface WeekPlan {
  weekNumber: number
  weekDates: string
  theme: string
  weeklyGoals: string[]
  weekSummary: string
  days: PlanDay[]
}

// ── constants ────────────────────────────────────────────────────────────────

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

const PHASE_TITLES: Record<number, string> = {
  1: 'Faz 1: Temel Sağlamlaştırma (A1→A2)',
  2: 'Faz 1: Temel Sağlamlaştırma (A1→A2)',
  3: 'Faz 2: Yapı ve Üretim (A2)',
  4: 'Faz 2: Yapı ve Üretim (A2)',
  5: 'Faz 3: Akıcılık Geliştirme (A2→B1)',
  6: 'Faz 3: Akıcılık Geliştirme (A2→B1)',
  7: 'Faz 4: IELTS Tekniği (B1)',
  8: 'Faz 4: IELTS Tekniği (B1)',
  9: 'Faz 5: Tam Bant Pratik (B1→B2)',
  10: 'Faz 5: Tam Bant Pratik (B1→B2)',
}

// Week 1 starts Monday 2026-06-29
const WEEK1_START = new Date('2026-06-29T00:00:00')

function fmtDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`
}

function computeWeekDates(weekNumber: number): string {
  const start = new Date(WEEK1_START)
  start.setDate(start.getDate() + (weekNumber - 1) * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 5) // Saturday
  return `${fmtDayMonth(start)} - ${fmtDayMonth(end)}`
}

function getPhaseTitle(weekNumber: number): string {
  return PHASE_TITLES[weekNumber] ?? `Hafta ${weekNumber}`
}

// ── skill → module mapping ───────────────────────────────────────────────────

function skillToModule(skill: string): ModuleType | null {
  const s = skill.toLowerCase()
  if (s.includes('writing') || s.includes('yazma')) return 'writing'
  if (s.includes('speaking') || s.includes('konuşma') || s.includes('konusma')) return 'speaking'
  if (s.includes('grammar') || s.includes('gramer') || s.includes('dilbilgisi')) return 'grammar'
  if (s.includes('reading') || s.includes('okuma')) return 'reading'
  if (s.includes('listening') || s.includes('dinleme')) return 'listening'
  if (s.includes('vocab') || s.includes('kelime')) return 'vocabulary'
  if (s.includes('pattern') || s.includes('kalıp') || s.includes('kalip')) return 'patterns'
  return null
}

const SKILL_COLORS: Record<string, string> = {
  writing:    '#c86e6e',
  speaking:   '#c8956e',
  grammar:    '#956ec8',
  reading:    '#6eb5c8',
  listening:  '#6ec8a9',
  vocabulary: '#c8a96e',
  patterns:   '#6e9ac8',
}

function blockColor(skill: string): string {
  const mod = skillToModule(skill)
  return mod ? (SKILL_COLORS[mod] ?? '#a0a0a0') : '#555'
}

// ── component ────────────────────────────────────────────────────────────────

interface PlanModuleProps {
  weeklyPlans: Record<string, WeekPlan>
  onPlanUpdated: (updated: Record<string, WeekPlan>) => void
  onNavigate: (module: ModuleType) => void
}

export function PlanModule({ weeklyPlans, onPlanUpdated, onNavigate }: PlanModuleProps) {
  const existingNums = Object.keys(weeklyPlans).map(Number).sort((a, b) => a - b)
  const [currentWeek, setCurrentWeek] = useState<number>(existingNums[0] ?? 1)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan: WeekPlan | null = weeklyPlans[String(currentWeek)] ?? null
  const maxWeek = 10

  async function generateWeek(weekNumber: number) {
    setGenerating(true)
    setError(null)
    try {
      const previousWeekSummary = weeklyPlans[String(weekNumber - 1)]?.weekSummary ?? ''
      const weekDates = computeWeekDates(weekNumber)

      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: 'ingilizce-planlayici',
          input: {
            startLevel: 'A1',
            comprehension: 'strong',
            production: 'weak',
            biggestFear: 'writing',
            target: 'IELTS 6.0 (stretch 7.0)',
            examDate: '2026-09-05',
            hoursPerDay: '4-5',
            daysPerWeek: 6,
            restDay: 'Sunday',
            weekNumber,
            weekDates,
            phaseTitle: getPhaseTitle(weekNumber),
            previousWeekSummary,
          },
        }),
      })

      if (!res.ok) throw new Error(`Sunucu hatası: HTTP ${res.status}`)

      const run = await res.json()
      if (run.output?.parseError) throw new Error('Agent geçersiz JSON döndürdü')
      if (!run.output?.weekNumber) throw new Error('Agent çıktısı beklenen formatta değil')

      const weekObj = run.output as WeekPlan
      const updated = { ...weeklyPlans, [String(weekNumber)]: weekObj }

      // Shallow merge — does NOT touch data.words or data.progress
      await dbExecuteAction({
        type: 'UPDATE_MODULE',
        payload: { id: 'english', patch: { weeklyPlans: updated } },
      })

      onPlanUpdated(updated)
      setCurrentWeek(weekNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-0 py-4">

      {/* ── Week navigator ── */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setCurrentWeek((w) => Math.max(1, w - 1))}
          disabled={currentWeek <= 1 || generating}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted hover:text-foreground disabled:opacity-20 transition-colors text-sm"
        >
          ◀
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Hafta {currentWeek}</p>
          <p className="text-xs text-muted mt-0.5">
            {plan?.weekDates ?? computeWeekDates(currentWeek)}
          </p>
          {existingNums.length > 0 && (
            <p className="text-[10px] text-muted/40 mt-0.5">
              Mevcut: {existingNums.map((n) => `H${n}`).join(', ')}
            </p>
          )}
        </div>

        <button
          onClick={() => setCurrentWeek((w) => Math.min(maxWeek, w + 1))}
          disabled={currentWeek >= maxWeek || generating}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted hover:text-foreground disabled:opacity-20 transition-colors text-sm"
        >
          ▶
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl border text-sm"
          style={{ background: 'rgba(200,110,110,0.08)', borderColor: 'rgba(200,110,110,0.25)', color: '#c86e6e' }}>
          {error}
        </div>
      )}

      {/* ── No plan yet ── */}
      {!plan && (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="text-4xl opacity-30">📅</div>
          <p className="text-muted text-sm text-center">
            Hafta {currentWeek} için henüz bir plan oluşturulmamış.
            <br />
            <span className="text-muted/50 text-xs">Oluşturmak ~30-60 saniye sürer.</span>
          </p>
          <button
            onClick={() => generateWeek(currentWeek)}
            disabled={generating}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: '#c8a96e' }}
          >
            {generating ? 'Oluşturuluyor…' : 'Bu haftayı oluştur'}
          </button>
        </div>
      )}

      {/* ── Plan ── */}
      {plan && (
        <>
          {/* Theme + goals */}
          <div className="mb-4 p-4 rounded-2xl border border-border"
            style={{ background: '#111', borderTopColor: '#c8a96e', borderTopWidth: '2px' }}>
            <p className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-1">Hafta Teması</p>
            <p className="text-sm font-semibold text-foreground mb-3">{plan.theme}</p>
            <p className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-2">Haftalık Hedefler</p>
            <ul className="flex flex-col gap-1.5">
              {plan.weeklyGoals?.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/75">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#c8a96e' }} />
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {/* Day cards */}
          <div className="flex flex-col gap-3">
            {plan.days?.map((day, di) => {
              const dayLabel = day.dayName ?? day.weekday ?? `Gün ${day.dayNumber}`
              return (
                <div key={di} className="rounded-2xl border border-border overflow-hidden"
                  style={{ background: '#111' }}>
                  {/* Day header */}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '1px solid #222' }}>
                    <div>
                      <span className="text-sm font-semibold text-foreground">{dayLabel}</span>
                      <span className="text-[11px] text-muted ml-2">{day.date}</span>
                    </div>
                    <div className="text-right">
                      {day.focus && (
                        <p className="text-[11px] text-muted/70">{day.focus}</p>
                      )}
                      {day.totalHours && (
                        <p className="text-[10px] text-muted/40">{day.totalHours}</p>
                      )}
                    </div>
                  </div>

                  {/* Blocks */}
                  <div className="flex flex-col">
                    {day.blocks?.map((block, bi) => {
                      const targetMod = skillToModule(block.skill)
                      const color = blockColor(block.skill)
                      return (
                        <div
                          key={bi}
                          className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${
                            targetMod ? 'cursor-pointer hover:bg-white/[0.025]' : ''
                          }`}
                          style={{ borderTop: bi > 0 ? '1px solid #1e1e1e' : undefined }}
                          onClick={() => targetMod && onNavigate(targetMod)}
                        >
                          {/* Duration */}
                          <span className="text-[11px] font-semibold shrink-0 w-12 mt-0.5"
                            style={{ color: '#a0a0a0' }}>
                            {block.duration}
                          </span>

                          {/* Skill badge */}
                          <span
                            className="text-[9px] font-semibold shrink-0 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap"
                            style={{ background: `${color}18`, color }}
                          >
                            {block.skill}
                          </span>

                          {/* Task */}
                          <p className="flex-1 text-xs text-foreground/70 leading-relaxed min-w-0">
                            {block.task}
                          </p>

                          {/* Navigate chip */}
                          {targetMod && (
                            <span className="text-[9px] shrink-0 mt-0.5 font-medium transition-colors"
                              style={{ color: '#c8a96e' }}>
                              Derse git →
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Week summary + regen */}
          <div className="mt-5 flex flex-col gap-3">
            {plan.weekSummary && (
              <div className="p-4 rounded-xl border border-border/50"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-1.5">Hafta Özeti</p>
                <p className="text-xs text-muted leading-relaxed">{plan.weekSummary}</p>
              </div>
            )}
            <button
              onClick={() => generateWeek(currentWeek)}
              disabled={generating}
              className="self-start text-xs px-3 py-2 rounded-xl border border-border text-muted hover:text-foreground disabled:opacity-30 transition-colors"
            >
              {generating ? 'Yeniden oluşturuluyor…' : '↺ Yeniden oluştur'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
