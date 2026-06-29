'use client'

import { useState, useEffect, useCallback } from 'react'

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

// ─── types ────────────────────────────────────────────────────────────────────

type Status = 'active' | 'idle' | 'done'

interface Agent {
  id: string; name: string; role: string; status: Status
  lastTask: string; current: string; tasks: string[]
}
interface Group { id: string; label: string; color: string; agents: Agent[] }

interface AgentMeta { name: string; displayName: string; moduleTarget: string | null }
interface AgentRun {
  id: string; agent_name: string; status: string
  input: unknown; output: unknown
  module_target: string | null; error: string | null
  started_at: string; finished_at: string | null
}
interface AgentLog { id: string; action: string; result: string; created_at: string }

// ─── mock data (Office tab only) ─────────────────────────────────────────────

const GROUPS: Group[] = [
  {
    id: 'sanchez', label: 'Sanchez Grubu', color: '#c8a96e',
    agents: [
      { id: 'sanchez', name: 'Sanchez', role: 'Orkestra Şefi', status: 'active',
        lastTask: 'Tüm gruplara günlük briefing gönderildi.',
        current: 'Ticaret ve Otomasyon gruplarını koordine ediyor.',
        tasks: ['Günlük briefing', 'Haftalık strateji', 'Grup koordinasyonu'] },
      { id: 'kesif', name: 'Keşif Agenti', role: 'Araştırma & Analiz', status: 'idle',
        lastTask: 'Rakip platform analiz raporu tamamlandı (28 sayfa).',
        current: 'Standby — yeni görev bekleniyor.',
        tasks: ['Rakip analiz', 'Pazar araştırması', 'Trend takibi'] },
      { id: 'hafiza', name: 'Hafıza Agenti', role: 'Veri & Hafıza', status: 'active',
        lastTask: 'Geçen haftanın 1.240 sipariş kaydı veritabanına işlendi.',
        current: 'Müşteri profilleri güncelleniyor, geçmiş senkronize ediliyor.',
        tasks: ['Sipariş kaydı', 'Müşteri profili', 'Veri senkronizasyonu'] },
    ],
  },
  {
    id: 'ticaret', label: 'Ticaret Grubu', color: '#3b82f6',
    agents: [
      { id: 'fiyat', name: 'Ticaret Agent 1', role: 'Fiyat Takibi', status: 'active',
        lastTask: 'Trendyol & Hepsiburada için 80 ürün fiyat raporu üretildi.',
        current: '12 ürünün anlık fiyat değişimini izliyor.',
        tasks: ['Fiyat tarama', 'Uyarı gönderme', 'Rapor üretimi'] },
      { id: 'rakip', name: 'Ticaret Agent 2', role: 'Rakip Analizi', status: 'done',
        lastTask: 'Üst 5 rakibin ürün portföyü ve fiyat stratejisi analiz edildi.',
        current: 'Tamamlandı — sonuçlar hafıza agentine aktarıldı.',
        tasks: ['Rakip portföy', 'Fiyat stratejisi', 'Zayıflık analizi'] },
      { id: 'stok', name: 'Ticaret Agent 3', role: 'Stok Yönetimi', status: 'active',
        lastTask: '3 ürün için kritik stok uyarısı gönderildi.',
        current: "Depodaki 47 SKU'nun stok durumunu anlık izliyor.",
        tasks: ['Stok izleme', 'Kritik uyarı', 'Tedarik tahmini'] },
      { id: 'siparis', name: 'Ticaret Agent 4', role: 'Sipariş Takibi', status: 'idle',
        lastTask: 'Bugün 23 siparişin kargo durumu güncellendi.',
        current: 'Standby — yeni sipariş bekleniyor.',
        tasks: ['Kargo takip', 'Müşteri bildirim', 'İade yönetimi'] },
    ],
  },
  {
    id: 'otomasyon', label: 'Otomasyon Grubu', color: '#22c55e',
    agents: [
      { id: 'whatsapp', name: 'Otomasyon Agent 1', role: 'WhatsApp Bot', status: 'active',
        lastTask: '18 müşteri sorusuna otomatik yanıt gönderildi.',
        current: 'WhatsApp kanalını izliyor — kuyrukta 3 mesaj bekliyor.',
        tasks: ['Otomatik yanıt', 'Şikayet yönlendirme', 'Kampanya mesajı'] },
      { id: 'randevu', name: 'Otomasyon Agent 2', role: 'Randevu Sistemi', status: 'idle',
        lastTask: 'Yarın için 4 teslimat randevusu onaylandı.',
        current: 'Standby.',
        tasks: ['Randevu oluştur', 'Hatırlatma gönder', 'Takvim senkronizasyonu'] },
      { id: 'urun', name: 'Otomasyon Agent 3', role: 'Ürün Listeleme', status: 'active',
        lastTask: "7 yeni ürün Trendyol'a otomatik olarak listelendi.",
        current: '15 ürün için SEO optimizasyonu yapıyor.',
        tasks: ['Oto listeleme', 'Başlık optimizasyonu', 'Görsel düzenleme'] },
      { id: 'rapor', name: 'Otomasyon Agent 4', role: 'Raporlama', status: 'done',
        lastTask: 'Haftalık satış raporu PDF olarak hazırlandı ve gönderildi.',
        current: 'Tamamlandı.',
        tasks: ['Günlük rapor', 'Haftalık özet', 'KPI takibi'] },
    ],
  },
  {
    id: 'sosyal', label: 'Sosyal Medya Grubu', color: '#a855f7',
    agents: [
      { id: 'icerik', name: 'Sosyal Agent 1', role: 'İçerik Üretimi', status: 'active',
        lastTask: 'Instagram için 5 ürün görseli ve caption taslağı hazırlandı.',
        current: 'Yarın için 3 post içeriği üretiyor.',
        tasks: ['Post taslağı', 'Caption yazımı', 'Hashtag analizi'] },
      { id: 'trend', name: 'Sosyal Agent 2', role: 'Trend Analizi', status: 'idle',
        lastTask: 'Bu haftanın viral ürün ve içerik trendleri belirlendi.',
        current: 'Standby.',
        tasks: ['Trend tarama', 'Viral içerik', 'Rakip takip'] },
      { id: 'zamanlama', name: 'Sosyal Agent 3', role: 'Zamanlama', status: 'active',
        lastTask: 'Bugünkü 2 post zamanında yayınlandı.',
        current: 'Yarının içerik takvimini optimize ediyor.',
        tasks: ['Post zamanlama', 'En iyi saat analizi', 'Takvim yönetimi'] },
      { id: 'analitik', name: 'Sosyal Agent 4', role: 'Analitik', status: 'done',
        lastTask: 'Geçen haftanın Instagram reach ve engagement raporu çıkarıldı.',
        current: 'Tamamlandı.',
        tasks: ['Engagement analizi', 'Reach raporu', 'Büyüme takibi'] },
    ],
  },
]

const ALL_AGENTS = GROUPS.flatMap((g) => g.agents.map((a) => ({ ...a, groupColor: g.color })))

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

// ─── among us avatar (office tab) ────────────────────────────────────────────

function Avatar({ color, size = 44 }: { color: string; size?: number }) {
  const h = Math.round(size * 1.3)
  const dark = color + 'bb'
  return (
    <svg width={size} height={h} viewBox="0 0 44 57" fill="none">
      <ellipse cx="22" cy="17" rx="15" ry="15" fill={color} />
      <rect x="11" y="8" width="20" height="14" rx="7" fill="#c8e8f8" opacity="0.88" />
      <rect x="13" y="10" width="7" height="6" rx="3" fill="white" opacity="0.65" />
      <rect x="8" y="27" width="28" height="20" rx="12" fill={color} />
      <rect x="34" y="24" width="8" height="14" rx="4" fill={dark} />
      <rect x="9" y="43" width="10" height="13" rx="5" fill={color} />
      <rect x="25" y="43" width="10" height="13" rx="5" fill={color} />
    </svg>
  )
}

// ─── office badge (mock status) ──────────────────────────────────────────────

function OfficeBadge({ status }: { status: Status }) {
  const c = {
    active: { label: 'Çalışıyor',  dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    idle:   { label: 'Beklemede',  dot: 'bg-amber-400/70',              text: 'text-amber-400/90', bg: 'bg-amber-400/10' },
    done:   { label: 'Tamamlandı', dot: 'bg-blue-400/70',               text: 'text-blue-400/80',  bg: 'bg-blue-400/10' },
  }[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-semibold tracking-wide ${c.text} ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  )
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

// ─── office modals ───────────────────────────────────────────────────────────

function AgentModal({ agent, color, onClose, onDetail }: {
  agent: Agent; color: string; onClose: () => void; onDetail: () => void
}) {
  const [task, setTask] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-background border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
        style={{ borderTopColor: color, borderTopWidth: '2px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-foreground text-xl leading-none">×</button>
        <div className="flex items-center gap-4 mb-5">
          <Avatar color={color} size={52} />
          <div>
            <p className="text-base font-semibold text-foreground">{agent.name}</p>
            <p className="text-xs text-muted mb-1.5">{agent.role}</p>
            <OfficeBadge status={agent.status} />
          </div>
        </div>
        <div className="mb-3">
          <p className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-1.5">Son Görev</p>
          <div className="text-sm text-foreground/80 bg-surface rounded-xl px-3 py-2.5 border border-border leading-relaxed">
            {agent.lastTask}
          </div>
        </div>
        <div className="mb-4">
          <p className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-1.5">Şu An Ne Yapıyor</p>
          <div className="text-sm text-foreground/80 bg-surface rounded-xl px-3 py-2.5 border border-border leading-relaxed">
            {agent.current}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-1.5">Görev Ver</p>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Görevi açıkla..."
            rows={2}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted/40 resize-none focus:outline-none focus:border-gold/40 transition-colors"
          />
          <div className="flex gap-2 mt-2">
            <button
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-background transition-opacity hover:opacity-80"
              style={{ background: color }}
            >Gönder</button>
            <button
              onClick={onDetail}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-muted hover:text-foreground transition-colors"
            >Detay</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailModal({ agent, color, onClose }: {
  agent: Agent; color: string; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative ml-auto h-full bg-background border-l border-border w-full max-w-lg overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <div className="p-8">
          <button onClick={onClose} className="absolute top-6 right-6 text-muted hover:text-foreground text-xl leading-none">×</button>
          <div className="flex items-center gap-5 mb-8">
            <Avatar color={color} size={72} />
            <div>
              <p className="font-display text-xl font-semibold text-foreground">{agent.name}</p>
              <p className="text-sm text-muted mt-0.5">{agent.role}</p>
              <div className="mt-2"><OfficeBadge status={agent.status} /></div>
            </div>
          </div>
          <section className="mb-6">
            <h3 className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-3">Şu An</h3>
            <div className="bg-surface border rounded-xl p-4" style={{ borderColor: `${color}30` }}>
              <p className="text-sm text-foreground/85 leading-relaxed">{agent.current}</p>
            </div>
          </section>
          <section className="mb-6">
            <h3 className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-3">Geçmiş Görevler</h3>
            <div className="flex flex-col gap-2">
              {[agent.lastTask, ...agent.tasks.map((t) => `${t} — tamamlandı.`)].map((t, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 px-3 bg-surface border border-border rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: i === 0 ? color : '#334155' }} />
                  <p className="text-sm text-foreground/75 leading-snug">{t}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="mb-8">
            <h3 className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-3">Yetenekler</h3>
            <div className="flex flex-wrap gap-2">
              {agent.tasks.map((t) => (
                <span key={t} className="text-xs px-3 py-1.5 rounded-full border font-medium"
                  style={{ borderColor: `${color}50`, color, background: `${color}12` }}>
                  {t}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
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

// ─── office tab ───────────────────────────────────────────────────────────────

const AGENT_POSITIONS: Record<string, { left: string; top: string }> = {
  sanchez:   { left: '50%',  top: '290px' },
  kesif:     { left: '56%',  top: '316px' },
  hafiza:    { left: '44%',  top: '316px' },
  fiyat:     { left: '13%',  top: '50px'  },
  rakip:     { left: '13%',  top: '130px' },
  stok:      { left: '13%',  top: '210px' },
  siparis:   { left: '13%',  top: '290px' },
  whatsapp:  { left: '87%',  top: '50px'  },
  randevu:   { left: '87%',  top: '130px' },
  urun:      { left: '87%',  top: '210px' },
  rapor:     { left: '87%',  top: '290px' },
  icerik:    { left: '14%',  top: '503px' },
  trend:     { left: '38%',  top: '503px' },
  zamanlama: { left: '62%',  top: '503px' },
  analitik:  { left: '86%',  top: '503px' },
}

const HAFIZA_ALT = { left: '50%', top: '44px'  }
const KESIF_ALT  = { left: '56%', top: '192px' }

const BOB_DELAYS: Record<string, string> = {
  sanchez: '0s', kesif: '0.3s', hafiza: '0.6s',
  fiyat: '0.2s', rakip: '0.8s', stok: '1.1s', siparis: '1.5s',
  whatsapp: '0.4s', randevu: '0.9s', urun: '1.3s', rapor: '0.1s',
  icerik: '0.7s', trend: '1.2s', zamanlama: '0.5s', analitik: '1.0s',
}

const BUBBLES = [
  { agentId: 'sanchez',  text: 'Tüm sistemler nominal.',       left: '34%', top: '228px' },
  { agentId: 'hafiza',   text: 'Veri senkronize ediliyor…',   left: '23%', top: '262px' },
  { agentId: 'kesif',    text: 'Trend analizi tamam!',          left: '48%', top: '255px' },
  { agentId: 'fiyat',    text: '12 ürün izleniyor.',            left: '1%',  top: '92px'  },
  { agentId: 'whatsapp', text: 'Kuyrukta 3 mesaj.',             left: '64%', top: '92px'  },
  { agentId: 'icerik',   text: '3 post hazırlandı.',            left: '3%',  top: '443px' },
]

const AREA_INFO: Record<string, { label: string; desc: string; color: string }> = {
  kutuphane: {
    label: 'Kütüphane / Veri Deposu',
    desc: 'Tüm agent hafızaları burada saklanır. Geçmiş görevler, öğrenilen kalıplar ve veri arşivleri bu alanda tutulur.',
    color: '#64748b',
  },
  sanchez: {
    label: 'Sanchez Hub',
    desc: 'Merkez komuta noktası. Sanchez tüm grupları buradan koordine eder, görev dağıtır ve raporları toplar.',
    color: '#c8a96e',
  },
  ticaret: {
    label: 'Ticaret Grubu',
    desc: 'Fiyat takibi, rakip analizi, stok yönetimi ve sipariş takip operasyonlarının yürütüldüğü alan.',
    color: '#3b82f6',
  },
  otomasyon: {
    label: 'Otomasyon Grubu',
    desc: 'WhatsApp botu, randevu sistemi, ürün listeleme ve raporlama otomasyonlarının çalıştığı merkez.',
    color: '#22c55e',
  },
  sosyal: {
    label: 'Sosyal Medya Grubu',
    desc: 'İçerik üretimi, trend analizi, zamanlama ve analitik operasyonlarının yürütüldüğü alan.',
    color: '#a855f7',
  },
}

const AGENT_IDS = [
  'sanchez','kesif','hafiza',
  'fiyat','rakip','stok','siparis',
  'whatsapp','randevu','urun','rapor',
  'icerik','trend','zamanlama','analitik',
]

function OfficeTab({ onModal, onDetail }: {
  onModal: (a: Agent, color: string) => void
  onDetail: (a: Agent, color: string) => void
}) {
  const [bubbleIdx, setBubbleIdx] = useState(0)
  const [bubbleOn,  setBubbleOn]  = useState(true)
  const [hafizaAlt, setHafizaAlt] = useState(false)
  const [kesifAlt,  setKesifAlt]  = useState(false)
  const [areaModal, setAreaModal] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setBubbleOn(false)
      setTimeout(() => { setBubbleIdx((i) => (i + 1) % BUBBLES.length); setBubbleOn(true) }, 400)
    }, 4500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setHafizaAlt(true)
      setTimeout(() => setHafizaAlt(false), 3000)
    }, 9000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setKesifAlt(true)
      setTimeout(() => setKesifAlt(false), 2500)
    }, 12000)
    return () => clearInterval(id)
  }, [])

  function getPos(id: string) {
    if (id === 'hafiza' && hafizaAlt) return HAFIZA_ALT
    if (id === 'kesif'  && kesifAlt)  return KESIF_ALT
    return AGENT_POSITIONS[id] ?? { left: '50%', top: '300px' }
  }

  const bubble = BUBBLES[bubbleIdx]

  return (
    <>
      <style>{`
        @keyframes agentBob {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-3px); }
        }
      `}</style>

      <div
        className="relative w-full rounded-2xl border border-border overflow-hidden select-none"
        style={{ height: '560px', background: '#07090b' }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.035,
            backgroundImage: 'linear-gradient(#c8a96e 1px,transparent 1px),linear-gradient(90deg,#c8a96e 1px,transparent 1px)',
            backgroundSize: '36px 36px' }} />

        {/* Kütüphane */}
        <div
          className="absolute z-10 cursor-pointer hover:brightness-125 transition-all"
          style={{ top: 0, left: '29%', right: '29%', height: '88px',
            background: 'rgba(18,22,28,0.9)',
            borderBottom: '1px solid #1e2a3a', borderLeft: '1px solid #1e2a3a', borderRight: '1px solid #1e2a3a',
            borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}
          onClick={(e) => { e.stopPropagation(); setAreaModal('kutuphane') }}
        >
          <div className="flex flex-col items-center justify-center h-full gap-1.5 pointer-events-none">
            <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(100,116,139,0.8)' }}>
              🗂 Kütüphane / Veri Deposu
            </span>
            <div className="flex items-end gap-[3px]">
              {[22,28,20,32,18,26,24].map((h, i) => (
                <div key={i} className="rounded-sm" style={{ width: 5, height: h, background: `rgba(100,116,139,${0.28 + i * 0.04})` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Ticaret */}
        <div
          className="absolute z-10 cursor-pointer hover:brightness-110 transition-all"
          style={{ top: 0, left: 0, width: '27%', bottom: '108px',
            background: 'rgba(10,16,26,0.78)', borderRight: '1px solid rgba(59,130,246,0.18)' }}
          onClick={(e) => { e.stopPropagation(); setAreaModal('ticaret') }}
        >
          <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: '#3b82f6' }}>Ticaret</span>
          </div>
          {['Borsa','Müzakere','Depo','Sipariş'].map((lbl, i) => (
            <div key={lbl} className="absolute left-1.5 right-1.5 h-[62px] rounded-lg border pointer-events-none"
              style={{ top: 18 + i * 80, borderColor: 'rgba(59,130,246,0.12)', background: 'rgba(59,130,246,0.04)' }}>
              <span className="absolute bottom-1 right-1.5 text-[8px] font-medium" style={{ color: 'rgba(59,130,246,0.45)' }}>{lbl}</span>
            </div>
          ))}
        </div>

        {/* Otomasyon */}
        <div
          className="absolute z-10 cursor-pointer hover:brightness-110 transition-all"
          style={{ top: 0, right: 0, width: '27%', bottom: '108px',
            background: 'rgba(10,20,14,0.78)', borderLeft: '1px solid rgba(34,197,94,0.18)' }}
          onClick={(e) => { e.stopPropagation(); setAreaModal('otomasyon') }}
        >
          <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: '#22c55e' }}>Otomasyon</span>
          </div>
          {['Sunucu','Telefon','Kontrol','Rapor'].map((lbl, i) => (
            <div key={lbl} className="absolute left-1.5 right-1.5 h-[62px] rounded-lg border pointer-events-none"
              style={{ top: 18 + i * 80, borderColor: 'rgba(34,197,94,0.12)', background: 'rgba(34,197,94,0.04)' }}>
              <span className="absolute bottom-1 left-1.5 text-[8px] font-medium" style={{ color: 'rgba(34,197,94,0.45)' }}>{lbl}</span>
            </div>
          ))}
        </div>

        {/* Sanchez center */}
        <div
          className="absolute z-10 cursor-pointer"
          style={{ top: 88, left: '27%', right: '27%', bottom: '108px' }}
          onClick={(e) => { e.stopPropagation(); setAreaModal('sanchez') }}
        >
          <div className="absolute pointer-events-none"
            style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
              width: 220, height: 220, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(200,169,110,0.08) 0%, transparent 65%)' }} />
          <div className="absolute pointer-events-none"
            style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
              width: 96, height: 96, borderRadius: '50%',
              border: '1px solid rgba(200,169,110,0.30)',
              background: 'radial-gradient(circle, rgba(200,169,110,0.11) 0%, rgba(200,169,110,0.03) 100%)' }}>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold tracking-widest uppercase"
              style={{ color: 'rgba(200,169,110,0.35)' }}>Hub</span>
          </div>
        </div>

        {/* Sosyal Medya */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 cursor-pointer hover:brightness-110 transition-all"
          style={{ height: '108px', background: 'rgba(16,10,24,0.90)', borderTop: '1px solid rgba(168,85,247,0.22)' }}
          onClick={(e) => { e.stopPropagation(); setAreaModal('sosyal') }}
        >
          <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
            <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: '#a855f7' }}>Sosyal Medya</span>
          </div>
          {['İçerik','Trend','Zamanlama','Analitik'].map((lbl, i) => (
            <div key={lbl} className="absolute top-6 bottom-2 rounded-lg border pointer-events-none"
              style={{ left: `${3 + i * 24}%`, width: '22%',
                borderColor: 'rgba(168,85,247,0.12)', background: 'rgba(168,85,247,0.04)' }}>
              <span className="absolute bottom-1 left-0 right-0 text-center text-[8px] font-medium"
                style={{ color: 'rgba(168,85,247,0.45)' }}>{lbl}</span>
            </div>
          ))}
        </div>

        {/* Agents */}
        {AGENT_IDS.map((id) => {
          const agent = ALL_AGENTS.find((a) => a.id === id)
          if (!agent) return null
          const group = GROUPS.find((g) => g.agents.some((a) => a.id === id))
          const gc    = group?.color ?? '#c8a96e'
          const pos   = getPos(id)
          return (
            <div
              key={id}
              className="absolute z-20"
              style={{ left: pos.left, top: pos.top,
                transform: 'translate(-50%,-50%)',
                transition: 'left 1.5s ease-in-out, top 1.5s ease-in-out' }}
            >
              <button
                className="relative hover:scale-110 transition-transform cursor-pointer"
                style={{ animation: `agentBob 2.2s ease-in-out ${BOB_DELAYS[id] ?? '0s'} infinite` }}
                onClick={() => onModal(agent, gc)}
                onDoubleClick={(e) => { e.preventDefault(); onDetail(agent, gc) }}
                title={`${agent.name} — ${agent.role} (2× detay)`}
              >
                <Avatar color={gc} size={28} />
                {agent.status === 'active' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-background animate-pulse" />
                )}
              </button>
            </div>
          )
        })}

        {/* Speech bubble */}
        <div
          className="absolute z-30 pointer-events-none"
          style={{ left: bubble.left, top: bubble.top, opacity: bubbleOn ? 1 : 0, transition: 'opacity 0.4s ease' }}
        >
          <div className="relative px-2.5 py-1.5 rounded-xl text-[10px] font-medium max-w-[140px] leading-snug"
            style={{ background: 'rgba(10,16,26,0.95)', border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 2px 14px rgba(0,0,0,0.55)', color: 'rgba(240,244,248,0.90)' }}>
            {bubble.text}
            <div className="absolute left-3 w-0 h-0" style={{ bottom: -5,
              borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
              borderTop: '5px solid rgba(10,16,26,0.95)' }} />
          </div>
        </div>

        {/* Area modal */}
        {areaModal && (() => {
          const info = AREA_INFO[areaModal]
          if (!info) return null
          return (
            <div className="absolute z-50 inset-0 flex items-center justify-center"
              onClick={() => setAreaModal(null)}>
              <div className="absolute inset-0 bg-black/50" />
              <div className="relative bg-background border border-border rounded-2xl p-5 w-[260px] shadow-2xl"
                style={{ borderTopColor: info.color, borderTopWidth: '2px' }}
                onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setAreaModal(null)}
                  className="absolute top-3 right-3 text-muted hover:text-foreground text-lg leading-none">×</button>
                <p className="text-sm font-semibold text-foreground mb-2 pr-5">{info.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.75)' }}>{info.desc}</p>
              </div>
            </div>
          )
        })()}

        <div className="absolute bottom-2 right-2 z-20 pointer-events-none">
          <span className="text-[9px]" style={{ color: 'rgba(100,116,139,0.3)' }}>
            tıkla: modal · 2× detay · alan tıkla: bilgi
          </span>
        </div>
      </div>
    </>
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
      <p className="text-xs text-muted/40">Registry'den yüklendi — {agents.length} agent · canlı çalıştırma &amp; geçmiş.</p>
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

type ModalState = { agent: Agent; color: string } | null

export default function AgentPanelPage() {
  const [tab,    setTab]    = useState<'agentler' | 'runner'>('agentler')
  const [modal,  setModal]  = useState<ModalState>(null)
  const [detail, setDetail] = useState<ModalState>(null)

  const openModal  = (a: Agent, c: string) => { setDetail(null); setModal({ agent: a, color: c }) }
  const openDetail = (a: Agent, c: string) => { setModal(null);  setDetail({ agent: a, color: c }) }

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
          {tab === 'runner'   && <RunnerTab />}

        </div>
      </div>

      {/* office modals */}
      {modal && (
        <AgentModal
          agent={modal.agent}
          color={modal.color}
          onClose={() => setModal(null)}
          onDetail={() => { setModal(null); openDetail(modal.agent, modal.color) }}
        />
      )}
      {detail && (
        <DetailModal
          agent={detail.agent}
          color={detail.color}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
