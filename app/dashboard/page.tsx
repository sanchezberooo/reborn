'use client'

// Dashboard — UI v1 nötr dil. Görsel katman v0 kart sistemine taşındı;
// veri katmanı DEĞİŞMEDİ: lib/db dbLoad* çağrıları, modül görünürlük
// çerçevesi (useModuleSettings + module-registry) aynen duruyor.
// Modül Ayarları ve Obsidian senkronu artık burada değil — sol alttaki
// profil avatarından açılan SettingsPanel'de (roadmap §6.1: ayarlar
// için 5. sekme/ayrı yüzey açılmaz).
//
// Kart düzeni (Customize/pin/span/arşiv): v0'daki _v0-import/components/
// dashboard/dashboard.tsx ModuleState desenini taşır — pin/span/arşiv
// tercihi useDashboardLayout() ile profiles.module_settings._dashboard_cards
// jsonb'sinde kalıcı olur (bkz. lib/db.ts dbLoadDashboardLayout). Sıralama:
// pinlenmiş kartlar önce, sonra gerçek verisi olan ("aktif") kartlar önce —
// veri yoksa kart 0 gösterir ama listenin altına düşer.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  NotebookPen, Target, PenTool, Flame, Wallet, Dumbbell, Languages,
  Map, Telescope, Bot, GraduationCap, Archive, ArchiveRestore, Calendar, FileText,
  SlidersHorizontal, Pin, PinOff, Maximize2, Minimize2,
} from 'lucide-react'
import {
  dbLoadModules, dbLoadHabitLogs, dbLoadRecentJournalEntries, dbLoadGoals, dbLoadEssays,
} from '@/lib/db'
import type { JournalEntry, GoalSummary, Essay, EssayStatus } from '@/lib/db'
import type { ModuleItem } from '@/lib/modules'
import { isModuleEnabled } from '@/lib/module-registry'
import { useModuleSettings } from '@/components/useModuleSettings'
import { useDashboardLayout } from '@/components/useDashboardLayout'
import SectionHeader from '@/components/SectionHeader'
import { cn } from '@/lib/utils'

const ESSAY_STATUS_LABEL: Record<EssayStatus, string> = {
  brainstorm: 'Fikir',
  draft: 'Taslak',
  revision: 'Revizyon',
  done: 'Bitti',
}

// ─── habit helpers ────────────────────────────────────────────────────────────

const HABIT_IDS = ['sleep','eat','social_media','water','study','exercise','read','journal','plan']

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function todayISO() { return localISO(new Date()) }

function weekDates(ref: Date): Date[] {
  const d = new Date(ref)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i); return x
  })
}

// ─── kart kabuğu (icon/title/href + customize: pin/span/arşiv kontrolleri) ───

type Span = 'sm' | 'lg'

type DashboardCardDef = {
  id: string
  href: string
  icon: LucideIcon
  title: string
  defaultSpan: Span
  hasData: boolean
  dimmed?: boolean
  content: React.ReactNode
}

function DashboardCard({
  def, customize, pinned, span, onTogglePin, onToggleSpan, onArchive,
}: {
  def: DashboardCardDef
  customize: boolean
  pinned: boolean
  span: Span
  onTogglePin: () => void
  onToggleSpan: () => void
  onArchive: () => void
}) {
  const Icon = def.icon
  return (
    <Link
      href={def.href}
      onClick={(e) => { if (customize) e.preventDefault() }}
      className={cn(
        'group relative flex min-h-[150px] flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors',
        !customize && 'hover:border-ring/30',
        def.dimmed && 'opacity-55',
        span === 'lg' && 'sm:col-span-2',
        customize && 'cursor-default ring-1 ring-primary/20',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-secondary">
          <Icon className="size-4 text-foreground/80" strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-medium text-foreground">{def.title}</h3>
        {pinned && !customize && <Pin className="ml-auto size-3.5 text-muted-foreground" />}
        {customize && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Sabitle"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin() }}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
            <button
              type="button"
              aria-label="Boyutlandır"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSpan() }}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {span === 'lg' ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
            <button
              type="button"
              aria-label="Arşivle"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchive() }}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Archive className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2">
        {def.content}
      </div>
    </Link>
  )
}

function Bar({ pct, tone = 'primary' }: { pct: number; tone?: 'primary' | 'success' | 'warning' | 'destructive' }) {
  const fill = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
  }[tone]
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className={cn('h-full rounded-full transition-all', fill)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-right text-3xs text-muted-foreground">{pct}%</span>
    </div>
  )
}

// ─── kart içerikleri (Faz 2 çekirdeği: Günlük, Hedefler, Essay) ─────────────

function GunlukContent({ entry }: { entry: JournalEntry | null }) {
  const isToday = entry?.date === todayISO()

  if (!entry) return <p className="text-2xs italic text-muted-foreground/60">Henüz günlük yok — ilk kaydını aç.</p>
  return (
    <>
      <div className="flex items-center gap-2">
        {isToday ? (
          <>
            <span className="size-2 animate-pulse rounded-full bg-success" />
            <span className="text-sm font-medium text-success">Bugün yazıldı</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Son kayıt: {entry.date}</span>
        )}
      </div>
      <p className="line-clamp-2 text-2xs leading-relaxed text-muted-foreground">
        {entry.free_write ? entry.free_write.slice(0, 80) + '…' : 'Bu günün serbest yazımı yok.'}
      </p>
    </>
  )
}

function HedeflerContent({ goals, active }: { goals: GoalSummary[]; active: GoalSummary[] }) {
  const next = [...active].sort(
    (a, b) => (a.target_date ?? '9999-99-99').localeCompare(b.target_date ?? '9999-99-99'),
  )[0]

  if (active.length === 0) {
    return <p className="text-2xs italic text-muted-foreground/60">Henüz hedef yok — Sanchez&apos;le konuşarak oluşturabilirsin.</p>
  }
  return (
    <>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-foreground">{active.length}</span>
        <span className="text-xs text-muted-foreground">aktif hedef</span>
      </div>
      {next && (
        <p className="line-clamp-2 text-2xs leading-relaxed text-muted-foreground">
          {next.title}{next.target_date ? ` · ${next.target_date}` : ''}
        </p>
      )}
    </>
  )
}

function EssayContent({ essays }: { essays: Essay[] }) {
  const inProgress = essays.filter((e) => e.status !== 'done')
  const latest = essays[0]

  if (essays.length === 0) return <p className="text-2xs italic text-muted-foreground/60">Henüz essay yok.</p>
  return (
    <>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-foreground">{inProgress.length}</span>
        <span className="text-xs text-muted-foreground">sürüyor</span>
      </div>
      {latest && (
        <p className="line-clamp-1 text-2xs text-muted-foreground">
          Son: {latest.title} · {ESSAY_STATUS_LABEL[latest.status]}
        </p>
      )}
    </>
  )
}

// ─── planlanan modüller (sabit meta-kart, pin/resize/arşiv sisteminin dışında) ─
// Finans/Beden/Keşif yalnızca generic `modules` jsonb çuvalına (ModuleDetail)
// bağlı — kendi şeması/UI'ı yok. Takvim/Notion/Alışkanlık kendi tablolarına
// (calendar_events, block_pages, habits+habit_logs) sahip gerçek modüller
// olduğu için burada DEĞİL.

type PlannedModule = { id: string; href: string; icon: LucideIcon; title: string }

const PLANNED_MODULES: PlannedModule[] = [
  { id: 'finance',  href: '/dashboard/finance',  icon: Wallet,    title: 'Finans' },
  { id: 'body',     href: '/dashboard/body',     icon: Dumbbell,  title: 'Beden' },
  { id: 'discover', href: '/dashboard/discover', icon: Telescope, title: 'Keşif' },
]

function PlannedModulesCard() {
  return (
    <div className="flex min-h-[150px] flex-col gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-4">
      <h3 className="text-sm font-medium text-foreground">Planlanan Modüller</h3>
      <div className="flex flex-col gap-1">
        {PLANNED_MODULES.map((m) => {
          const Icon = m.icon
          return (
            <Link
              key={m.id}
              href={m.href}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Icon className="size-4" strokeWidth={1.75} />
              <span className="flex-1">{m.title}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-3xs text-muted-foreground/70">Planda</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function EmptyModulesCard() {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center sm:col-span-2 lg:col-span-3 xl:col-span-4">
      <p className="text-sm font-medium text-foreground">Tüm modüller kapalı</p>
      <p className="max-w-xs text-2xs text-muted-foreground">
        Verilerin duruyor — sol alttaki profilinden açılan Ayarlar panelinden istediğini yeniden açabilirsin.
      </p>
    </div>
  )
}

// ─── diğer kart içerikleri ───────────────────────────────────────────────────

function AliskanlikContent({ logs }: { logs: Record<string, boolean> }) {
  const today    = todayISO()
  const days     = weekDates(new Date(today))
  const total    = days.length * HABIT_IDS.length
  const done     = days.reduce(
    (s, d) => s + HABIT_IDS.filter((hid) => logs[`${localISO(d)}|${hid}`]).length, 0,
  )
  const pct      = Math.round((done / total) * 100)
  const todayN   = HABIT_IDS.filter((hid) => logs[`${today}|${hid}`]).length
  const tone     = pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'destructive'

  return (
    <>
      <div>
        <p className="text-xl font-semibold text-foreground">
          {todayN}<span className="text-sm font-normal text-muted-foreground">/{HABIT_IDS.length}</span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">bugün</span>
        </p>
      </div>
      <Bar pct={pct} tone={tone} />
      <p className="text-2xs text-muted-foreground/70">Bu hafta {done}/{total} tamamlandı</p>
    </>
  )
}

function IeltsContent({ mod }: { mod: ModuleItem | null }) {
  const target    = (mod?.data?.ielts_target as string) ?? '7.0+'
  const examDate  = (mod?.data?.ielts_date   as string) ?? 'Eylül 2026'
  const level     = (mod?.data?.current_level as string) ?? '—'
  const words     = ((mod?.data?.words as unknown[]) ?? []).length

  // days until Sep 2026
  const daysLeft = Math.max(0, Math.ceil(
    (new Date('2026-09-01').getTime() - Date.now()) / 86400000,
  ))

  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold text-foreground">{daysLeft}</span>
        <span className="text-xs text-muted-foreground">gün kaldı</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-2xs text-muted-foreground">Hedef: <span className="text-foreground">{target}</span> · {examDate}</p>
        <p className="text-2xs text-muted-foreground/70">Seviye: {level} · {words} kelime</p>
      </div>
    </>
  )
}

function RoadmapContent({ mod }: { mod: ModuleItem | null }) {
  const milestones = ((mod?.data?.milestones as Array<{title:string;date:string;status?:string}>) ?? [])
    .filter((m) => m.status !== 'done')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const next = milestones[0]
  const focus = (mod?.data?.current_focus as string) ?? ''

  if (!next && !focus) return <p className="text-2xs italic text-muted-foreground/60">Milestone eklenmemiş.</p>
  return (
    <>
      {next ? (
        <>
          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{next.title}</p>
          <p className="text-2xs text-muted-foreground">{next.date}</p>
        </>
      ) : (
        <p className="text-sm font-medium text-foreground">{focus}</p>
      )}
    </>
  )
}

function AgentContent() {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="text-sm font-medium text-muted-foreground">Agent hazır</span>
      </div>
      <p className="text-2xs text-muted-foreground/60">Agent ofisini aç →</p>
    </>
  )
}

function BursAkademiContent({ mod }: { mod: ModuleItem | null }) {
  const schools = (mod?.data?.schools as Array<{ status: string; name: string }>) ?? []
  const hedef   = schools.filter((s) => s.status === 'hedef').length
  const basv    = schools.filter((s) => s.status === 'basvuruldu').length

  if (schools.length === 0) return <p className="text-2xs italic text-muted-foreground/60">Okul listesini aç →</p>
  return (
    <>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-foreground">{schools.length}</span>
        <span className="text-xs text-muted-foreground">okul takipte</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {hedef > 0 && (
          <p className="text-2xs">
            <span className="font-medium text-foreground">{hedef}</span>
            <span className="text-muted-foreground/70"> hedef okul</span>
          </p>
        )}
        {basv > 0 && (
          <p className="text-2xs">
            <span className="font-medium text-foreground">{basv}</span>
            <span className="text-muted-foreground/70"> başvuruldu</span>
          </p>
        )}
        {hedef === 0 && basv === 0 && (
          <p className="text-2xs text-muted-foreground/60">Henüz hedef belirlenmedi</p>
        )}
      </div>
    </>
  )
}

function TakvimContent() {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="text-sm font-medium text-muted-foreground">Haftalık plan</span>
      </div>
      <p className="text-2xs text-muted-foreground/60">7 gün × 24 saat görünüm</p>
    </>
  )
}

function NotionContent() {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="text-sm font-medium text-muted-foreground">Block editör</span>
      </div>
      <p className="text-2xs text-muted-foreground/60">Sandbox → aç</p>
    </>
  )
}

function ArsivContent({ mod }: { mod: ModuleItem | null }) {
  const entries = ((mod?.data?.entries as Array<{date:string;summary?:string}>) ?? [])
  const last    = [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]

  if (!last) return <p className="text-2xs italic text-muted-foreground/60">Kayıt yok.</p>
  return (
    <>
      <p className="text-2xs text-muted-foreground">Son kayıt: <span className="text-foreground/70">{last.date}</span></p>
      {last.summary && (
        <p className="line-clamp-2 text-2xs leading-relaxed text-muted-foreground/70">{last.summary}</p>
      )}
    </>
  )
}

// ─── sıralama: pinlenmiş önce, sonra gerçek verisi olan ("aktif") kart önce ──
// (0 ise 0 gösterir — sayı değişmez, yalnız veri yoksa kart geriye düşer.)

function sortCards(cards: DashboardCardDef[], layout: Record<string, { pinned?: boolean; archived?: boolean; span?: Span }>) {
  return cards
    .filter((c) => !layout[c.id]?.archived)
    .sort((a, b) => {
      const pinDiff = Number(!!layout[b.id]?.pinned) - Number(!!layout[a.id]?.pinned)
      if (pinDiff !== 0) return pinDiff
      return Number(b.hasData) - Number(a.hasData)
    })
}

// ─── page ─────────────────────────────────────────────────────────────────────

const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

export default function DashboardPage() {
  const [modules,      setModules]      = useState<ModuleItem[]>([])
  const [logs,         setLogs]         = useState<Record<string, boolean>>({})
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null)
  const [goals,        setGoals]        = useState<GoalSummary[]>([])
  const [essays,       setEssays]       = useState<Essay[]>([])
  const [customize,    setCustomize]    = useState(false)
  const { settings, loaded: settingsLoaded } = useModuleSettings()
  const { layout, update: updateLayout } = useDashboardLayout()

  useEffect(() => {
    dbLoadHabitLogs().then(setLogs).catch(() => {})
    dbLoadModules().then(setModules).catch(() => {})
    dbLoadRecentJournalEntries(1).then((rows) => setJournalEntry(rows[0] ?? null)).catch(() => {})
    dbLoadGoals().then(setGoals).catch(() => {})
    dbLoadEssays().then(setEssays).catch(() => {})

    function onUpdate() {
      dbLoadModules().then(setModules).catch(() => {})
    }
    window.addEventListener('reborn:modules-updated', onUpdate)
    return () => window.removeEventListener('reborn:modules-updated', onUpdate)
  }, [])

  function mod(id: string) { return modules.find((m) => m.id === id) ?? null }

  const showJournal = settingsLoaded && isModuleEnabled(settings, 'journal')
  const showGoals   = settingsLoaded && isModuleEnabled(settings, 'goals')
  const showEssay   = settingsLoaded && isModuleEnabled(settings, 'essay')
  const noCoreModules = settingsLoaded && !showJournal && !showGoals && !showEssay

  const activeGoals = goals.filter((g) => g.status === 'active')

  const englishMod  = mod('english')
  const roadmapMod  = mod('roadmap')
  const bursMod     = mod('burs-akademisi')
  const arsivMod    = mod('daily')

  const days = weekDates(new Date(todayISO()))
  const weekDone = days.reduce(
    (s, d) => s + HABIT_IDS.filter((hid) => logs[`${localISO(d)}|${hid}`]).length, 0,
  )
  const roadmapMilestones = ((roadmapMod?.data?.milestones as Array<{status?:string}>) ?? [])

  const coreCards: DashboardCardDef[] = []
  if (showJournal) coreCards.push({
    id: 'journal', href: '/dashboard/gunluk', icon: NotebookPen, title: 'Günlük',
    defaultSpan: 'sm', hasData: !!journalEntry,
    content: <GunlukContent entry={journalEntry} />,
  })
  if (showGoals) coreCards.push({
    id: 'goals', href: '/dashboard/hedefler', icon: Target, title: 'Hedefler',
    defaultSpan: 'sm', hasData: activeGoals.length > 0,
    content: <HedeflerContent goals={goals} active={activeGoals} />,
  })
  if (showEssay) coreCards.push({
    id: 'essay', href: '/dashboard/essay', icon: PenTool, title: 'Essay',
    defaultSpan: 'sm', hasData: essays.length > 0,
    content: <EssayContent essays={essays} />,
  })

  const overviewCards: DashboardCardDef[] = [
    {
      id: 'habit', href: '/aliskanlik', icon: Flame, title: 'Alışkanlık',
      defaultSpan: 'sm', hasData: weekDone > 0,
      content: <AliskanlikContent logs={logs} />,
    },
    {
      id: 'english', href: '/ingilizce', icon: Languages, title: 'İngilizce / IELTS',
      defaultSpan: 'sm',
      hasData: ((englishMod?.data?.words as unknown[]) ?? []).length > 0 || !!englishMod?.data?.current_level,
      content: <IeltsContent mod={englishMod} />,
    },
    {
      id: 'roadmap', href: '/dashboard/roadmap', icon: Map, title: 'Yol Haritası',
      defaultSpan: 'sm',
      hasData: roadmapMilestones.filter((m) => m.status !== 'done').length > 0 || !!roadmapMod?.data?.current_focus,
      content: <RoadmapContent mod={roadmapMod} />,
    },
    {
      id: 'agent', href: '/maxai/panel', icon: Bot, title: 'Agent Panel',
      defaultSpan: 'sm', hasData: false,
      content: <AgentContent />,
    },
    {
      id: 'burs-akademisi', href: '/burs-akademisi', icon: GraduationCap, title: 'Burs Akademisi',
      defaultSpan: 'sm', hasData: (((bursMod?.data?.schools as unknown[]) ?? []).length > 0),
      content: <BursAkademiContent mod={bursMod} />,
    },
    {
      id: 'archive', href: '/dashboard/daily', icon: Archive, title: 'Arşiv',
      defaultSpan: 'sm',
      hasData: (((arsivMod?.data?.entries as unknown[]) ?? []).length > 0),
      dimmed: !(((arsivMod?.data?.entries as unknown[]) ?? []).length > 0),
      content: <ArsivContent mod={arsivMod} />,
    },
    {
      id: 'calendar', href: '/takvim', icon: Calendar, title: 'Takvim',
      defaultSpan: 'sm', hasData: false,
      content: <TakvimContent />,
    },
    {
      id: 'notion', href: '/notion', icon: FileText, title: 'Notion',
      defaultSpan: 'sm', hasData: false,
      content: <NotionContent />,
    },
  ]

  const sortedCore     = sortCards(coreCards, layout)
  const sortedOverview = sortCards(overviewCards, layout)

  const archivedCards = [...coreCards, ...overviewCards].filter((c) => layout[c.id]?.archived)

  function renderCard(def: DashboardCardDef) {
    const st = layout[def.id]
    return (
      <DashboardCard
        key={def.id}
        def={def}
        customize={customize}
        pinned={!!st?.pinned}
        span={st?.span ?? def.defaultSpan}
        onTogglePin={() => updateLayout(def.id, { pinned: !st?.pinned })}
        onToggleSpan={() => updateLayout(def.id, { span: (st?.span ?? def.defaultSpan) === 'lg' ? 'sm' : 'lg' })}
        onArchive={() => updateLayout(def.id, { archived: true })}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeader title="Dashboard" subtitle="Reborn — genel bakış">
        <button
          onClick={() => setCustomize((c) => !c)}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            customize ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.75} />
          {customize ? 'Bitti' : 'Özelleştir'}
        </button>
      </SectionHeader>

      <div className="no-scrollbar flex-1 overflow-y-auto p-6">
        {/* Faz 2 çekirdeği: Günlük, Hedefler, Essay — hafızaya beslenen yaşam verisi */}
        <section className="mb-10">
          <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Modüller</h2>
          <div className={CARD_GRID}>
            {noCoreModules && <EmptyModulesCard />}
            {sortedCore.map(renderCard)}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Genel Bakış</h2>
          <div className={CARD_GRID}>
            {sortedOverview.map(renderCard)}
            <PlannedModulesCard />
          </div>
        </section>

        {archivedCards.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Archive className="size-3.5" /> Arşivlenmiş ({archivedCards.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {archivedCards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => updateLayout(c.id, { archived: false })}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArchiveRestore className="size-3.5" />
                  {c.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
