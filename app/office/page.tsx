'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { Agent3D } from '@/components/office/Office3D'

const Office3D = dynamic(() => import('@/components/office/Office3D'), { ssr: false })

// ─── types ────────────────────────────────────────────────────────────────────

type AgentStatus = 'active' | 'idle' | 'stopped'

interface AgentDef {
  id: string
  name: string
  icon: string
  description: string
  module: string
  color: string
  status: AgentStatus
  lastRun?: string
}

interface FeedEntry {
  id: string
  agentId: string
  agentName: string
  agentColor: string
  message: string
  ts: string
}

// ─── data ─────────────────────────────────────────────────────────────────────

const INITIAL_AGENTS: AgentDef[] = [
  {
    id: 'scholarship',
    name: 'Burs Agenti',
    icon: '🎓',
    description: 'Burs fırsatlarını takip eder, başvuru takvimini yönetir, essay taslakları üretir.',
    module: 'Burs & Üniversite',
    color: '#c8a96e',
    status: 'idle',
  },
  {
    id: 'ielts',
    name: 'IELTS Agenti',
    icon: '📚',
    description: 'Günlük kelime, writing görevi ve mock test analizi yapar.',
    module: 'İngilizce / IELTS',
    color: '#6eb5c8',
    status: 'idle',
  },
  {
    id: 'routine',
    name: 'Rutin Agenti',
    icon: '🔁',
    description: 'Alışkanlık ve günlük modüllerini izler, streak hesaplar, hatırlatma üretir.',
    module: 'Alışkanlık · Günlük',
    color: '#c8956e',
    status: 'idle',
  },
  {
    id: 'finance',
    name: 'Ticaret Agenti',
    icon: '💹',
    description: 'Gelir-gider dengesi, bütçe uyarıları ve harcama analizleri.',
    module: 'Finans',
    color: '#6ec8a9',
    status: 'idle',
  },
  {
    id: 'discover',
    name: 'Keşif Agenti',
    icon: '🔭',
    description: 'Kitap, kurs ve kaynak önerileri. Keşif modülüne otomatik ekler.',
    module: 'Keşif',
    color: '#c86e6e',
    status: 'idle',
  },
  {
    id: 'secretary',
    name: 'Sekreter Agenti',
    icon: '📋',
    description: 'Takvim, hatırlatmalar, son tarihler. Modüller arası koordinasyon.',
    module: 'Finans · Burs',
    color: '#956ec8',
    status: 'idle',
  },
  {
    id: 'content',
    name: 'İçerik Agenti',
    icon: '📱',
    description: 'Sosyal medya içeriği üretir. Reborn yolculuğunu paylaşılabilir formata çevirir.',
    module: 'Sosyal Medya',
    color: '#c86e9a',
    status: 'idle',
  },
]

const MOCK_MESSAGES: Record<string, string[]> = {
  scholarship: [
    'Berea College son başvuru tarihi: 15 Ocak 2027. Takvime eklendi.',
    'Essay taslağı hazır: "Why do you want to study CS?" — 650 kelime.',
    'Davidson College kabul oranı güncellendi: %18.',
    'Yeni burs fırsatı: QuestBridge — deadline 27 Eylül.',
  ],
  ielts: [
    '"Perseverance" kelimesi öğrenildi olarak işaretlendi.',
    'Bugünkü writing görevi: "Technology in education" — Task 2.',
    'Mock test analizi: Writing bandı 6.5 → hedef 7.0. Gap: 0.5.',
    '5 yeni kelime eklendi: resilience, ambition, opportunity, achievement, determination.',
  ],
  routine: [
    '🔥 Streak: 7 gün. Yarın da devam et.',
    '"Sabah egzersizi" alışkanlığı bugün tamamlanmadı. Hatırlatma gönderildi.',
    'Günlük özet: 3/5 görev tamamlandı.',
    'Haftalık rutin raporu hazırlandı.',
  ],
  finance: [
    'Bu ay harcama limiti %80 doldu. Uyarı: ₺400 kaldı.',
    'Kurs ücreti kaydedildi: ₺299 — Udemy IELTS.',
    'Aylık bütçe özeti hazır.',
    "Yeni alacak: Ahmet'ten ₺150, tarih: 1 Mayıs.",
  ],
  discover: [
    '"Atomic Habits" tamamlandı olarak işaretlendi.',
    'Yeni öneri: "Deep Work" — Cal Newport.',
    'Coursera kursu eklendi: CS50x — Harvard.',
    'Bu hafta keşif: 2 kitap, 1 kurs.',
  ],
  secretary: [
    'Önümüzdeki 7 gün: 3 deadline, 2 randevu.',
    'IELTS sınavına 154 gün kaldı.',
    'Burs başvurusuna 186 gün kaldı.',
    "Günlük özet Sanchez'e iletildi.",
  ],
  content: [
    'LinkedIn gönderisi taslağı: "Reborn ile 30 gün" — hazır.',
    'Instagram hikayesi içeriği üretildi.',
    'Bu haftanın öne çıkan gelişmesi: 7 gün streak.',
    'İçerik takvimi güncellendi.',
  ],
}

function rid() { return Math.random().toString(36).slice(2, 8) }
function nowStr() {
  return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ─── component ────────────────────────────────────────────────────────────────

export default function OfficePage() {
  const [tab, setTab] = useState<'agentler' | 'office'>('agentler')
  const [agents, setAgents] = useState<AgentDef[]>(INITIAL_AGENTS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [feed, setFeed] = useState<FeedEntry[]>([
    {
      id: rid(), agentId: 'secretary', agentName: 'Sekreter Agenti', agentColor: '#956ec8',
      message: 'Agent Ofisi açıldı. Tüm sistemler hazır.', ts: nowStr(),
    },
    {
      id: rid(), agentId: 'ielts', agentName: 'IELTS Agenti', agentColor: '#6eb5c8',
      message: 'IELTS sınavına 154 gün kaldı. Bugün writing çalış.', ts: nowStr(),
    },
    {
      id: rid(), agentId: 'scholarship', agentName: 'Burs Agenti', agentColor: '#c8a96e',
      message: 'Berea College son başvurusu: 15 Ocak 2027 — takvime eklendi.', ts: nowStr(),
    },
  ])
  const feedRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [feed])

  useEffect(() => {
    return () => { timersRef.current.forEach((t) => clearInterval(t)) }
  }, [])

  function pushFeed(agent: AgentDef, message: string) {
    setFeed((prev) => [
      ...prev,
      { id: rid(), agentId: agent.id, agentName: agent.name, agentColor: agent.color, message, ts: nowStr() },
    ])
  }

  function startAgent(id: string) {
    const agent = agents.find((a) => a.id === id)
    if (!agent || agent.status === 'active') return

    setAgents((prev) =>
      prev.map((a) => a.id === id ? { ...a, status: 'active', lastRun: 'Az önce' } : a)
    )
    pushFeed(agent, `${agent.name} başlatıldı. ${agent.module} modülü izleniyor.`)

    const msgs = MOCK_MESSAGES[id] ?? []
    let i = 0
    const interval = setInterval(() => {
      const msg = msgs[i % msgs.length]
      if (msg) pushFeed(agent, msg)
      i++
    }, 8000 + Math.random() * 4000)
    timersRef.current.set(id, interval)
  }

  function stopAgent(id: string) {
    const agent = agents.find((a) => a.id === id)
    if (!agent || agent.status !== 'active') return

    clearInterval(timersRef.current.get(id))
    timersRef.current.delete(id)

    setAgents((prev) =>
      prev.map((a) => a.id === id ? { ...a, status: 'stopped', lastRun: 'Az önce durduruldu' } : a)
    )
    pushFeed(agent, `${agent.name} durduruldu.`)
  }

  function startAll() {
    agents.forEach((a) => { if (a.status !== 'active') startAgent(a.id) })
  }

  const activeCount = agents.filter((a) => a.status === 'active').length
  const selectedAgent = agents.find((a) => a.id === selectedId) ?? null

  const agents3D: Agent3D[] = agents.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    color: a.color,
    status: a.status,
    module: a.module,
    lastActivity: a.lastRun,
    description: a.description,
  }))

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Sub-tab bar ── */}
      <div className="flex items-center gap-1 px-6 pt-6 pb-0 shrink-0">
        {(['agentler', 'office'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-4 py-2 rounded-xl font-medium transition-colors ${
              tab === t
                ? 'bg-gold text-background'
                : 'text-muted hover:text-foreground border border-border hover:border-border/60'
            }`}
          >
            {t === 'agentler' ? '🤖 Agentler' : '🏢 Office'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 ? (
            <span className="text-xs text-emerald-400 font-medium">{activeCount} aktif</span>
          ) : (
            <span className="text-xs text-muted">Beklemede</span>
          )}
          <button
            onClick={startAll}
            className="text-xs px-3 py-2 rounded-xl border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
          >
            Tümünü Başlat
          </button>
          <button className="text-xs px-3 py-2 rounded-xl bg-gold text-background font-medium hover:opacity-80 transition-opacity">
            + Yeni Agent
          </button>
        </div>
      </div>

      {/* ── Agentler tab ── */}
      {tab === 'agentler' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6">

            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold text-foreground">Agent Ofisi</h1>
              <p className="text-sm text-muted mt-1">
                {activeCount > 0 ? (
                  <><span className="text-emerald-400 font-medium">{activeCount} agent aktif</span> · {agents.length - activeCount} beklemede</>
                ) : (
                  'Tüm agentlar beklemede'
                )}
              </p>
            </div>

            {/* Agent grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onStart={() => startAgent(agent.id)}
                  onStop={() => stopAgent(agent.id)}
                />
              ))}
            </div>

            {/* Live feed */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-xs font-medium text-muted uppercase tracking-wider">Canlı Feed</p>
                <span className="text-[10px] text-muted/40 ml-auto">{feed.length} mesaj</span>
              </div>
              <div
                ref={feedRef}
                className="bg-surface border border-border rounded-2xl overflow-y-auto"
                style={{ height: '260px' }}
              >
                {feed.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted text-sm">
                    Agent başlatılınca mesajlar burada görünür.
                  </div>
                ) : (
                  <div className="p-4 flex flex-col gap-1">
                    {feed.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2 group">
                        <span className="text-[10px] text-muted/40 shrink-0 mt-0.5 font-mono w-16">{entry.ts}</span>
                        <span
                          className="text-[10px] font-medium shrink-0 mt-0.5 w-28 truncate"
                          style={{ color: entry.agentColor }}
                        >
                          {entry.agentName}
                        </span>
                        <span className="text-[11px] text-foreground/80 leading-relaxed">{entry.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Office 3D tab ── */}
      {tab === 'office' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 relative">
            <Office3D
              agents={agents3D}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {/* Hint */}
            {!selectedId && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/30 pointer-events-none select-none">
                Masaya tıkla · Kaydır: zoom · Sürükle: döndür
              </div>
            )}
          </div>

          {/* ── Side panel ── */}
          <div
            className="shrink-0 border-l border-border flex flex-col overflow-hidden transition-all duration-300"
            style={{ width: selectedAgent ? '280px' : '0px' }}
          >
            {selectedAgent && (
              <div className="w-[280px] flex flex-col h-full p-5 gap-5">
                {/* Agent identity */}
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedAgent.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedAgent.name}</p>
                    <p className="text-[10px] text-muted mt-0.5">{selectedAgent.module}</p>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="ml-auto text-muted hover:text-foreground text-lg leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Status badge */}
                <StatusBadge status={selectedAgent.status} />

                {/* Description */}
                <p className="text-xs text-muted leading-relaxed">{selectedAgent.description}</p>

                {/* Last run */}
                {selectedAgent.lastRun && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted/50 uppercase tracking-wider">Son çalışma</span>
                    <span className="text-[11px] text-foreground/70">{selectedAgent.lastRun}</span>
                  </div>
                )}

                {/* Action */}
                <div className="mt-auto flex gap-2">
                  {selectedAgent.status !== 'active' ? (
                    <button
                      onClick={() => startAgent(selectedAgent.id)}
                      className="flex-1 text-xs py-2.5 rounded-xl font-medium text-background transition-opacity hover:opacity-80"
                      style={{ background: selectedAgent.color }}
                    >
                      Başlat
                    </button>
                  ) : (
                    <button
                      onClick={() => stopAgent(selectedAgent.id)}
                      className="flex-1 text-xs py-2.5 rounded-xl font-medium border border-border text-muted hover:text-foreground transition-colors"
                    >
                      Durdur
                    </button>
                  )}
                </div>

                {/* Recent feed for this agent */}
                <div>
                  <p className="text-[10px] text-muted/50 uppercase tracking-wider mb-2">Son Aktivite</p>
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                    {feed
                      .filter((f) => f.agentId === selectedAgent.id)
                      .slice(-5)
                      .reverse()
                      .map((f) => (
                        <div key={f.id} className="flex flex-col gap-0.5">
                          <span className="text-[9px] text-muted/40 font-mono">{f.ts}</span>
                          <span className="text-[11px] text-foreground/70 leading-snug">{f.message}</span>
                        </div>
                      ))}
                    {feed.filter((f) => f.agentId === selectedAgent.id).length === 0 && (
                      <p className="text-[11px] text-muted/40">Henüz aktivite yok.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AgentStatus }) {
  const cfg = {
    active:  { label: 'Aktif',      dotCls: 'bg-emerald-400 animate-pulse', textCls: 'text-emerald-400', bgCls: 'bg-emerald-400/10 border-emerald-400/20' },
    idle:    { label: 'Beklemede',  dotCls: 'bg-muted/50',                  textCls: 'text-muted',       bgCls: 'bg-surface border-border' },
    stopped: { label: 'Durduruldu', dotCls: 'bg-red-400/60',                textCls: 'text-red-400/80',  bgCls: 'bg-red-400/5 border-red-400/20' },
  }[status]

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${cfg.bgCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotCls}`} />
      <span className={`text-xs font-medium ${cfg.textCls}`}>{cfg.label}</span>
    </div>
  )
}

// ─── AgentCard ────────────────────────────────────────────────────────────────

function AgentCard({ agent, onStart, onStop }: {
  agent: AgentDef
  onStart: () => void
  onStop: () => void
}) {
  const statusCfg = {
    active:  { label: 'Aktif',      dotCls: 'bg-emerald-400 animate-pulse', textCls: 'text-emerald-400' },
    idle:    { label: 'Beklemede',  dotCls: 'bg-muted/50',                  textCls: 'text-muted' },
    stopped: { label: 'Durduruldu', dotCls: 'bg-red-400/60',                textCls: 'text-red-400/80' },
  }[agent.status]

  return (
    <div
      className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 transition-colors hover:border-border/60"
      style={{ borderTopColor: agent.color, borderTopWidth: '2px' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{agent.icon}</span>
          <div>
            <p className="text-sm font-semibold text-foreground leading-snug">{agent.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusCfg.dotCls}`} />
              <span className={`text-[10px] font-medium ${statusCfg.textCls}`}>{statusCfg.label}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted leading-relaxed">{agent.description}</p>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted/50 uppercase tracking-wider w-20 shrink-0">Modül</span>
          <span className="text-[10px] text-foreground/70">{agent.module}</span>
        </div>
        {agent.lastRun && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted/50 uppercase tracking-wider w-20 shrink-0">Son çalışma</span>
            <span className="text-[10px] text-foreground/70">{agent.lastRun}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-auto pt-1">
        {agent.status !== 'active' ? (
          <button
            onClick={onStart}
            className="flex-1 text-xs py-2 rounded-xl font-medium transition-colors text-background"
            style={{ background: agent.color }}
          >
            Başlat
          </button>
        ) : (
          <button
            onClick={onStop}
            className="flex-1 text-xs py-2 rounded-xl font-medium border border-border text-muted hover:text-foreground transition-colors"
          >
            Durdur
          </button>
        )}
        <button className="text-xs px-3 py-2 rounded-xl border border-border text-muted hover:text-foreground transition-colors">
          Detay
        </button>
      </div>
    </div>
  )
}
