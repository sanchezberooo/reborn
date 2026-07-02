'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Agent3D } from '@/components/office/Office3D'

const Office3D = dynamic(() => import('@/components/office/Office3D'), { ssr: false })

// ─── constants ────────────────────────────────────────────────────────────────

const GOLD = '#c8a96e'

const AGENT_DESC: Record<string, string> = {
  'ingilizce-genel-plan':  '10 haftalık IELTS yol haritası üretir',
  'ingilizce-planlayici':  'Haftalık detaylı günlük ders planı hazırlar',
  'kesif-arastirmaci':     "Web'de derinlemesine araştırma ve analiz yapar",
  'burs-toplu-arastirma':  'ABD üniversiteleri toplu burs araştırması yürütür',
  'burs-derinlestir':      'Tek okul için ayrıntılı burs profili çıkarır',
  'test-agent':            "Sistem smoke-test — input'u echo eder",
}

// components/office/Office3D.tsx'teki OFFICE_LAYOUT id'leriyle birebir eşleşir.
const AGENT_ICONS: Record<string, string> = {
  'ingilizce-genel-plan':  '🗓️',
  'ingilizce-planlayici':  '📚',
  'kesif-arastirmaci':     '🔍',
  'burs-toplu-arastirma':  '🎓',
  'burs-derinlestir':      '🏛️',
  'test-agent':            '🧪',
}

// ─── types ────────────────────────────────────────────────────────────────────

interface AgentMeta { name: string; displayName: string; moduleTarget: string | null }
interface AgentRun {
  id: string; agent_name: string; status: string
  input: unknown; output: unknown
  module_target: string | null; error: string | null
  started_at: string; finished_at: string | null
}
interface AgentLog { id: string; action: string; result: string; created_at: string }

// ─── utilities ────────────────────────────────────────────────────────────────

function fmtTs(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'az önce'
  if (mins < 60) return `${mins} dk önce`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} sa önce`
  return `${Math.floor(hrs / 24)} gün önce`
}

// ─── run status badge (live runs) ────────────────────────────────────────────

function RunBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const c = ({
    running: { label: 'Çalışıyor', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400',  bg: 'bg-amber-400/10'   },
    done:    { label: 'Tamam',     dot: 'bg-emerald-400',              text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    error:   { label: 'Hata',      dot: 'bg-red-400',                  text: 'text-red-400',     bg: 'bg-red-400/10'     },
  } as Record<string, { label: string; dot: string; text: string; bg: string }>)[status]
    ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-400', bg: 'bg-gray-400/10' }
  const px  = size === 'sm' ? 'px-2 py-0.5' : 'px-2 py-1'
  const txt = size === 'sm' ? 'text-[9px]' : 'text-[9px]'
  return (
    <span className={`inline-flex items-center gap-1.5 ${px} rounded-full ${txt} font-semibold tracking-wide ${c.text} ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ─── live agent card ─────────────────────────────────────────────────────────

function LiveAgentCard({ agent, latestRun, runCount, isSelected, onClick }: {
  agent: AgentMeta
  latestRun?: AgentRun
  runCount: number
  isSelected: boolean
  onClick: () => void
}) {
  const isRunning = latestRun?.status === 'running'
  const isError   = latestRun?.status === 'error'
  const desc      = AGENT_DESC[agent.name] ?? 'AI agent'

  const borderTopColor = isError ? '#ef4444' : GOLD
  const borderColor    = isSelected
    ? `${GOLD}70`
    : isRunning
    ? `${GOLD}35`
    : '#1e2230'
  const shadow = isRunning
    ? `0 0 24px ${GOLD}18, 0 2px 8px rgba(0,0,0,0.5)`
    : isSelected
    ? `0 0 16px ${GOLD}12, 0 2px 8px rgba(0,0,0,0.4)`
    : '0 1px 4px rgba(0,0,0,0.4)'

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 flex flex-col overflow-hidden"
      style={{
        background: '#0d1117',
        borderTopColor,
        borderTopWidth: '2px',
        borderLeftColor: borderColor,
        borderRightColor: borderColor,
        borderBottomColor: borderColor,
        boxShadow: shadow,
        animation: isRunning ? 'cardGlow 2.4s ease-in-out infinite' : 'none',
      }}
    >
      {/* body */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-foreground leading-snug line-clamp-1 group-hover:text-gold transition-colors duration-150">
              {agent.displayName}
            </p>
            <p className="text-[11px] text-muted/50 mt-0.5 leading-snug">{desc}</p>
          </div>

          {/* live pulse for running */}
          {isRunning && (
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: GOLD }} />
                <span className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: GOLD }} />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wide"
                style={{ color: GOLD }}>Live</span>
            </div>
          )}
        </div>

        <p className="text-[9px] font-mono text-muted/25">{agent.name}</p>
      </div>

      {/* footer */}
      <div className="px-5 pb-4 flex items-center justify-between gap-3">
        {latestRun
          ? <RunBadge status={latestRun.status} size="sm" />
          : <span className="text-[9px] italic text-muted/20">Hiç çalışmadı</span>
        }
        <div className="flex items-center gap-3 text-[10px] text-muted/30 shrink-0">
          {runCount > 0 && (
            <span>{runCount >= 20 ? '20+' : runCount} çalıştırma</span>
          )}
          {latestRun && (
            <span>{fmtRelative(latestRun.started_at)}</span>
          )}
        </div>
      </div>

      {/* bottom accent for running */}
      {isRunning && (
        <div className="h-[1px] w-full" style={{
          background: `linear-gradient(90deg, transparent, ${GOLD}60, transparent)`,
        }} />
      )}
    </button>
  )
}

// ─── run row (expandable) ─────────────────────────────────────────────────────

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

  const inputSummary = (() => {
    if (!run.input) return null
    const obj = run.input as Record<string, unknown>
    const keys = Object.keys(obj)
    return keys.slice(0, 2).join(', ') + (keys.length > 2 ? ` +${keys.length - 2}` : '')
  })()

  return (
    <div className="rounded-xl border border-border overflow-hidden transition-colors"
      style={{ background: '#0d1117', borderColor: open ? `${GOLD}30` : '#1e2230' }}>
      {/* row header */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <RunBadge status={run.status} size="sm" />
        <span className="text-[10px] font-mono text-muted/40 flex-1 truncate">{run.id}</span>
        {inputSummary && (
          <span className="text-[9px] text-muted/25 hidden sm:block shrink-0">{inputSummary}</span>
        )}
        <span className="text-[10px] text-muted/30 shrink-0">{fmtTs(run.started_at)}</span>
        <span className="text-[10px] shrink-0 transition-transform duration-200"
          style={{ color: `${GOLD}70`, transform: open ? 'rotate(90deg)' : 'none' }}>
          ›
        </span>
      </button>

      {/* expanded detail */}
      {open && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 flex flex-col gap-3">
          {run.error && (
            <div className="px-3 py-2.5 rounded-lg text-xs text-red-400 leading-relaxed"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              {run.error}
            </div>
          )}

          {/* input */}
          <div>
            <p className="text-[9px] text-muted/35 uppercase tracking-widest font-medium mb-1.5">Input</p>
            <pre className="rounded-lg px-3 py-2.5 text-[10px] text-foreground/50 overflow-x-auto whitespace-pre-wrap leading-relaxed"
              style={{ background: '#080c12', border: '1px solid #1a1f2e', maxHeight: 160 }}>
              {JSON.stringify(run.input, null, 2)}
            </pre>
          </div>

          {/* output */}
          <div>
            <p className="text-[9px] text-muted/35 uppercase tracking-widest font-medium mb-1.5">Output</p>
            <pre className="rounded-lg px-3 py-2.5 text-[10px] text-foreground/55 overflow-x-auto whitespace-pre-wrap leading-relaxed"
              style={{ background: '#080c12', border: '1px solid #1a1f2e', maxHeight: 220 }}>
              {run.output ? JSON.stringify(run.output, null, 2) : '—'}
            </pre>
          </div>

          {/* logs */}
          {loading && (
            <p className="text-[10px] text-muted/25">Loglar yükleniyor…</p>
          )}
          {!loading && logs.length > 0 && (
            <div>
              <p className="text-[9px] text-muted/35 uppercase tracking-widest font-medium mb-1.5">Tool Logları</p>
              <div className="flex flex-col gap-1">
                {logs.map((log) => (
                  <div key={log.id} className="px-3 py-2 rounded-lg"
                    style={{ background: '#080c12', border: '1px solid #1a1f2e' }}>
                    <p className="text-[9px] font-semibold mb-0.5" style={{ color: `${GOLD}aa` }}>{log.action}</p>
                    <p className="text-[10px] text-foreground/35 truncate">{log.result}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!loading && loaded && logs.length === 0 && (
            <p className="text-[10px] text-muted/20">Tool log yok.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── agent detail panel ───────────────────────────────────────────────────────

function AgentDetailPanel({
  agent,
  latestRun,
  runCount,
  onClose,
}: {
  agent: AgentMeta
  latestRun?: AgentRun
  runCount: number
  onClose: () => void
}) {
  const [runs,    setRuns]    = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const r = await fetch(`/api/agents/runs?agent=${agent.name}`)
    setRuns(await r.json())
    setLoading(false)
  }, [agent.name])

  useEffect(() => { load() }, [load])

  // auto-refresh while any run is active
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === 'running')
    if (!hasRunning) return
    const id = setInterval(() => load(), 5000)
    return () => clearInterval(id)
  }, [runs, load])

  const isRunning = latestRun?.status === 'running'
  const desc      = AGENT_DESC[agent.name] ?? 'AI agent'

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[520px] bg-background border-l border-border overflow-y-auto"
        style={{ boxShadow: '-8px 0 40px rgba(0,0,0,0.7)' }}
      >
        {/* accent line */}
        <div className="h-[2px] w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, ${GOLD}, transparent)` }} />

        <div className="px-8 py-8">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-muted/40 hover:text-foreground text-xl leading-none transition-colors"
          >
            ×
          </button>

          {/* agent identity */}
          <div className="mb-7">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-2xl font-bold text-foreground leading-tight">
                  {agent.displayName}
                </h2>
                <p className="text-sm text-muted/55 mt-0.5">{desc}</p>
              </div>
              {isRunning && (
                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ background: GOLD }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5"
                      style={{ background: GOLD }} />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: GOLD }}>Çalışıyor</span>
                </div>
              )}
            </div>
            <p className="text-[10px] font-mono text-muted/25">{agent.name}</p>
          </div>

          {/* stats row */}
          <div className="grid grid-cols-3 gap-3 mb-7">
            {[
              { label: 'Toplam Çalıştırma', value: runCount >= 20 ? '20+' : runCount > 0 ? String(runCount) : '—' },
              { label: 'Son Durum',         value: latestRun?.status ?? '—' },
              { label: 'Son Çalışma',       value: latestRun ? fmtRelative(latestRun.started_at) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border p-3 flex flex-col gap-1"
                style={{ background: '#0d1117' }}>
                <p className="text-[9px] text-muted/35 uppercase tracking-widest font-medium">{label}</p>
                <p className="text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* runs list */}
          <div>
            <p className="text-[9px] text-muted/35 uppercase tracking-widest font-medium mb-3">
              Son Çalıştırmalar
            </p>

            {loading && (
              <div className="py-10 text-center text-sm text-muted/25">Yükleniyor…</div>
            )}

            {!loading && runs.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-sm text-muted/25">Henüz çalıştırma yok.</p>
                <p className="text-[10px] text-muted/15 mt-1">Runner sekmesinden çalıştırabilirsin.</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── live agents tab ──────────────────────────────────────────────────────────

function LiveAgentsTab() {
  const [agents,     setAgents]     = useState<AgentMeta[]>([])
  const [latestRun,  setLatestRun]  = useState<Record<string, AgentRun>>({})
  const [runCount,   setRunCount]   = useState<Record<string, number>>({})
  const [selected,   setSelected]   = useState<AgentMeta | null>(null)
  const [loadingAll, setLoadingAll] = useState(true)

  const loadAll = useCallback(async () => {
    const res  = await fetch('/api/agents/list')
    const list: AgentMeta[] = await res.json()
    setAgents(list)
    setLoadingAll(false)

    await Promise.all(list.map(async (a) => {
      const r    = await fetch(`/api/agents/runs?agent=${a.name}`)
      const runs: AgentRun[] = await r.json()
      setRunCount((p) => ({ ...p, [a.name]: runs.length }))
      if (runs.length > 0) setLatestRun((p) => ({ ...p, [a.name]: runs[0] }))
    }))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // poll every 5 s if any agent is running
  useEffect(() => {
    const anyRunning = Object.values(latestRun).some((r) => r.status === 'running')
    if (!anyRunning) return
    const id = setInterval(() => loadAll(), 5000)
    return () => clearInterval(id)
  }, [latestRun, loadAll])

  const runningCount = Object.values(latestRun).filter((r) => r.status === 'running').length

  return (
    <>
      <style>{`
        @keyframes cardGlow {
          0%, 100% { box-shadow: 0 0 16px ${GOLD}15, 0 2px 8px rgba(0,0,0,0.5); }
          50%       { box-shadow: 0 0 28px ${GOLD}28, 0 2px 8px rgba(0,0,0,0.5); }
        }
      `}</style>

      {/* live ticker */}
      {runningCount > 0 && (
        <div className="flex items-center gap-2 mb-5 px-4 py-2.5 rounded-xl"
          style={{ background: `${GOLD}0d`, border: `1px solid ${GOLD}22` }}>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: GOLD }} />
            <span className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: GOLD }} />
          </span>
          <p className="text-[11px] font-medium" style={{ color: GOLD }}>
            {runningCount} agent şu an çalışıyor — otomatik yenileniyor
          </p>
        </div>
      )}

      {loadingAll && (
        <div className="py-16 text-center text-sm text-muted/25">Registry'den yükleniyor…</div>
      )}

      {!loadingAll && agents.length === 0 && (
        <div className="py-16 text-center text-sm text-muted/25">Agent bulunamadı.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((a) => (
          <LiveAgentCard
            key={a.name}
            agent={a}
            latestRun={latestRun[a.name]}
            runCount={runCount[a.name] ?? 0}
            isSelected={selected?.name === a.name}
            onClick={() => setSelected(selected?.name === a.name ? null : a)}
          />
        ))}
      </div>

      {selected && (
        <AgentDetailPanel
          agent={selected}
          latestRun={latestRun[selected.name]}
          runCount={runCount[selected.name] ?? 0}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

// ─── office tab (3D — SADECE gerçek registry agent'ları) ─────────────────────
// Eskiden burada 15 hardcoded sahte ajan (Sanchez/Ticaret/Otomasyon/Sosyal
// grupları) vardı — kaldırıldı. Bu sekme artık lib/agents/registry.ts'deki
// gerçek agent'ları ve agent_runs tablosundan gelen canlı durumu gösterir.

function agent3DStatus(latestRun?: AgentRun): Agent3D['status'] {
  if (!latestRun) return 'idle'
  if (latestRun.status === 'running') return 'active'
  if (latestRun.status === 'error') return 'stopped'
  return 'done'
}

function OfficeTab() {
  const [agents,     setAgents]     = useState<AgentMeta[]>([])
  const [latestRun,  setLatestRun]  = useState<Record<string, AgentRun>>({})
  const [runCount,   setRunCount]   = useState<Record<string, number>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingAll, setLoadingAll] = useState(true)

  const loadAll = useCallback(async () => {
    const res  = await fetch('/api/agents/list')
    const list: AgentMeta[] = await res.json()
    setAgents(list)
    setLoadingAll(false)

    await Promise.all(list.map(async (a) => {
      const r    = await fetch(`/api/agents/runs?agent=${a.name}`)
      const runs: AgentRun[] = await r.json()
      setRunCount((p) => ({ ...p, [a.name]: runs.length }))
      if (runs.length > 0) setLatestRun((p) => ({ ...p, [a.name]: runs[0] }))
    }))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    const anyRunning = Object.values(latestRun).some((r) => r.status === 'running')
    if (!anyRunning) return
    const id = setInterval(() => loadAll(), 5000)
    return () => clearInterval(id)
  }, [latestRun, loadAll])

  const agents3D: Agent3D[] = agents.map((a) => ({
    id: a.name,
    name: a.displayName,
    icon: AGENT_ICONS[a.name] ?? '🤖',
    color: GOLD,
    status: agent3DStatus(latestRun[a.name]),
    module: a.moduleTarget ?? '—',
    lastActivity: latestRun[a.name] ? fmtRelative(latestRun[a.name].started_at) : undefined,
    description: AGENT_DESC[a.name] ?? 'AI agent',
  }))

  const selectedAgent = selectedId ? agents.find((a) => a.name === selectedId) ?? null : null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted/40">
        Registry&apos;deki {agents.length} gerçek agent — durumlar agent_runs tablosundan canlı geliyor.
      </p>

      <div
        className="relative w-full rounded-2xl border border-border overflow-hidden select-none"
        style={{ height: '560px', background: '#050505' }}
      >
        {loadingAll ? (
          <div className="h-full flex items-center justify-center text-sm text-muted/25">Registry&apos;den yükleniyor…</div>
        ) : (
          <Office3D agents={agents3D} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted/40">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: GOLD }} /> Çalışıyor</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Tamamlandı</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#7a2a2a' }} /> Hata</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-500" /> Beklemede / hiç çalışmadı</span>
        <span className="text-muted/25">tıkla: detay panel · sürükle: kamera</span>
      </div>

      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          latestRun={latestRun[selectedAgent.name]}
          runCount={runCount[selectedAgent.name] ?? 0}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

// ─── runner tab ──────────────────────────────────────────────────────────────

const MONTHS_TR_R = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const WEEK1_R = new Date('2026-06-29T00:00:00')
const PHASE_TITLES_R: Record<number, string> = {
  1: 'Faz 1: Temel Sağlamlaştırma (A1→A2)', 2: 'Faz 1: Temel Sağlamlaştırma (A1→A2)',
  3: 'Faz 2: Yapı ve Üretim (A2)',           4: 'Faz 2: Yapı ve Üretim (A2)',
  5: 'Faz 3: Akıcılık Geliştirme (A2→B1)',  6: 'Faz 3: Akıcılık Geliştirme (A2→B1)',
  7: 'Faz 4: IELTS Tekniği (B1)',            8: 'Faz 4: IELTS Tekniği (B1)',
  9: 'Faz 5: Tam Bant Pratik (B1→B2)',      10: 'Faz 5: Tam Bant Pratik (B1→B2)',
}

function rWeekDates(wn: number): string {
  const s = new Date(WEEK1_R); s.setDate(s.getDate() + (wn - 1) * 7)
  const e = new Date(s);       e.setDate(e.getDate() + 5)
  return `${s.getDate()} ${MONTHS_TR_R[s.getMonth()]} - ${e.getDate()} ${MONTHS_TR_R[e.getMonth()]}`
}

function rPhaseTitle(wn: number): string { return PHASE_TITLES_R[wn] ?? `Hafta ${wn}` }

function RunnerTab() {
  const [agents,     setAgents]     = useState<AgentMeta[]>([])
  const [latest,     setLatest]     = useState<Record<string, AgentRun>>({})
  const [view,       setView]       = useState<'list' | 'runs' | 'detail'>('list')
  const [selAgent,   setSelAgent]   = useState('')
  const [agentRuns,  setAgentRuns]  = useState<AgentRun[]>([])
  const [selRun,     setSelRun]     = useState<AgentRun | null>(null)
  const [runLogs,    setRunLogs]    = useState<AgentLog[]>([])
  const [running,    setRunning]    = useState(false)
  const [weekNum,    setWeekNum]    = useState(1)
  const [loadRuns,   setLoadRuns]   = useState(false)
  const [loadLogs,   setLoadLogs]   = useState(false)

  const loadAgents = async () => {
    const res  = await fetch('/api/agents/list')
    const list: AgentMeta[] = await res.json()
    setAgents(list)
    await Promise.all(list.map(async (a) => {
      const r = await fetch(`/api/agents/runs?agent=${a.name}`)
      const runs: AgentRun[] = await r.json()
      if (runs.length > 0) setLatest((p) => ({ ...p, [a.name]: runs[0] }))
    }))
  }

  useEffect(() => { loadAgents() }, [])

  const openAgent = async (name: string) => {
    setSelAgent(name); setView('runs'); setLoadRuns(true)
    const r = await fetch(`/api/agents/runs?agent=${name}`)
    setAgentRuns(await r.json())
    setLoadRuns(false)
  }

  const openRun = async (run: AgentRun) => {
    setSelRun(run); setView('detail'); setLoadLogs(true)
    const r = await fetch(`/api/agents/logs?run_id=${run.id}`)
    setRunLogs(await r.json())
    setLoadLogs(false)
  }

  const buildInput = (name: string): Record<string, unknown> => {
    const base = {
      startLevel: 'A1', comprehension: 'strong', production: 'weak',
      biggestFear: 'writing', target: 'IELTS 6.0 (stretch 7.0)',
      examDate: '2026-09-05', hoursPerDay: '4-5', daysPerWeek: 6, restDay: 'Sunday',
    }
    if (name === 'ingilizce-planlayici') return {
      ...base, weekNumber: weekNum, weekDates: rWeekDates(weekNum),
      phaseTitle: rPhaseTitle(weekNum), previousWeekSummary: '',
    }
    if (name === 'ingilizce-genel-plan') return { ...base, startDate: '2026-06-29' }
    return { message: 'ping' }
  }

  const runAgent = async (name: string) => {
    setRunning(true)
    try {
      await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: name, input: buildInput(name) }),
      })
      if (view === 'runs' && selAgent === name) {
        const r = await fetch(`/api/agents/runs?agent=${name}`)
        const runs: AgentRun[] = await r.json()
        setAgentRuns(runs)
        if (runs.length > 0) setLatest((p) => ({ ...p, [name]: runs[0] }))
      } else {
        await loadAgents()
      }
    } finally { setRunning(false) }
  }

  const RUNNER_ACCENT = '#c8a96e'
  const agentMeta = agents.find((a) => a.name === selAgent)

  if (view === 'list') return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted/40">Registry&apos;den yüklendi — {agents.length} agent · canlı çalıştırma &amp; geçmiş.</p>
      {agents.length === 0 && <div className="py-12 text-center text-sm text-muted/30">Yükleniyor…</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((a) => {
          const lat = latest[a.name]
          return (
            <div key={a.name}
              className="bg-surface border border-border rounded-2xl p-4 hover:border-border/60 transition-colors cursor-pointer flex flex-col gap-2"
              style={{ borderTopColor: RUNNER_ACCENT, borderTopWidth: '2px' }}
              onClick={() => openAgent(a.name)}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground leading-snug">{a.displayName}</p>
                {lat ? <RunBadge status={lat.status} /> : (
                  <span className="text-[9px] text-muted/30 mt-1">Hiç çalışmadı</span>
                )}
              </div>
              <p className="text-[10px] text-muted/40 font-mono">{a.name}</p>
              {lat && <p className="text-[10px] text-muted/30">{fmtTs(lat.started_at)}</p>}
              <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                {a.name === 'ingilizce-planlayici' && (
                  <input type="number" min={1} max={10} value={weekNum}
                    onChange={(e) => setWeekNum(Number(e.target.value))}
                    className="w-14 bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground text-center focus:outline-none focus:border-gold/40"
                    title="Hafta numarası" />
                )}
                <button
                  onClick={() => runAgent(a.name)} disabled={running}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: RUNNER_ACCENT }}
                >
                  {running ? '⏳ Çalışıyor…' : 'Çalıştır'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  if (view === 'runs') return (
    <div>
      <button onClick={() => setView('list')}
        className="text-xs text-muted hover:text-foreground mb-4 transition-colors block">
        ← Geri
      </button>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{agentMeta?.displayName ?? selAgent}</p>
          <p className="text-[10px] text-muted/40 font-mono mt-0.5">{selAgent}</p>
        </div>
        <div className="flex items-center gap-2">
          {selAgent === 'ingilizce-planlayici' && (
            <input type="number" min={1} max={10} value={weekNum}
              onChange={(e) => setWeekNum(Number(e.target.value))}
              className="w-14 bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground text-center focus:outline-none focus:border-gold/40"
              title="Hafta numarası" />
          )}
          <button onClick={() => runAgent(selAgent)} disabled={running}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: RUNNER_ACCENT }}>
            {running ? '⏳ Çalışıyor…' : 'Çalıştır'}
          </button>
        </div>
      </div>
      {loadRuns && <div className="py-8 text-center text-sm text-muted/30">Yükleniyor…</div>}
      {!loadRuns && agentRuns.length === 0 && (
        <div className="py-12 text-center text-sm text-muted/30">Henüz çalıştırma yok.</div>
      )}
      <div className="flex flex-col gap-2">
        {agentRuns.map((run) => (
          <div key={run.id}
            className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl hover:border-border/60 transition-colors cursor-pointer"
            onClick={() => openRun(run)}
          >
            <RunBadge status={run.status} />
            <span className="text-[10px] text-muted/50 font-mono flex-1 truncate">{run.id}</span>
            <span className="text-[10px] text-muted/30 shrink-0">{fmtTs(run.started_at)}</span>
            <span className="text-[9px] shrink-0" style={{ color: RUNNER_ACCENT + '99' }}>Detay →</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <button onClick={() => setView('runs')}
        className="text-xs text-muted hover:text-foreground mb-4 transition-colors block">
        ← Çalıştırmalara dön
      </button>
      {selRun && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <RunBadge status={selRun.status} />
            <span className="text-[10px] text-muted/40 font-mono">{selRun.id}</span>
            <span className="text-[10px] text-muted/30">{fmtTs(selRun.started_at)}</span>
          </div>
          {selRun.error && (
            <div className="p-3 rounded-xl text-xs text-red-400"
              style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
              {selRun.error}
            </div>
          )}
          <div>
            <p className="text-[10px] text-muted/40 uppercase tracking-widest font-medium mb-2">Input</p>
            <pre className="bg-surface border border-border rounded-xl p-3 text-[10px] text-foreground/60 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(selRun.input, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-[10px] text-muted/40 uppercase tracking-widest font-medium mb-2">Output</p>
            <pre className="bg-surface border border-border rounded-xl p-3 text-[10px] text-foreground/60 overflow-x-auto whitespace-pre-wrap"
              style={{ maxHeight: 260 }}>
              {selRun.output ? JSON.stringify(selRun.output, null, 2) : '—'}
            </pre>
          </div>
          {loadLogs && <p className="text-xs text-muted/30">Tool logları yükleniyor…</p>}
          {!loadLogs && runLogs.length > 0 && (
            <div>
              <p className="text-[10px] text-muted/40 uppercase tracking-widest font-medium mb-2">Tool Logları</p>
              <div className="flex flex-col gap-1.5">
                {runLogs.map((log) => (
                  <div key={log.id} className="px-3 py-2 bg-surface border border-border rounded-lg">
                    <p className="text-[9px] font-semibold mb-0.5" style={{ color: RUNNER_ACCENT + 'bb' }}>{log.action}</p>
                    <p className="text-[10px] text-foreground/40 truncate">{log.result}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!loadLogs && runLogs.length === 0 && (
            <p className="text-[10px] text-muted/30">Tool log yok (direkt JSON ajanı).</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AgentPanelPage() {
  const [tab, setTab] = useState<'agentler' | 'office' | 'runner'>('agentler')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* header */}
          <div className="mb-7">
            <h1 className="font-display text-2xl font-bold text-foreground">Agent Panel</h1>
            <p className="text-sm text-muted/50 mt-1">
              Canlı agent registry — gerçek zamanlı durum ve çalıştırma geçmişi
            </p>
          </div>

          {/* tab bar */}
          <div className="flex gap-1 mb-7">
            {([
              ['agentler', 'Agentler'],
              ['office',   'Office'],
              ['runner',   'Runner'],
            ] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="text-xs px-4 py-2 rounded-xl font-semibold transition-all duration-150"
                style={tab === t
                  ? { background: GOLD, color: '#0a0c10' }
                  : { color: 'rgba(148,163,184,0.6)', border: '1px solid rgba(255,255,255,0.06)' }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {/* content */}
          {tab === 'agentler' && <LiveAgentsTab />}
          {tab === 'office'   && <OfficeTab />}
          {tab === 'runner'   && <RunnerTab />}

        </div>
      </div>
    </div>
  )
}
