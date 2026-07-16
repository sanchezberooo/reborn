'use client'

// MAXAI Agent Panel (Sprint 7) — şirket yönetim ekranı. Yapı:
//   Executive Council şeridi → 13 departman accordion'u → Legacy rafı.
// Her departman Department → Head → Worker hiyerarşisiyle açılır; koltuklar
// lib/company/registry.ts'ten gelir (departman için AYRI sayfa yok — bilgi
// burada yaşar). Runtime-bağlı koltuklar GERÇEK veriyle çalışır: durum
// agent_runs'tan (5 sn polling — koşu aktifken), Çalıştır butonu /api/agents/run.
// Planned koltuklar tek sabit presence gösterir (mock üretilmez).
//
// Legacy rafı: company yapısına girmeyen emekli ajanlar (İngilizce/Burs/Essay
// hattı) — Sprint 1-6 çalıştırma davranışı BOZULMAZ diye eski tablo satırı ve
// girdi kurulumu (weekNum) aynen korunur.

import { useState, useEffect, useCallback } from 'react'
import {
  COMPANY_AGENTS,
  EXECUTIVE_COUNCIL,
  findSeatByRuntimeAgent,
  getHeadAgent,
  listCompanyAgents,
  listCompanyDepartments,
  plannedPresence,
} from '@/lib/company/registry'
import type { AgentPresence, CompanyAgent } from '@/lib/company/types'
import { cn } from '@/lib/utils'

// ─── türler (API sözleşmeleri) ────────────────────────────────────────────────

interface AgentMeta { name: string; displayName: string; moduleTarget: string | null }
interface AgentRun {
  id: string; agent_name: string; status: string
  input: unknown; output: unknown
  module_target: string | null; error: string | null
  started_at: string; finished_at: string | null
}
interface AgentLog { id: string; action: string; result: string; created_at: string }

// Registry'de açıklama alanı yok; legacy ajanların UI metinleri burada eşlenir.
const AGENT_DESC: Record<string, string> = {
  'ingilizce-genel-plan':  '10 haftalık IELTS yol haritası üretir',
  'ingilizce-planlayici':  'Haftalık detaylı günlük ders planı hazırlar',
  'kesif-arastirmaci':     "Web'de derinlemesine araştırma ve analiz yapar",
  'burs-toplu-arastirma':  'ABD üniversiteleri toplu burs araştırması yürütür',
  'burs-derinlestir':      'Tek okul için ayrıntılı burs profili çıkarır',
  'essay-brainstorm':      'Essay için kişisel hikayeyi kazan sorular üretir',
  'essay-critic':          'Essay taslağını 6 eksende eleştirir — metin yazmaz',
}

// ─── yardımcılar ──────────────────────────────────────────────────────────────

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtRelative(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'az önce'
  if (mins < 60) return `${mins} dk önce`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} sa önce`
  return `${Math.floor(hrs / 24)} gün önce`
}

/** Koşu girdisinden tek satırlık görev özeti (Current Task kolonu). */
function runTask(run?: AgentRun): string | null {
  if (!run) return null
  const input = run.input as Record<string, unknown> | null
  if (input && typeof input === 'object') {
    for (const key of ['topic', 'schoolName', 'essayPrompt', 'weekNumber', 'message', 'objective', 'brief']) {
      const v = input[key]
      if (v !== undefined && v !== null && v !== '') {
        return key === 'weekNumber' ? `Hafta ${v}` : String(v).slice(0, 80)
      }
    }
    const keys = Object.keys(input)
    if (keys.length > 0) return keys.slice(0, 3).join(', ')
  }
  return null
}

/** agent_runs son koşusu → koltuk presence'ı. Runtime-bağlı koltukların TEK
 *  canlı-veri türetme noktası — Ofis değil Panel sözlüğüdür, mock değildir. */
function presenceFromRun(run?: AgentRun): AgentPresence {
  if (!run) {
    return { status: 'idle', currentTask: null, lastActivityAt: null, runtime: 'agent-runner', health: 'unknown' }
  }
  const status: AgentPresence['status'] =
    run.status === 'running' ? 'working' : run.status === 'error' ? 'error' : 'idle'
  return {
    status,
    currentTask: run.status === 'running' ? runTask(run) : null,
    lastActivityAt: run.started_at,
    runtime: 'agent-runner',
    health: run.status === 'error' ? 'degraded' : 'healthy',
  }
}

const STATUS_META: Record<AgentPresence['status'], { label: string; dot: string; text: string }> = {
  planned: { label: 'Planlandı', dot: 'bg-muted-foreground/40',    text: 'text-muted-foreground' },
  idle:    { label: 'Hazır',     dot: 'bg-emerald-400',            text: 'text-emerald-400' },
  working: { label: 'Çalışıyor', dot: 'bg-success animate-pulse',  text: 'text-success' },
  error:   { label: 'Hata',      dot: 'bg-destructive',            text: 'text-destructive' },
}

const HEALTH_LABEL: Record<AgentPresence['health'], string> = {
  unknown: '—', healthy: 'Sağlıklı', degraded: 'Sorunlu',
}

function PresenceBadge({ status }: { status: AgentPresence['status'] }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-2xs font-medium', meta.text)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

function RunBadge({ status }: { status?: string }) {
  if (!status) {
    return <span className="text-2xs italic text-muted-foreground/60">Hiç çalışmadı</span>
  }
  const meta = ({
    running: { label: 'Çalışıyor', dot: 'bg-success animate-pulse', text: 'text-success' },
    done:    { label: 'Tamam',     dot: 'bg-emerald-400',           text: 'text-emerald-400' },
    error:   { label: 'Hata',      dot: 'bg-destructive',           text: 'text-destructive' },
  } as Record<string, { label: string; dot: string; text: string }>)[status]
    ?? { label: status, dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-2xs font-medium', meta.text)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

// ─── Runner girdi kurulumu (legacy ajanlar — davranış Sprint 1-6'dan aynen) ───

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const WEEK1 = new Date('2026-06-29T00:00:00')
const PHASE_TITLES: Record<number, string> = {
  1: 'Faz 1: Temel Sağlamlaştırma (A1→A2)', 2: 'Faz 1: Temel Sağlamlaştırma (A1→A2)',
  3: 'Faz 2: Yapı ve Üretim (A2)',           4: 'Faz 2: Yapı ve Üretim (A2)',
  5: 'Faz 3: Akıcılık Geliştirme (A2→B1)',  6: 'Faz 3: Akıcılık Geliştirme (A2→B1)',
  7: 'Faz 4: IELTS Tekniği (B1)',            8: 'Faz 4: IELTS Tekniği (B1)',
  9: 'Faz 5: Tam Bant Pratik (B1→B2)',      10: 'Faz 5: Tam Bant Pratik (B1→B2)',
}

function weekDates(wn: number): string {
  const s = new Date(WEEK1); s.setDate(s.getDate() + (wn - 1) * 7)
  const e = new Date(s);     e.setDate(e.getDate() + 5)
  return `${s.getDate()} ${MONTHS_TR[s.getMonth()]} - ${e.getDate()} ${MONTHS_TR[e.getMonth()]}`
}

function buildInput(name: string, weekNum: number): Record<string, unknown> {
  const base = {
    startLevel: 'A1', comprehension: 'strong', production: 'weak',
    biggestFear: 'writing', target: 'IELTS 6.0 (stretch 7.0)',
    examDate: '2026-09-05', hoursPerDay: '4-5', daysPerWeek: 6, restDay: 'Sunday',
  }
  if (name === 'ingilizce-planlayici') return {
    ...base, weekNumber: weekNum, weekDates: weekDates(weekNum),
    phaseTitle: PHASE_TITLES[weekNum] ?? `Hafta ${weekNum}`, previousWeekSummary: '',
  }
  if (name === 'ingilizce-genel-plan') return { ...base, startDate: '2026-06-29' }
  return { message: 'ping' }
}

// ─── koşu satırı (genişleyebilir: input/output/hata/tool logları) ─────────────

function RunRow({ run }: { run: AgentRun }) {
  const [open,    setOpen]    = useState(false)
  const [logs,    setLogs]    = useState<AgentLog[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded,  setLoaded]  = useState(false)

  const toggle = async () => {
    if (!open && !loaded) {
      setLoading(true)
      const r = await fetch(`/api/agents/logs?run_id=${run.id}`)
      setLogs(await r.json())
      setLoaded(true)
      setLoading(false)
    }
    setOpen((v) => !v)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
      >
        <RunBadge status={run.status} />
        <span className="flex-1 truncate font-mono text-3xs text-muted-foreground/70">{run.id}</span>
        <span className="shrink-0 text-2xs text-muted-foreground">{fmtTs(run.started_at)}</span>
        <span className={cn('shrink-0 text-2xs text-muted-foreground transition-transform', open && 'rotate-90')}>›</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border/60 px-4 pb-4 pt-3">
          {run.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-2xs leading-relaxed text-destructive">
              {run.error}
            </div>
          )}
          <div>
            <p className="mb-1.5 text-3xs font-medium uppercase tracking-widest text-muted-foreground">Input</p>
            <pre className="max-h-40 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-background px-3 py-2.5 text-3xs leading-relaxed text-foreground/60">
              {JSON.stringify(run.input, null, 2)}
            </pre>
          </div>
          <div>
            <p className="mb-1.5 text-3xs font-medium uppercase tracking-widest text-muted-foreground">Output</p>
            <pre className="max-h-56 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-background px-3 py-2.5 text-3xs leading-relaxed text-foreground/70">
              {run.output ? JSON.stringify(run.output, null, 2) : '—'}
            </pre>
          </div>
          {loading && <p className="text-2xs text-muted-foreground">Loglar yükleniyor…</p>}
          {!loading && logs.length > 0 && (
            <div>
              <p className="mb-1.5 text-3xs font-medium uppercase tracking-widest text-muted-foreground">Tool Logları</p>
              <div className="flex flex-col gap-1">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="mb-0.5 text-3xs font-semibold text-primary">{log.action}</p>
                    <p className="truncate text-3xs text-foreground/50">{log.result}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!loading && loaded && logs.length === 0 && (
            <p className="text-3xs text-muted-foreground/60">Tool log yok (direkt JSON ajanı).</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ajan detay paneli (koşu geçmişi — runtime-bağlı koltuklar + legacy) ──────

function AgentDetailPanel({
  agentName, displayName, description, latestRun, runCount, onClose,
}: {
  agentName: string
  displayName: string
  description: string
  latestRun?: AgentRun
  runCount: number
  onClose: () => void
}) {
  const [runs,    setRuns]    = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const r = await fetch(`/api/agents/runs?agent=${agentName}`)
    setRuns(await r.json())
    setLoading(false)
  }, [agentName])

  useEffect(() => { load() }, [load])

  // koşu aktifken 5 sn'de bir tazele
  useEffect(() => {
    if (!runs.some((r) => r.status === 'running')) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [runs, load])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-[520px] overflow-y-auto border-l border-border bg-background shadow-2xl">
        <div className="px-7 py-7">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 text-xl leading-none text-muted-foreground transition-colors hover:text-foreground"
          >
            ×
          </button>

          <div className="mb-6">
            <h2 className="text-xl font-semibold leading-tight text-foreground">{displayName}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            <p className="mt-1.5 font-mono text-3xs text-muted-foreground/60">{agentName}</p>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { label: 'Toplam Koşu', value: runCount >= 20 ? '20+' : runCount > 0 ? String(runCount) : '—' },
              { label: 'Son Durum',   value: latestRun?.status ?? '—' },
              { label: 'Son Çalışma', value: latestRun ? fmtRelative(latestRun.started_at) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3">
                <p className="text-3xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <p className="mb-3 text-3xs font-medium uppercase tracking-widest text-muted-foreground">Son Çalıştırmalar</p>
          {loading && <div className="py-10 text-center text-sm text-muted-foreground/60">Yükleniyor…</div>}
          {!loading && runs.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground/60">Henüz çalıştırma yok.</div>
          )}
          <div className="flex flex-col gap-2">
            {runs.map((run) => <RunRow key={run.id} run={run} />)}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── koltuk satırı (departman accordion içeriği) ──────────────────────────────

function SeatRow({
  seat, presence, onOpenDetail, onRun, running,
}: {
  seat: CompanyAgent
  presence: AgentPresence
  onOpenDetail?: () => void
  onRun?: () => void
  running: boolean
}) {
  const isLive = Boolean(seat.runtimeAgentName)
  return (
    <tr
      className={cn(
        'border-b border-border/60 transition-colors last:border-0',
        isLive && 'cursor-pointer hover:bg-secondary/40',
        !isLive && 'opacity-70',
      )}
      onClick={isLive ? onOpenDetail : undefined}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-3xs font-semibold uppercase tracking-wider',
            seat.role === 'head' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
          )}>
            {seat.role === 'head' ? 'Head' : 'Worker'}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{seat.title}</p>
            <p className="truncate text-3xs text-muted-foreground/70">{seat.mission}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5"><PresenceBadge status={presence.status} /></td>
      <td className="max-w-[180px] truncate px-4 py-2.5 text-muted-foreground">
        {presence.currentTask ?? '—'}
      </td>
      <td className="px-4 py-2.5">
        {seat.capabilities.length > 0 ? (
          <div className="flex max-w-[220px] flex-wrap gap-1">
            {seat.capabilities.map((cap) => (
              <span key={cap} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-3xs text-muted-foreground">
                {cap}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="max-w-[170px] px-4 py-2.5 text-3xs leading-snug text-muted-foreground">
        {seat.permissionSummary}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
        {presence.lastActivityAt ? fmtRelative(presence.lastActivityAt) : '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-3xs text-muted-foreground">
        {presence.runtime ?? '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
        {HEALTH_LABEL[presence.health]}
      </td>
      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        {isLive && onRun && (
          <button
            onClick={onRun}
            disabled={running}
            className="rounded-lg bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {running ? '⏳' : 'Çalıştır'}
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── panel ────────────────────────────────────────────────────────────────────

interface DetailTarget { agentName: string; displayName: string; description: string }

export default function MAXAIPanel() {
  const [agents,    setAgents]    = useState<AgentMeta[]>([])
  const [latestRun, setLatestRun] = useState<Record<string, AgentRun>>({})
  const [runCount,  setRunCount]  = useState<Record<string, number>>({})
  const [detail,    setDetail]    = useState<DetailTarget | null>(null)
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set(['knowledge']))
  const [running,   setRunning]   = useState(false)
  const [weekNum,   setWeekNum]   = useState(1)
  const [loading,   setLoading]   = useState(true)

  const loadAll = useCallback(async () => {
    const res  = await fetch('/api/agents/list')
    const list: AgentMeta[] = await res.json()
    setAgents(list)
    setLoading(false)
    await Promise.all(list.map(async (a) => {
      const r    = await fetch(`/api/agents/runs?agent=${a.name}`)
      const runs: AgentRun[] = await r.json()
      setRunCount((p) => ({ ...p, [a.name]: runs.length }))
      if (runs.length > 0) setLatestRun((p) => ({ ...p, [a.name]: runs[0] }))
    }))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // koşu aktifken 5 sn'de bir tazele (Sprint 1-6 polling deseni aynen)
  useEffect(() => {
    if (!Object.values(latestRun).some((r) => r.status === 'running')) return
    const id = setInterval(loadAll, 5000)
    return () => clearInterval(id)
  }, [latestRun, loadAll])

  const runAgent = async (name: string) => {
    setRunning(true)
    try {
      await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: name, input: buildInput(name, weekNum) }),
      })
      await loadAll()
    } finally {
      setRunning(false)
    }
  }

  const toggleDept = (id: string) =>
    setOpenDepts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const metaByName = Object.fromEntries(agents.map((a) => [a.name, a]))
  const seatPresence = (seat: CompanyAgent): AgentPresence =>
    seat.runtimeAgentName ? presenceFromRun(latestRun[seat.runtimeAgentName]) : plannedPresence()

  // Company yapısına girmeyen runtime ajanlar = Legacy rafı (emekli hat).
  const legacyAgents = agents.filter((a) => !findSeatByRuntimeAgent(a.name))
  const liveSeatCount = COMPANY_AGENTS.filter((s) => s.runtimeAgentName).length
  const runningCount = Object.values(latestRun).filter((r) => r.status === 'running').length

  const openSeatDetail = (seat: CompanyAgent) => {
    if (!seat.runtimeAgentName) return
    setDetail({
      agentName: seat.runtimeAgentName,
      displayName: metaByName[seat.runtimeAgentName]?.displayName ?? seat.title,
      description: seat.mission,
    })
  }

  return (
    <div className="no-scrollbar flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* özet şeridi — gerçek registry + agent_runs sayıları */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">MAXAI Company</p>
          <p className="text-2xs text-muted-foreground">
            {listCompanyDepartments().length} departman · {COMPANY_AGENTS.length} koltuk ·{' '}
            {liveSeatCount} canlı ajan · durumlar agent_runs tablosundan canlı
          </p>
        </div>
        {runningCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            {runningCount} koşu aktif — otomatik yenileniyor
          </span>
        )}
      </div>

      {/* Executive Council — departman değil, Company Layer */}
      <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">Executive Council</p>
            <p className="text-2xs text-muted-foreground">
              Company Layer — 13 Head Agent temsil edilir, kararı Sanchez verir. Toplantılar ileride burada.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-3xs font-semibold text-amber-500">
            ★ {EXECUTIVE_COUNCIL.chair.title}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXECUTIVE_COUNCIL.memberAgentIds.map((seatId) => {
            const seat = COMPANY_AGENTS.find((a) => a.id === seatId)
            if (!seat) return null
            const presence = seatPresence(seat)
            return (
              <span
                key={seatId}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-3xs text-foreground/80"
                title={seat.title}
              >
                <span className={cn('size-1.5 rounded-full', STATUS_META[presence.status].dot)} />
                {seat.title.replace(/^Head of /, '')}
              </span>
            )
          })}
        </div>
      </div>

      {/* 13 departman — accordion: Department → Head → Worker */}
      <div className="flex flex-col gap-2">
        {listCompanyDepartments().map((department) => {
          const head = getHeadAgent(department.id)
          const workers = listCompanyAgents({ departmentId: department.id, role: 'worker' })
          const headPresence = seatPresence(head)
          const open = openDepts.has(department.id)
          return (
            <div key={department.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <button
                onClick={() => toggleDept(department.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{department.displayName}</p>
                  <p className="truncate text-2xs text-muted-foreground">{department.mission}</p>
                </div>
                <span className="shrink-0 text-2xs text-muted-foreground">
                  1 head · {workers.length} worker
                </span>
                <PresenceBadge status={headPresence.status} />
                <span className={cn('shrink-0 text-2xs text-muted-foreground transition-transform', open && 'rotate-90')}>›</span>
              </button>

              {open && (
                <div className="overflow-x-auto border-t border-border/60">
                  <table className="w-full min-w-[980px] text-left text-2xs">
                    <thead>
                      <tr className="border-b border-border text-3xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Agent</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Current Task</th>
                        <th className="px-4 py-2 font-medium">Capability</th>
                        <th className="px-4 py-2 font-medium">Permission</th>
                        <th className="px-4 py-2 font-medium">Last Activity</th>
                        <th className="px-4 py-2 font-medium">Runtime</th>
                        <th className="px-4 py-2 font-medium">Health</th>
                        <th className="px-4 py-2 text-right font-medium">Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[head, ...workers].map((seat) => {
                        const runtimeName = seat.runtimeAgentName
                        return (
                          <SeatRow
                            key={seat.id}
                            seat={seat}
                            presence={seatPresence(seat)}
                            running={running}
                            onOpenDetail={() => openSeatDetail(seat)}
                            onRun={runtimeName ? () => runAgent(runtimeName) : undefined}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legacy rafı — emekli ajanlar, Sprint 1-6 çalıştırma davranışı aynen */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Legacy</p>
          <p className="text-2xs text-muted-foreground">
            Emekli ajanlar — şirket yapısının dışında, geçmiş koşular ve çalıştırma korunur.
          </p>
        </div>
        <table className="w-full text-left text-2xs">
          <thead>
            <tr className="border-b border-border text-3xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium">Görev</th>
              <th className="px-4 py-2.5 font-medium">Durum</th>
              <th className="px-4 py-2.5 text-right font-medium">Koşu</th>
              <th className="px-4 py-2.5 font-medium">Son Çalışma</th>
              <th className="px-4 py-2.5 text-right font-medium">Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground/60">
                Registry&apos;den yükleniyor…
              </td></tr>
            )}
            {!loading && legacyAgents.map((agent) => {
              const latest = latestRun[agent.name]
              return (
                <tr
                  key={agent.name}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/40"
                  onClick={() => setDetail({
                    agentName: agent.name,
                    displayName: agent.displayName,
                    description: AGENT_DESC[agent.name] ?? 'AI agent',
                  })}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{agent.displayName}</p>
                    <p className="mt-0.5 font-mono text-3xs text-muted-foreground/60">{agent.name}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{AGENT_DESC[agent.name] ?? 'AI agent'}</td>
                  <td className="px-4 py-3"><RunBadge status={latest?.status} /></td>
                  <td className="px-4 py-3 text-right text-foreground/90">
                    {(runCount[agent.name] ?? 0) >= 20 ? '20+' : runCount[agent.name] ?? 0}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {latest ? fmtRelative(latest.started_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1.5">
                      {agent.name === 'ingilizce-planlayici' && (
                        <input
                          type="number" min={1} max={10} value={weekNum}
                          onChange={(e) => setWeekNum(Number(e.target.value))}
                          className="w-12 rounded-lg border border-border bg-background px-1.5 py-1 text-center text-2xs text-foreground focus:outline-none"
                          title="Hafta numarası"
                        />
                      )}
                      <button
                        onClick={() => runAgent(agent.name)}
                        disabled={running}
                        className="rounded-lg bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
                      >
                        {running ? '⏳' : 'Çalıştır'}
                      </button>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detail && (
        <AgentDetailPanel
          agentName={detail.agentName}
          displayName={detail.displayName}
          description={detail.description}
          latestRun={latestRun[detail.agentName]}
          runCount={runCount[detail.agentName] ?? 0}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
