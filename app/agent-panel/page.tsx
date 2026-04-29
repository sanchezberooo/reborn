'use client'

import { useState, useEffect } from 'react'

// ─── types ────────────────────────────────────────────────────────────────────

type Status = 'active' | 'idle' | 'done'

interface Agent {
  id: string
  name: string
  role: string
  status: Status
  lastTask: string
  current: string
  tasks: string[]
}

interface Group {
  id: string
  label: string
  color: string
  agents: Agent[]
}

// ─── data ─────────────────────────────────────────────────────────────────────

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
        current: 'Depodaki 47 SKU\'nun stok durumunu anlık izliyor.',
        tasks: ['Stok izleme', 'Kritik uyarı', 'Tedarik tahmini'] },
      { id: 'siparis', name: 'Ticaret Agent 4', role: 'Sipariş Takibi', status: 'idle',
        lastTask: "Bugün 23 siparişin kargo durumu güncellendi.",
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
        lastTask: "Yarın için 4 teslimat randevusu onaylandı.",
        current: 'Standby.',
        tasks: ['Randevu oluştur', 'Hatırlatma gönder', 'Takvim senkronizasyonu'] },
      { id: 'urun', name: 'Otomasyon Agent 3', role: 'Ürün Listeleme', status: 'active',
        lastTask: '7 yeni ürün Trendyol\'a otomatik olarak listelendi.',
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
        lastTask: "Bugünkü 2 post zamanında yayınlandı.",
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

// ─── among us avatar ──────────────────────────────────────────────────────────

function Avatar({ color, size = 44 }: { color: string; size?: number }) {
  const h = Math.round(size * 1.3)
  // darken color for backpack
  const dark = color + 'bb'
  return (
    <svg width={size} height={h} viewBox="0 0 44 57" fill="none">
      {/* head */}
      <ellipse cx="22" cy="17" rx="15" ry="15" fill={color} />
      {/* visor */}
      <rect x="11" y="8" width="20" height="14" rx="7" fill="#c8e8f8" opacity="0.88" />
      <rect x="13" y="10" width="7" height="6" rx="3" fill="white" opacity="0.65" />
      {/* body */}
      <rect x="8" y="27" width="28" height="20" rx="12" fill={color} />
      {/* backpack */}
      <rect x="34" y="24" width="8" height="14" rx="4" fill={dark} />
      {/* left leg */}
      <rect x="9" y="43" width="10" height="13" rx="5" fill={color} />
      {/* right leg */}
      <rect x="25" y="43" width="10" height="13" rx="5" fill={color} />
    </svg>
  )
}

// ─── status badge ─────────────────────────────────────────────────────────────

function Badge({ status }: { status: Status }) {
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

// ─── agent modal (standard click) ────────────────────────────────────────────

function AgentModal({ agent, color, onClose, onDetail }: {
  agent: Agent; color: string; onClose: () => void; onDetail: () => void
}) {
  const [task, setTask] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        className="relative bg-background border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
        style={{ borderTopColor: color, borderTopWidth: '2px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-foreground text-xl leading-none">×</button>

        {/* head */}
        <div className="flex items-center gap-4 mb-5">
          <Avatar color={color} size={52} />
          <div>
            <p className="text-base font-semibold text-foreground">{agent.name}</p>
            <p className="text-xs text-muted mb-1.5">{agent.role}</p>
            <Badge status={agent.status} />
          </div>
        </div>

        {/* last task */}
        <div className="mb-3">
          <p className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-1.5">Son Görev</p>
          <div className="text-sm text-foreground/80 bg-surface rounded-xl px-3 py-2.5 border border-border leading-relaxed">
            {agent.lastTask}
          </div>
        </div>

        {/* current */}
        <div className="mb-4">
          <p className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-1.5">Şu An Ne Yapıyor</p>
          <div className="text-sm text-foreground/80 bg-surface rounded-xl px-3 py-2.5 border border-border leading-relaxed">
            {agent.current}
          </div>
        </div>

        {/* assign task */}
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
            >
              Gönder
            </button>
            <button
              onClick={onDetail}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border text-muted hover:text-foreground transition-colors"
            >
              Detay
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── detail modal (full-screen) ───────────────────────────────────────────────

function DetailModal({ agent, color, onClose }: {
  agent: Agent; color: string; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative ml-auto h-full bg-background border-l border-border w-full max-w-lg overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* top accent */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

        <div className="p-8">
          <button onClick={onClose} className="absolute top-6 right-6 text-muted hover:text-foreground text-xl leading-none">×</button>

          {/* identity */}
          <div className="flex items-center gap-5 mb-8">
            <Avatar color={color} size={72} />
            <div>
              <p className="font-display text-xl font-semibold text-foreground">{agent.name}</p>
              <p className="text-sm text-muted mt-0.5">{agent.role}</p>
              <div className="mt-2"><Badge status={agent.status} /></div>
            </div>
          </div>

          {/* current status */}
          <section className="mb-6">
            <h3 className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-3">Şu An</h3>
            <div className="bg-surface border rounded-xl p-4" style={{ borderColor: `${color}30` }}>
              <p className="text-sm text-foreground/85 leading-relaxed">{agent.current}</p>
            </div>
          </section>

          {/* task history */}
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

          {/* capabilities */}
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

          {/* assign task */}
          <section>
            <h3 className="text-[10px] text-muted/50 uppercase tracking-widest font-medium mb-3">Görev Ver</h3>
            <textarea
              placeholder={`${agent.name}'e bir görev ver...`}
              rows={3}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted/40 resize-none focus:outline-none focus:border-gold/40 transition-colors mb-3"
            />
            <button
              className="w-full py-3 rounded-xl text-sm font-semibold text-background transition-opacity hover:opacity-85"
              style={{ background: color }}
            >
              Görevi Gönder
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

// ─── agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, color, onModal, onDetail }: {
  agent: Agent; color: string; onModal: () => void; onDetail: () => void
}) {
  return (
    <div
      className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3 hover:border-border/60 transition-colors cursor-pointer select-none"
      style={{ borderTopColor: color, borderTopWidth: '2px' }}
      onClick={onModal}
    >
      <div className="flex items-start justify-between gap-2">
        <Avatar color={color} size={40} />
        <div className="flex flex-col items-end gap-1">
          <Badge status={agent.status} />
          <button
            onClick={(e) => { e.stopPropagation(); onDetail() }}
            title="Detay"
            className="text-[10px] text-muted/40 hover:text-muted transition-colors px-1"
          >
            ···
          </button>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground leading-snug">{agent.name}</p>
        <p className="text-[11px] text-muted mt-0.5">{agent.role}</p>
      </div>
    </div>
  )
}

// ─── group section ────────────────────────────────────────────────────────────

function GroupSection({ group, onModal, onDetail }: {
  group: Group
  onModal: (a: Agent) => void
  onDetail: (a: Agent) => void
}) {
  const activeN = group.agents.filter((a) => a.status === 'active').length
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: group.color }} />
        <h2 className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">{group.label}</h2>
        <span className="text-[10px] text-muted/40 ml-auto">{activeN} aktif</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {group.agents.map((a) => (
          <AgentCard key={a.id} agent={a} color={group.color}
            onModal={() => onModal(a)} onDetail={() => onDetail(a)} />
        ))}
      </div>
    </div>
  )
}

// ─── agents tab ───────────────────────────────────────────────────────────────

function AgentsTab({ onModal, onDetail }: {
  onModal: (a: Agent, color: string) => void
  onDetail: (a: Agent, color: string) => void
}) {
  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((g) => (
        <GroupSection key={g.id} group={g}
          onModal={(a) => onModal(a, g.color)}
          onDetail={(a) => onDetail(a, g.color)}
        />
      ))}
    </div>
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
    desc: 'Tüm agent hafızaları burada saklanır. Geçmiş görevler, öğrenilen kalıplar ve veri arşivleri bu alanda tutulur. Hafıza Agenti buraya gelerek veri senkronizasyonu yapar.',
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
        {/* floor grid */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.035,
            backgroundImage: 'linear-gradient(#c8a96e 1px,transparent 1px),linear-gradient(90deg,#c8a96e 1px,transparent 1px)',
            backgroundSize: '36px 36px' }} />

        {/* ── Kütüphane (top center) ── */}
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

        {/* ── Ticaret (left column) ── */}
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

        {/* ── Otomasyon (right column) ── */}
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

        {/* ── Sanchez center ── */}
        <div
          className="absolute z-10 cursor-pointer"
          style={{ top: 88, left: '27%', right: '27%', bottom: '108px' }}
          onClick={(e) => { e.stopPropagation(); setAreaModal('sanchez') }}
        >
          {/* ambient glow */}
          <div className="absolute pointer-events-none"
            style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
              width: 220, height: 220, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(200,169,110,0.08) 0%, transparent 65%)' }} />
          {/* round table */}
          <div className="absolute pointer-events-none"
            style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
              width: 96, height: 96, borderRadius: '50%',
              border: '1px solid rgba(200,169,110,0.30)',
              background: 'radial-gradient(circle, rgba(200,169,110,0.11) 0%, rgba(200,169,110,0.03) 100%)' }}>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold tracking-widest uppercase"
              style={{ color: 'rgba(200,169,110,0.35)' }}>Hub</span>
          </div>
        </div>

        {/* ── Sosyal Medya (bottom strip) ── */}
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

        {/* ── Agents ── */}
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

        {/* ── Speech bubble ── */}
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

        {/* ── Area info modal ── */}
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

        {/* legend */}
        <div className="absolute bottom-2 right-2 z-20 pointer-events-none">
          <span className="text-[9px]" style={{ color: 'rgba(100,116,139,0.3)' }}>
            tıkla: modal · 2× detay · alan tıkla: bilgi
          </span>
        </div>
      </div>
    </>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

type ModalState = { agent: Agent; color: string } | null

export default function AgentPanelPage() {
  const [tab,     setTab]     = useState<'agentler' | 'office'>('agentler')
  const [modal,   setModal]   = useState<ModalState>(null)
  const [detail,  setDetail]  = useState<ModalState>(null)

  const openModal  = (a: Agent, c: string) => { setDetail(null); setModal({ agent: a, color: c }) }
  const openDetail = (a: Agent, c: string) => { setModal(null);  setDetail({ agent: a, color: c }) }

  const activeCount = ALL_AGENTS.filter((a) => a.status === 'active').length
  const totalCount  = ALL_AGENTS.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* ── header ── */}
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Agent Panel</h1>
              <p className="text-sm text-muted mt-1">
                <span className="text-emerald-400 font-medium">{activeCount}</span>
                <span> aktif · </span>
                <span className="text-foreground/50">{totalCount - activeCount} beklemede</span>
              </p>
            </div>

            {/* group color legend */}
            <div className="hidden sm:flex items-center gap-3">
              {GROUPS.map((g) => (
                <div key={g.id} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                  <span className="text-[11px] text-muted/60">{g.label.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── tab bar ── */}
          <div className="flex gap-1 mb-6">
            {(['agentler', 'office'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs px-4 py-2 rounded-xl font-medium transition-colors ${
                  tab === t
                    ? 'bg-gold text-background'
                    : 'text-muted hover:text-foreground border border-border/50 hover:border-border'
                }`}
              >
                {t === 'agentler' ? '👥 Agentler' : '🏢 Office'}
              </button>
            ))}
          </div>

          {/* ── content ── */}
          {tab === 'agentler' && (
            <AgentsTab onModal={openModal} onDetail={openDetail} />
          )}
          {tab === 'office' && (
            <OfficeTab onModal={openModal} onDetail={openDetail} />
          )}

        </div>
      </div>

      {/* ── modals ── */}
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
