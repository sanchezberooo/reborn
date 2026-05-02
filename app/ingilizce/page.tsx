'use client'

import { useState } from 'react'
import {
  BookOpen, FileText, MessageSquare, Layers,
  BookText, Headphones, PenTool, Mic,
  LayoutDashboard, Trophy, Flame, Zap, GraduationCap
} from 'lucide-react'
import { Dashboard } from './components/dashboard'
import { VocabularyModule } from './components/vocabulary-module'
import { GrammarModule } from './components/grammar-module'
import { IdiomsModule } from './components/idioms-module'
import { ReadingModule } from './components/reading-module'
import { ListeningModule } from './components/listening-module'
import { WritingModule } from './components/writing-module'
import { SpeakingModule } from './components/speaking-module'
import { QuizModule } from './components/quiz-module'
import type { ModuleType } from './lib/types'

type ActiveView = 'dashboard' | ModuleType

const navItems: { id: ActiveView; label: string; labelEn: string; icon: React.ComponentType<{ className?: string }>; level?: string }[] = [
  { id: 'dashboard',   label: 'Ana Sayfa',        labelEn: 'Dashboard',   icon: LayoutDashboard },
  { id: 'vocabulary',  label: 'Kelime Bankası',    labelEn: 'Vocabulary',  icon: BookOpen,    level: 'A1-C2' },
  { id: 'grammar',     label: 'Gramer',            labelEn: 'Grammar',     icon: FileText,    level: 'A1-C2' },
  { id: 'idioms',      label: 'Deyimler',          labelEn: 'Idioms',      icon: MessageSquare, level: 'B1-C2' },
  { id: 'patterns',    label: 'Kalıplar',          labelEn: 'Patterns',    icon: Layers,      level: 'A2-C1' },
  { id: 'reading',     label: 'Okuma',             labelEn: 'Reading',     icon: BookText,    level: 'A1-C2' },
  { id: 'listening',   label: 'Dinleme',           labelEn: 'Listening',   icon: Headphones,  level: 'A1-C2' },
  { id: 'writing',     label: 'Yazma',             labelEn: 'Writing',     icon: PenTool,     level: 'A2-C2' },
  { id: 'speaking',    label: 'Konuşma',           labelEn: 'Speaking',    icon: Mic,         level: 'A1-C2' },
  { id: 'quiz',        label: 'Quiz',              labelEn: 'Quiz',        icon: Trophy,      level: 'A1-C2' },
]

const STREAK = 7
const XP = 2450

export default function IngilizceePage() {
  const [active, setActive] = useState<ActiveView>('dashboard')

  const renderContent = () => {
    switch (active) {
      case 'vocabulary': return <VocabularyModule />
      case 'grammar':    return <GrammarModule />
      case 'idioms':     return <IdiomsModule />
      case 'patterns':   return <IdiomsModule />
      case 'reading':    return <ReadingModule />
      case 'listening':  return <ListeningModule />
      case 'writing':    return <WritingModule />
      case 'speaking':   return <SpeakingModule />
      case 'quiz':       return <QuizModule />
      default:           return <Dashboard onModuleChange={setActive} />
    }
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-surface overflow-y-auto">
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 border border-gold/25">
            <GraduationCap className="h-4 w-4 text-gold" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">LinguaMaster</span>
            <span className="text-[10px] text-muted">İngilizce Öğrenme</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-around px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-semibold">{STREAK} gün</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-semibold">{XP.toLocaleString()} XP</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm transition-colors text-left group ${
                  isActive
                    ? 'bg-gold/15 text-gold'
                    : 'text-muted hover:bg-surface-2 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.level && (
                  <span className={`text-[9px] px-1.5 rounded font-medium ${isActive ? 'bg-gold/20 text-gold' : 'bg-surface-2 text-muted'}`}>
                    {item.level}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  )
}
