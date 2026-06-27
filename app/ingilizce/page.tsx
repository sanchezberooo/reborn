'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppSidebar } from './components/app-sidebar'
import { Dashboard } from './components/dashboard'
import { VocabularyModule } from './components/vocabulary-module'
import { GrammarModule } from './components/grammar-module'
import { IdiomsModule } from './components/idioms-module'
import { ReadingModule } from './components/reading-module'
import { ListeningModule } from './components/listening-module'
import { WritingModule } from './components/writing-module'
import { SpeakingModule } from './components/speaking-module'
import { QuizModule } from './components/quiz-module'
import { PlanModule } from './components/plan-module'
import type { WeekPlan } from './components/plan-module'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { dbLoadModules, dbExecuteAction } from '@/lib/db'
import type { ModuleType } from './lib/types'

type ActiveView = 'dashboard' | ModuleType

interface EnglishProgress {
  xp: number
  streak: number
  level: string
  lastStudyDate: string
  wordsLearned: number
  wordsTotal: number
}

const DEFAULT_PROGRESS: EnglishProgress = {
  xp: 0,
  streak: 0,
  level: 'A1',
  lastStudyDate: '',
  wordsLearned: 0,
  wordsTotal: 0,
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function IngilizceePage() {
  const [activeModule, setActiveModule] = useState<ActiveView>('dashboard')
  const [progress, setProgress] = useState<EnglishProgress>(DEFAULT_PROGRESS)
  const [weeklyPlans, setWeeklyPlans] = useState<Record<string, WeekPlan>>({})
  const [loaded, setLoaded] = useState(false)

  // Load progress from Supabase
  useEffect(() => {
    dbLoadModules().then((mods) => {
      const englishMod = mods.find((m) => m.id === 'english')
      if (englishMod?.data) {
        const d = englishMod.data as Record<string, unknown>
        const storedPlans = d.weeklyPlans as Record<string, WeekPlan> | undefined
        if (storedPlans) setWeeklyPlans(storedPlans)
        const stored = d.progress as Partial<EnglishProgress> | undefined
        if (stored) {
          // Check streak continuity
          const today = todayISO()
          const yesterday = (() => {
            const d2 = new Date(); d2.setDate(d2.getDate() - 1)
            return `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`
          })()
          const lastDate = stored.lastStudyDate ?? ''
          const streakAlive = lastDate === today || lastDate === yesterday
          setProgress({
            xp:            stored.xp            ?? 0,
            streak:        streakAlive ? (stored.streak ?? 0) : 0,
            level:         stored.level         ?? 'A1',
            lastStudyDate: stored.lastStudyDate  ?? '',
            wordsLearned:  stored.wordsLearned   ?? 0,
            wordsTotal:    stored.wordsTotal     ?? 0,
          })
        }
      }
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  // Save progress to Supabase
  const saveProgress = useCallback((update: Partial<EnglishProgress>) => {
    const next = { ...progress, ...update }
    setProgress(next)
    dbExecuteAction({
      type: 'UPDATE_MODULE',
      payload: { id: 'english', patch: { progress: next } },
    }).catch(() => {})
  }, [progress])

  // Award XP when a module is visited for the first time today
  const handleModuleChange = useCallback((view: ActiveView) => {
    setActiveModule(view)
    if (view !== 'dashboard') {
      const today = todayISO()
      if (progress.lastStudyDate !== today) {
        saveProgress({
          lastStudyDate: today,
          streak: progress.streak + 1,
          xp: progress.xp + 10,
        })
      }
    }
  }, [progress, saveProgress])

  const renderModule = () => {
    switch (activeModule) {
      case 'vocabulary': return <VocabularyModule />
      case 'grammar':    return <GrammarModule />
      case 'idioms':     return <IdiomsModule />
      case 'patterns':   return <IdiomsModule />
      case 'reading':    return <ReadingModule />
      case 'listening':  return <ListeningModule />
      case 'writing':    return <WritingModule />
      case 'speaking':   return <SpeakingModule />
      case 'quiz':       return <QuizModule />
      case 'plan':       return (
        <PlanModule
          weeklyPlans={weeklyPlans}
          onPlanUpdated={setWeeklyPlans}
          onNavigate={(mod) => handleModuleChange(mod)}
        />
      )
      default:           return <Dashboard onModuleChange={handleModuleChange} />
    }
  }

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-1.5">
          {[0,1,2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-gold/50 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const LEVEL_XP: Record<string, number> = { A1: 0, A2: 1000, B1: 3000, B2: 6000, C1: 10000, C2: 15000 }
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const curIdx = LEVELS.indexOf(progress.level)
  const nextLevel = LEVELS[curIdx + 1]
  const curXpBase = LEVEL_XP[progress.level] ?? 0
  const nextXpBase = nextLevel ? LEVEL_XP[nextLevel] : curXpBase + 5000
  const xpPct = Math.min(100, Math.round(((progress.xp - curXpBase) / (nextXpBase - curXpBase)) * 100))
  const xpColor = progress.xp === 0 ? '#333' : '#c8a96e'

  return (
    <SidebarProvider className="flex h-full min-h-0 overflow-hidden">
      <AppSidebar
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        streak={progress.streak}
        xp={progress.xp}
      />
      <SidebarInset>
        {/* XP İlerleme Çubuğu */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 20px',
            borderBottom: '1px solid #222222',
            background: '#0a0a0a',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#a0a0a0', fontWeight: 500 }}>Seviye</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#c8a96e',
                background: 'rgba(200,169,110,0.1)',
                border: '1px solid rgba(200,169,110,0.2)',
                borderRadius: 5,
                padding: '2px 7px',
              }}
            >
              {progress.level}
            </span>
          </div>
          <div style={{ flex: 1, maxWidth: 280 }}>
            <div style={{ height: 5, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${xpPct}%`,
                  background: `linear-gradient(90deg, ${xpColor}, #e8c98e)`,
                  borderRadius: 3,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>
          <span style={{ fontSize: 11, color: '#a0a0a0', whiteSpace: 'nowrap' }}>
            {progress.xp.toLocaleString('tr-TR')} XP
            {nextLevel && (
              <span style={{ color: '#555' }}> / {nextXpBase.toLocaleString('tr-TR')}</span>
            )}
          </span>
          {progress.streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13 }}>🔥</span>
              <span style={{ fontSize: 11, color: '#c8956e', fontWeight: 600 }}>{progress.streak} gün</span>
            </div>
          )}
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          {renderModule()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
