'use client'

// Dashboard — UI v1 nötr dil. Görsel katman v0 kart sistemine taşındı;
// veri katmanı DEĞİŞMEDİ: lib/db dbLoad* çağrıları, modül görünürlük
// çerçevesi (useModuleSettings + module-registry) aynen duruyor.
// Modül Ayarları ve Obsidian senkronu artık burada değil — sol alttaki
// profil avatarından açılan SettingsPanel'de (roadmap §6.1: ayarlar
// için 5. sekme/ayrı yüzey açılmaz).

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  NotebookPen, Target, PenTool, Flame, Wallet, Dumbbell, Languages,
  Map, Telescope, Bot, GraduationCap, Archive, Calendar, FileText,
} from 'lucide-react'
import {
  dbLoadModules, dbLoadHabitLogs, dbLoadRecentJournalEntries, dbLoadGoals, dbLoadEssays,
} from '@/lib/db'
import type { JournalEntry, GoalSummary, Essay, EssayStatus } from '@/lib/db'
import type { ModuleItem } from '@/lib/modules'
import { isModuleEnabled } from '@/lib/module-registry'
import { useModuleSettings } from '@/components/useModuleSettings'
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

// ─── card base ────────────────────────────────────────────────────────────────

function Card({
  href, icon: Icon, title, children, dimmed,
}: {
  href: string
  icon: LucideIcon
  title: string
  children: React.ReactNode
  dimmed?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-h-[150px] flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-ring/30',
        dimmed && 'opacity-55',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-secondary">
          <Icon className="size-4 text-foreground/80" strokeWidth={1.75} />
        </div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2">
        {children}
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

// ─── modül kartları (Faz 2 çekirdeği: Günlük, Hedefler, Essay) ──────────────

function GunlukCard({ entry }: { entry: JournalEntry | null }) {
  const isToday = entry?.date === todayISO()

  return (
    <Card href="/dashboard/gunluk" icon={NotebookPen} title="Günlük">
      {entry ? (
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
      ) : (
        <p className="text-2xs italic text-muted-foreground/60">Henüz günlük yok — ilk kaydını aç.</p>
      )}
    </Card>
  )
}

function HedeflerCard({ goals }: { goals: GoalSummary[] }) {
  const active = goals.filter((g) => g.status === 'active')
  const next = [...active].sort(
    (a, b) => (a.target_date ?? '9999-99-99').localeCompare(b.target_date ?? '9999-99-99'),
  )[0]

  return (
    <Card href="/dashboard/hedefler" icon={Target} title="Hedefler">
      {active.length > 0 ? (
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
      ) : (
        <p className="text-2xs italic text-muted-foreground/60">Henüz hedef yok — Sanchez&apos;le konuşarak oluşturabilirsin.</p>
      )}
    </Card>
  )
}

function EssayCard({ essays }: { essays: Essay[] }) {
  const inProgress = essays.filter((e) => e.status !== 'done')
  const latest = essays[0]

  return (
    <Card href="/dashboard/essay" icon={PenTool} title="Essay">
      {essays.length > 0 ? (
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
      ) : (
        <p className="text-2xs italic text-muted-foreground/60">Henüz essay yok.</p>
      )}
    </Card>
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

// ─── diğer kartlar ───────────────────────────────────────────────────────────

function AliskanlikCard({ logs }: { logs: Record<string, boolean> }) {
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
    <Card href="/aliskanlik" icon={Flame} title="Alışkanlık">
      <div>
        <p className="text-xl font-semibold text-foreground">
          {todayN}<span className="text-sm font-normal text-muted-foreground">/{HABIT_IDS.length}</span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">bugün</span>
        </p>
      </div>
      <Bar pct={pct} tone={tone} />
      <p className="text-2xs text-muted-foreground/70">Bu hafta {done}/{total} tamamlandı</p>
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
    <Card href="/dashboard/finance" icon={Wallet} title="Finans">
      <div>
        <p className={cn('text-xl font-semibold', balance >= 0 ? 'text-success' : 'text-destructive')}>
          {balance >= 0 ? '+' : ''}₺{balance.toLocaleString('tr-TR')}
        </p>
        <p className="mt-0.5 text-2xs text-muted-foreground/70">Bu ay net bakiye</p>
      </div>
      <div className="flex gap-4 text-2xs">
        <span className="text-success/70">↑ ₺{income.toLocaleString('tr-TR')}</span>
        <span className="text-destructive/70">↓ ₺{expenses.toLocaleString('tr-TR')}</span>
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
    <Card href="/dashboard/body" icon={Dumbbell} title="Beden">
      {todayWork ? (
        <>
          <div className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-success" />
            <span className="text-sm font-medium text-success">Bugün yapıldı</span>
          </div>
          <p className="text-2xs text-muted-foreground">{todayWork.type ?? 'Antrenman'}</p>
        </>
      ) : (
        <>
          <p className="text-2xs text-muted-foreground/70">Bugün antrenman yok.</p>
          {lastWork && (
            <p className="text-2xs text-muted-foreground/60">Son: {lastWork.date} · {lastWork.type ?? '—'}</p>
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
    <Card href="/ingilizce" icon={Languages} title="İngilizce / IELTS">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold text-foreground">{daysLeft}</span>
        <span className="text-xs text-muted-foreground">gün kaldı</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-2xs text-muted-foreground">Hedef: <span className="text-foreground">{target}</span> · {examDate}</p>
        <p className="text-2xs text-muted-foreground/70">Seviye: {level} · {words} kelime</p>
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
    <Card href="/dashboard/roadmap" icon={Map} title="Yol Haritası">
      {next ? (
        <>
          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{next.title}</p>
          <p className="text-2xs text-muted-foreground">{next.date}</p>
        </>
      ) : focus ? (
        <p className="text-sm font-medium text-foreground">{focus}</p>
      ) : (
        <p className="text-2xs italic text-muted-foreground/60">Milestone eklenmemiş.</p>
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
    <Card href="/dashboard/discover" icon={Telescope} title="Keşif">
      {lastBook && (
        <div>
          <p className="mb-0.5 text-3xs uppercase tracking-wider text-muted-foreground/60">Kitap</p>
          <p className="line-clamp-1 text-sm font-medium text-foreground">{lastBook.title}</p>
          {lastBook.author && <p className="text-2xs text-muted-foreground/70">{lastBook.author}</p>}
        </div>
      )}
      {lastCourse && (
        <div>
          <p className="mb-0.5 text-3xs uppercase tracking-wider text-muted-foreground/60">Kurs</p>
          <p className="line-clamp-1 text-2xs text-foreground/70">{lastCourse.name}</p>
        </div>
      )}
      {!lastBook && !lastCourse && (
        <p className="text-2xs italic text-muted-foreground/60">Henüz içerik eklenmemiş.</p>
      )}
    </Card>
  )
}

function AgentCard() {
  return (
    <Card href="/agent-panel" icon={Bot} title="Agent Panel">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="text-sm font-medium text-muted-foreground">Agent hazır</span>
      </div>
      <p className="text-2xs text-muted-foreground/60">Agent ofisini aç →</p>
    </Card>
  )
}

function BursAkademiCard({ mod }: { mod: ModuleItem | null }) {
  const schools = (mod?.data?.schools as Array<{ status: string; name: string }>) ?? []
  const hedef   = schools.filter((s) => s.status === 'hedef').length
  const basv    = schools.filter((s) => s.status === 'basvuruldu').length

  return (
    <Card href="/burs-akademisi" icon={GraduationCap} title="Burs Akademisi">
      {schools.length > 0 ? (
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
      ) : (
        <p className="text-2xs italic text-muted-foreground/60">Okul listesini aç →</p>
      )}
    </Card>
  )
}

function TakvimCard() {
  return (
    <Card href="/takvim" icon={Calendar} title="Takvim">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="text-sm font-medium text-muted-foreground">Haftalık plan</span>
      </div>
      <p className="text-2xs text-muted-foreground/60">7 gün × 24 saat görünüm</p>
    </Card>
  )
}

function NotionCard() {
  return (
    <Card href="/notion" icon={FileText} title="Notion">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="text-sm font-medium text-muted-foreground">Block editör</span>
      </div>
      <p className="text-2xs text-muted-foreground/60">Sandbox → aç</p>
    </Card>
  )
}

function ArsivCard({ mod }: { mod: ModuleItem | null }) {
  const entries = ((mod?.data?.entries as Array<{date:string;summary?:string}>) ?? [])
  const last    = [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]

  return (
    <Card href="/dashboard/daily" icon={Archive} title="Arşiv" dimmed={!last}>
      {last ? (
        <>
          <p className="text-2xs text-muted-foreground">Son kayıt: <span className="text-foreground/70">{last.date}</span></p>
          {last.summary && (
            <p className="line-clamp-2 text-2xs leading-relaxed text-muted-foreground/70">{last.summary}</p>
          )}
        </>
      ) : (
        <p className="text-2xs italic text-muted-foreground/60">Kayıt yok.</p>
      )}
    </Card>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

const CARD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

export default function DashboardPage() {
  const [modules,      setModules]      = useState<ModuleItem[]>([])
  const [logs,         setLogs]         = useState<Record<string, boolean>>({})
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null)
  const [goals,        setGoals]        = useState<GoalSummary[]>([])
  const [essays,       setEssays]       = useState<Essay[]>([])
  const { settings, loaded: settingsLoaded } = useModuleSettings()

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeader title="Dashboard" subtitle="Reborn — genel bakış" />

      <div className="no-scrollbar flex-1 overflow-y-auto p-6">
        {/* Faz 2 çekirdeği: Günlük, Hedefler, Essay — hafızaya beslenen yaşam verisi */}
        <section className="mb-10">
          <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Modüller</h2>
          <div className={CARD_GRID}>
            {noCoreModules && <EmptyModulesCard />}
            {showJournal && <GunlukCard entry={journalEntry} />}
            {showGoals   && <HedeflerCard goals={goals} />}
            {showEssay   && <EssayCard essays={essays} />}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Genel Bakış</h2>
          <div className={CARD_GRID}>
            <AliskanlikCard logs={logs} />
            <FinansCard         mod={mod('finance')} />
            <BedenCard          mod={mod('body')} />
            <IeltsCard          mod={mod('english')} />
            <RoadmapCard        mod={mod('roadmap')} />
            <KesifCard          mod={mod('discover')} />
            <AgentCard />
            <BursAkademiCard    mod={mod('burs-akademisi')} />
            <ArsivCard          mod={mod('daily')} />
            <TakvimCard />
            <NotionCard />
          </div>
        </section>
      </div>
    </div>
  )
}
