'use client'

// MAXAİ Ofis (Sprint 7 — Company Foundation): sahne artık dekor değil, şirket
// organizasyonunun haritası. Alanlar: Sanchez Ofisi, Executive Council (13
// head koltuğu + başkan), Agent Intelligence Core (Brain küresi — canlı
// retrieval sinyali), Common Area (legacy ajanların oturduğu hol) ve 13
// departman odası (lib/company/registry.ts'ten türetilir; geometri
// floor-plan.ts'te yaşar, bu dosya yalnız çizer).
//
// CANLI VERİ: runtime ajanlar (/api/agents/list) findSeatByRuntimeAgent ile
// departman odalarına dağıtılır — eşleşmeyenler (emekli hat) Common Area'da
// oturur. Durumlar /api/agents/runs'tan 5 sn'de bir; Brain küresi
// /api/brain/activity. Boş departman odaları placeholder'dır (masa + bitki)
// ama oda kimliği company registry'ye bağlı — canlı veri bağlamak = ajanı
// registry'de koltuğa oturtmak, sahne kodu değişmez.
//
// ETKİLEŞİM: avatar tıklanınca AgentDetailPanel (geniş ekranda yan panel,
// dar ekranda alttan sheet). Sanchez registry ajanı değil — kendi ofisinde
// sabit, koşu rozeti almaz, tıklanamaz. Uzay arka planı bilinçli korunur.

import { useEffect, useState } from 'react'
import { findSeatByRuntimeAgent, getCompanyDepartment } from '@/lib/company/registry'
import type { CompanyDepartmentId } from '@/lib/company/types'
import AgentAvatar, { AGENT_AVATAR_VISUALS, FALLBACK_AVATAR_VISUAL } from './AgentAvatar'
import AgentDetailPanel from './AgentDetailPanel'
import StatusBadge, { statusFromRun, type AgentStatus } from './StatusBadge'
import { fmtRelative, runSummary, type AgentMeta, type AgentRun } from './office-data'
import {
  COLS, ROWS, T,
  COMMON_AREA, COMMON_SEAT_XS, COMMON_SEAT_Y,
  DEPT_ROOMS, deptDeskAnchor,
  EXECUTIVE_COUNCIL_ROOM, FLOOR_RECTS, INTELLIGENCE_CORE, SANCHEZ_OFFICE,
  type DeptRoom,
} from './floor-plan'

function buildGrid(): { floor: boolean[][]; wall: boolean[][] } {
  const floor: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false))
  for (const r of FLOOR_RECTS)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) floor[y][x] = true

  const wall: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false))
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      if (floor[y][x]) continue
      outer: for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy
          const nx = x + dx
          if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && floor[ny][nx]) {
            wall[y][x] = true
            break outer
          }
        }
    }
  return { floor, wall }
}

// Satır içi ardışık hücreleri tek rect'e birleştir (rect sayısını düşürür)
function rowRuns(cells: boolean[][]): Array<{ x: number; y: number; w: number }> {
  const runs: Array<{ x: number; y: number; w: number }> = []
  for (let y = 0; y < ROWS; y++) {
    let start = -1
    for (let x = 0; x <= COLS; x++) {
      const on = x < COLS && cells[y][x]
      if (on && start === -1) start = x
      if (!on && start !== -1) {
        runs.push({ x: start, y, w: x - start })
        start = -1
      }
    }
  }
  return runs
}

const { floor: FLOOR, wall: WALL } = buildGrid()
const FLOOR_RUNS = rowRuns(FLOOR)
const WALL_RUNS = rowRuns(WALL)

// ── renkler ───────────────────────────────────────────────────────────────────
// İç mekân bilinçli AYDINLIK: zemin beyaz, grid çok soluk, duvarlar açık gri.
const C = {
  floor: '#ffffff',
  grid: '#b0bac9',
  wall: '#aeb5c0',
  wallEdge: '#8b93a0',
  deskTop: '#d7dee8',
  deskEdge: '#64748b',
  monitor: '#1e293b',
  screen: '#67e8f9',
  chair: '#9aa6b5',
  sofa: '#ccd2db',
  sofaEdge: '#8e97a3',
  sign: '#eef1f6',
  plantPot: '#9ca3af',
  plantLeaf: '#34d399',
  metal: '#b7bec9',
  metalEdge: '#828a96',
  council: '#f59e0b',
}

// ── mobilya primitifleri (tile koordinatı, piksel-art bloklar) ────────────────

function Desk({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* monitör: kasa + parlayan ekran */}
      <rect x={x + 0.95} y={y - 0.72} width={1.1} height={0.82} rx={0.08} fill={C.monitor} />
      <rect x={x + 1.06} y={y - 0.61} width={0.88} height={0.54} fill={C.screen} opacity={0.9} />
      <rect x={x + 1.38} y={y - 0.02} width={0.24} height={0.14} fill={C.monitor} />
      {/* masa */}
      <rect x={x} y={y + 0.12} width={3} height={1.15} rx={0.1} fill={C.deskTop} stroke={C.deskEdge} strokeWidth={0.08} />
      <rect x={x + 1.1} y={y + 0.48} width={0.8} height={0.22} rx={0.06} fill={C.deskEdge} opacity={0.55} />
      {/* sandalye */}
      <rect x={x + 1.05} y={y + 1.55} width={0.9} height={0.85} rx={0.2} fill={C.chair} stroke={C.deskEdge} strokeWidth={0.07} />
    </g>
  )
}

function Sofa({ x, y, facing }: { x: number; y: number; facing: 'down' | 'up' }) {
  const backY = facing === 'down' ? y : y + 1.05
  return (
    <g>
      <rect x={x} y={y} width={5.4} height={1.7} rx={0.22} fill={C.sofa} stroke={C.sofaEdge} strokeWidth={0.09} />
      <rect x={x} y={backY} width={5.4} height={0.62} rx={0.2} fill={C.sofaEdge} opacity={0.75} />
      <rect x={x - 0.02} y={y} width={0.55} height={1.7} rx={0.18} fill={C.sofa} stroke={C.sofaEdge} strokeWidth={0.09} />
      <rect x={x + 4.87} y={y} width={0.55} height={1.7} rx={0.18} fill={C.sofa} stroke={C.sofaEdge} strokeWidth={0.09} />
      {[1.35, 2.85, 4.35].map((cx) => (
        <line key={cx} x1={x + cx} y1={y + (facing === 'down' ? 0.7 : 0.1)} x2={x + cx} y2={y + (facing === 'down' ? 1.6 : 1.0)} stroke={C.sofaEdge} strokeWidth={0.07} opacity={0.6} />
      ))}
    </g>
  )
}

function CoffeeTable({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={2.6} height={1.5} rx={0.18} fill={C.metal} stroke={C.metalEdge} strokeWidth={0.09} />
      <rect x={x + 0.35} y={y + 0.3} width={1.9} height={0.9} rx={0.1} fill="#e6e9ee" />
    </g>
  )
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 0.25} y={y + 0.85} width={0.7} height={0.55} fill={C.plantPot} stroke={C.metalEdge} strokeWidth={0.06} />
      <rect x={x + 0.42} y={y + 0.1} width={0.36} height={0.85} fill={C.plantLeaf} />
      <rect x={x + 0.08} y={y + 0.38} width={0.36} height={0.5} fill="#10b981" />
      <rect x={x + 0.76} y={y + 0.32} width={0.36} height={0.55} fill="#10b981" />
    </g>
  )
}

function Cabinet({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={0.95} height={1.6} rx={0.08} fill={C.metal} stroke={C.metalEdge} strokeWidth={0.08} />
      <line x1={x + 0.15} y1={y + 0.55} x2={x + 0.8} y2={y + 0.55} stroke={C.metalEdge} strokeWidth={0.07} />
      <line x1={x + 0.15} y1={y + 1.1} x2={x + 0.8} y2={y + 1.1} stroke={C.metalEdge} strokeWidth={0.07} />
    </g>
  )
}

function Vending({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={1.5} height={2.1} rx={0.1} fill="#64748b" stroke="#475569" strokeWidth={0.08} />
      <rect x={x + 0.18} y={y + 0.2} width={0.85} height={1.35} fill={C.screen} opacity={0.75} />
      <rect x={x + 1.12} y={y + 0.25} width={0.22} height={0.9} fill="#94a3b8" />
    </g>
  )
}

function Cooler({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 0.15} y={y + 0.55} width={0.6} height={0.75} rx={0.08} fill={C.metal} stroke={C.metalEdge} strokeWidth={0.07} />
      <rect x={x + 0.22} y={y} width={0.46} height={0.6} rx={0.14} fill="#bae6fd" stroke={C.metalEdge} strokeWidth={0.07} />
    </g>
  )
}

// Duvar panosu: 3 segmentli cyan ekran şeridi (Sanchez Ofisi)
function WallScreens({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={5} height={0.75} rx={0.08} fill={C.monitor} />
      {[0.15, 1.85, 3.55].map((dx) => (
        <rect key={dx} x={x + dx} y={y + 0.12} width={1.3} height={0.5} fill={C.screen} opacity={0.85} />
      ))}
    </g>
  )
}

// ── Executive Council masası ─────────────────────────────────────────────────
// 13 head koltuğu (6 üst + 6 alt + 1 sağ) + masa başında başkan koltuğu
// (amber — Sanchez'in karar makamı). Koltuk sayısı EXECUTIVE_COUNCIL üyeleriyle
// aynı kavramdır; çizim sabittir çünkü konsey 13 head'dir (test korur).

function CouncilTable({ x, y }: { x: number; y: number }) {
  const tableX = x + 4
  const tableY = y + 2.9
  const seatsTop = [0, 1, 2, 3, 4, 5].map((i) => ({ cx: tableX + 0.9 + i * 1.9, cy: tableY - 1.1 }))
  const seatsBottom = [0, 1, 2, 3, 4, 5].map((i) => ({ cx: tableX + 0.9 + i * 1.9, cy: tableY + 3.05 }))
  const seatRight = { cx: tableX + 12.4, cy: tableY + 0.95 }
  return (
    <g>
      <rect x={tableX} y={tableY} width={12} height={2.6} rx={0.5} fill={C.deskTop} stroke={C.deskEdge} strokeWidth={0.1} />
      <rect x={tableX + 0.7} y={tableY + 0.7} width={10.6} height={1.2} rx={0.3} fill="#e6e9ee" />
      {[...seatsTop, ...seatsBottom, seatRight].map((s, i) => (
        <rect key={i} x={s.cx - 0.45} y={s.cy - 0.4} width={0.9} height={0.8} rx={0.2}
          fill={C.chair} stroke={C.deskEdge} strokeWidth={0.07} />
      ))}
      {/* başkan koltuğu — masa başı, amber */}
      <rect x={tableX - 1.7} y={tableY + 0.55} width={1.1} height={1.5} rx={0.24}
        fill={C.council} stroke="#b45309" strokeWidth={0.09} />
    </g>
  )
}

// ── Brain küresi (Agent Intelligence Core) ────────────────────────────────────
// İki mod: sakin ve aktif (son ~10 sn'de gerçek bir hibrit retrieval koştu —
// /api/brain/activity). Aktifte nabız/yörünge hızlanır, halo belirir; geçişi
// 800ms opacity transition yumuşatır.

function BrainSphere({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={3.0} fill="#ede9fe" opacity={0.55} />
      <circle cx={x} cy={y} r={3.0} fill="none" stroke="#c4b5fd" strokeWidth={0.16} opacity={0.8} />
      <circle
        cx={x} cy={y} r={2.85} fill="url(#brainGlow)"
        opacity={active ? 0.75 : 0}
        style={{ transition: 'opacity 800ms ease' }}
      />
      <circle
        className={active ? 'maxai-brain-pulse-active' : 'maxai-brain-pulse'}
        cx={x} cy={y} r={2.45} fill="url(#brainGlow)"
      />
      <circle
        className={active ? 'maxai-brain-orbit-active' : 'maxai-brain-orbit'}
        cx={x} cy={y} r={2.05}
        fill="none" stroke="#a78bfa" strokeWidth={0.09}
        strokeDasharray="0.55 0.75" opacity={0.75}
        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      />
      <circle cx={x} cy={y} r={1.4} fill="url(#brainCore)" />
      <circle
        cx={x} cy={y} r={1.4} fill="#7c3aed"
        opacity={active ? 0.3 : 0}
        style={{ transition: 'opacity 800ms ease' }}
      />
      <circle cx={x - 0.45} cy={y - 0.5} r={0.3} fill="#ffffff" opacity={0.85} />
    </g>
  )
}

// Oda tabelası: duvar sırasının üstünde açık renk yazı
function RoomSign({ x, y, text, size = 0.78 }: { x: number; y: number; text: string; size?: number }) {
  return (
    <text
      x={x} y={y} textAnchor="middle"
      fontSize={size} fontWeight={700} letterSpacing="0.18em"
      fill={C.sign} opacity={0.9}
      style={{ textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}
    >
      {text}
    </text>
  )
}

// ── SVG içinde StatusBadge ────────────────────────────────────────────────────
// HTML rozet foreignObject ile sahneye gömülür. İçerik 16× büyük çizilip
// transform'la küçültülür: tarayıcıların küçük font clamp'ine takılmadan
// keskin metin verir. Genişlik rozeti ortalamak için sabittir.

const BADGE_SCALE = 1 / 16
const BADGE_W = 120
const BADGE_H = 22

function SvgStatusBadge({ cx, y, status }: { cx: number; y: number; status: AgentStatus }) {
  return (
    <foreignObject
      width={BADGE_W}
      height={BADGE_H}
      transform={`translate(${cx - (BADGE_W * BADGE_SCALE) / 2} ${y}) scale(${BADGE_SCALE})`}
    >
      <div className="flex justify-center">
        <StatusBadge status={status} />
      </div>
    </foreignObject>
  )
}

// ── canlı ajan durumu (registry + agent_runs) ────────────────────────────────

const POLL_MS = 5000
/** Son retrieval bu pencerenin içindeyse Brain küresi "aktif" moda geçer. */
const BRAIN_ACTIVE_WINDOW_MS = 10_000

// ── uzay arka planı (önceki sahneden korunuyor) ───────────────────────────────

const FAR_STARS = {
  backgroundImage: `
    radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.55) 50%, transparent 100%),
    radial-gradient(1px 1px at 90px 70px, rgba(255,255,255,0.4) 50%, transparent 100%),
    radial-gradient(1px 1px at 130px 20px, rgba(255,255,255,0.35) 50%, transparent 100%),
    radial-gradient(1px 1px at 50px 110px, rgba(255,255,255,0.45) 50%, transparent 100%)
  `,
  backgroundRepeat: 'repeat',
  backgroundSize: '160px 160px',
}

const NEAR_STARS = {
  backgroundImage: `
    radial-gradient(1.5px 1.5px at 40px 60px, rgba(255,255,255,0.8) 50%, transparent 100%),
    radial-gradient(1.5px 1.5px at 180px 30px, rgba(255,255,255,0.65) 50%, transparent 100%),
    radial-gradient(1px 1px at 110px 150px, rgba(255,255,255,0.6) 50%, transparent 100%),
    radial-gradient(1.5px 1.5px at 220px 190px, rgba(255,255,255,0.7) 50%, transparent 100%)
  `,
  backgroundRepeat: 'repeat',
  backgroundSize: '240px 240px',
}

// ── sahne ─────────────────────────────────────────────────────────────────────

export default function OfficeLayout() {
  const [agents, setAgents] = useState<AgentMeta[]>([])
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [brainActive, setBrainActive] = useState(false)

  // Registry bir kez; koşular + brain aktivitesi 5 sn'de bir (koşu chat/panel
  // gibi başka bir yüzeyden de başlayabildiği için polling koşulsuz — istekler
  // tek ve hafif; WebSocket bilinçli yok, mevcut döngü yeterli).
  useEffect(() => {
    let alive = true
    fetch('/api/agents/list')
      .then((r) => r.json())
      .then((list: AgentMeta[]) => { if (alive) setAgents(list) })
      .catch(() => {})

    const loadRuns = () =>
      fetch('/api/agents/runs')
        .then((r) => r.json())
        .then((data: AgentRun[]) => { if (alive && Array.isArray(data)) setRuns(data) })
        .catch(() => {})
    // Aktiflik boolean olarak state'e yazılır (timestamp değil): pencere
    // dolunca değer false'a döner ve render tetiklenir — aynı timestamp'i
    // saklamak React bail-out'u yüzünden küreyi aktif modda dondururdu.
    const loadBrain = () =>
      fetch('/api/brain/activity')
        .then((r) => r.json())
        .then((data: { lastRetrievalAt: number | null }) => {
          if (!alive) return
          setBrainActive(
            typeof data.lastRetrievalAt === 'number' &&
            Date.now() - data.lastRetrievalAt < BRAIN_ACTIVE_WINDOW_MS,
          )
        })
        .catch(() => {})
    const tick = () => { loadRuns(); loadBrain() }
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // Ajan başına son koşu (runs started_at DESC sıralı geliyor).
  const latestByAgent: Record<string, AgentRun> = {}
  for (const run of runs) latestByAgent[run.agent_name] ??= run

  const lastRun = runs[0]
  const lastRunAgent = lastRun
    ? agents.find((a) => a.name === lastRun.agent_name)?.displayName ?? lastRun.agent_name
    : null

  const selectedAgent = agents.find((a) => a.name === selectedAgentId) ?? null

  // Runtime ajan → departman odası dağıtımı (company registry köprüsü).
  // Koltuğu olmayanlar legacy hattır — Common Area'da oturur.
  const roomAgent: Partial<Record<CompanyDepartmentId, AgentMeta>> = {}
  const commonAgents: AgentMeta[] = []
  for (const agent of agents) {
    const companySeat = findSeatByRuntimeAgent(agent.name)
    if (companySeat && !roomAgent[companySeat.departmentId]) roomAgent[companySeat.departmentId] = agent
    else commonAgents.push(agent)
  }

  /** Tıklanabilir avatar sarmalayıcısı — masa/hol ortak etkileşim dili. */
  const renderClickableAgent = (
    agent: AgentMeta,
    pos: { x: number; y: number },
    opts?: { withDesk?: boolean },
  ) => {
    const visual =
      AGENT_AVATAR_VISUALS[agent.name] ??
      { label: agent.displayName.slice(0, 10), ...FALLBACK_AVATAR_VISUAL }
    const status = statusFromRun(latestByAgent[agent.name]?.status)
    const isSelected = selectedAgentId === agent.name
    const select = () =>
      setSelectedAgentId((cur) => (cur === agent.name ? null : agent.name))
    return (
      <g
        key={agent.name}
        role="button"
        tabIndex={0}
        aria-label={`${agent.displayName} detayını aç`}
        className="cursor-pointer focus:outline-none"
        onClick={(e) => { e.stopPropagation(); select() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select() }
        }}
      >
        {/* görünmez tıklama alanı: masa + avatar + rozetin tamamı */}
        <rect x={pos.x - 0.35} y={pos.y - 1.05} width={3.7} height={6.2} fill="transparent" />
        {isSelected && (
          <rect
            x={pos.x - 0.35} y={pos.y - 1.05} width={3.7} height={6.2} rx={0.35}
            fill="none" stroke="#67e8f9" strokeWidth={0.12}
            strokeDasharray="0.5 0.35" opacity={0.9}
          />
        )}
        {opts?.withDesk && <Desk x={pos.x} y={pos.y} />}
        <AgentAvatar
          x={pos.x + 0.85}
          y={pos.y + 0.65}
          body={visual.body}
          dark={visual.dark}
          name={visual.label}
          variant={visual.variant}
          status={status}
          labelSize={0.56}
        />
        <SvgStatusBadge cx={pos.x + 1.65} y={pos.y + 3.55} status={status} />
      </g>
    )
  }

  const renderDeptRoom = (room: DeptRoom) => {
    const desk = deptDeskAnchor(room)
    const occupant = roomAgent[room.id]
    const department = getCompanyDepartment(room.id)
    return (
      <g key={room.id} aria-label={`${department?.displayName ?? room.id} odası`}>
        <RoomSign x={room.x + room.w / 2} y={room.y - 0.22} text={room.sign} size={0.62} />
        {occupant ? (
          renderClickableAgent(occupant, desk, { withDesk: true })
        ) : (
          <>
            {/* boş koltuk — oda kuruldu, ajanı henüz işe alınmadı */}
            <Desk x={desk.x} y={desk.y} />
            <Plant x={room.x + 0.4} y={room.y + room.h - 1.9} />
          </>
        )}
      </g>
    )
  }

  return (
    <div className="flex h-full min-h-[520px] w-full">
    <div
      className="relative min-w-0 flex-1 overflow-hidden"
      onClick={() => setSelectedAgentId(null)}
      style={{
        background: 'radial-gradient(ellipse at center, #131b3a 0%, #070a16 55%, #000000 100%)',
      }}
    >
      <style>{`
        @keyframes maxaiStarPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.85; }
        }
        .maxai-star-pulse { animation: maxaiStarPulse 6s ease-in-out infinite; }

        @keyframes maxaiBrainPulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.9; }
        }
        .maxai-brain-pulse { animation: maxaiBrainPulse 3.2s ease-in-out infinite; }

        @keyframes maxaiBrainPulseActive {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        .maxai-brain-pulse-active { animation: maxaiBrainPulseActive 1.2s ease-in-out infinite; }

        @keyframes maxaiOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .maxai-brain-orbit { animation: maxaiOrbit 16s linear infinite; }
        .maxai-brain-orbit-active { animation: maxaiOrbit 5s linear infinite; }

        @keyframes maxaiBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-0.14px); }
        }
        .maxai-bob { animation: maxaiBob 2.4s ease-in-out infinite; }

        @keyframes maxaiWorkPulse {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.95; }
        }
        .maxai-work-pulse { animation: maxaiWorkPulse 1.6s ease-in-out infinite; }
      `}</style>

      <div className="pointer-events-none absolute inset-0" style={FAR_STARS} />
      <div className="maxai-star-pulse pointer-events-none absolute inset-0" style={NEAR_STARS} />

      <svg
        viewBox={`0 0 ${COLS * T} ${ROWS * T}`}
        preserveAspectRatio="xMidYMid meet"
        className="relative z-10 mx-auto h-full w-full p-2"
        role="img"
        aria-label="MAXAİ şirket kat planı"
      >
        <defs>
          <radialGradient id="brainCore">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
          <radialGradient id="brainGlow">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
          </radialGradient>
          <pattern id="floorGrid" width={1} height={1} patternUnits="userSpaceOnUse">
            <path d="M1 0H0V1" fill="none" stroke={C.grid} strokeWidth={0.05} opacity={0.35} />
          </pattern>
        </defs>

        <g transform={`scale(${T})`}>
          {/* zemin + duvarlar: piksel netliği */}
          <g shapeRendering="crispEdges">
            {FLOOR_RUNS.map((r, i) => (
              <rect key={`f${i}`} x={r.x} y={r.y} width={r.w} height={1} fill={C.floor} />
            ))}
            {FLOOR_RUNS.map((r, i) => (
              <rect key={`g${i}`} x={r.x} y={r.y} width={r.w} height={1} fill="url(#floorGrid)" opacity={0.1} />
            ))}
            {WALL_RUNS.map((r, i) => (
              <rect key={`w${i}`} x={r.x} y={r.y} width={r.w} height={1} fill={C.wall} stroke={C.wallEdge} strokeWidth={0.09} />
            ))}
          </g>

          {/* ── Sanchez Ofisi — komuta masası, registry ajanı değil ── */}
          <RoomSign
            x={SANCHEZ_OFFICE.x + SANCHEZ_OFFICE.w / 2}
            y={SANCHEZ_OFFICE.y - 0.22}
            text={SANCHEZ_OFFICE.sign}
          />
          <WallScreens x={SANCHEZ_OFFICE.x + 3} y={SANCHEZ_OFFICE.y + 0.2} />
          <Cabinet x={SANCHEZ_OFFICE.x + 0.4} y={SANCHEZ_OFFICE.y + 0.5} />
          <Cabinet x={SANCHEZ_OFFICE.x + 1.35} y={SANCHEZ_OFFICE.y + 0.5} />
          <g>
            <rect x={6} y={5.5} width={6} height={1.5} rx={0.12} fill={C.deskTop} stroke={C.deskEdge} strokeWidth={0.09} />
            <rect x={8.2} y={4.45} width={1.6} height={1.15} rx={0.08} fill={C.monitor} />
            <rect x={8.35} y={4.6} width={1.3} height={0.8} fill={C.screen} opacity={0.9} />
            <rect x={6.6} y={4.7} width={1.25} height={0.95} rx={0.08} fill={C.monitor} />
            <rect x={6.72} y={4.82} width={1.0} height={0.65} fill={C.screen} opacity={0.75} />
            <rect x={10.15} y={4.7} width={1.25} height={0.95} rx={0.08} fill={C.monitor} />
            <rect x={10.27} y={4.82} width={1.0} height={0.65} fill={C.screen} opacity={0.75} />
            <rect x={8.6} y={5.85} width={0.85} height={0.24} rx={0.06} fill={C.deskEdge} opacity={0.55} />
            <rect x={8.55} y={7.3} width={0.95} height={0.9} rx={0.2} fill={C.chair} stroke={C.deskEdge} strokeWidth={0.07} />
          </g>
          <AgentAvatar x={12.6} y={6.6} body="#f59e0b" dark="#b45309" name="Sanchez" variant="yildiz" />
          <Plant x={15.4} y={8.6} />

          {/* ── Executive Council — Company Layer: 13 head koltuğu + başkan ── */}
          <RoomSign
            x={EXECUTIVE_COUNCIL_ROOM.x + EXECUTIVE_COUNCIL_ROOM.w / 2}
            y={EXECUTIVE_COUNCIL_ROOM.y - 0.22}
            text={EXECUTIVE_COUNCIL_ROOM.sign}
          />
          <CouncilTable x={EXECUTIVE_COUNCIL_ROOM.x} y={EXECUTIVE_COUNCIL_ROOM.y} />
          <Plant x={EXECUTIVE_COUNCIL_ROOM.x + 0.4} y={EXECUTIVE_COUNCIL_ROOM.y + 0.3} />
          <Plant x={EXECUTIVE_COUNCIL_ROOM.x + EXECUTIVE_COUNCIL_ROOM.w - 1.6} y={EXECUTIVE_COUNCIL_ROOM.y + 0.3} />

          {/* ── Agent Intelligence Core — Brain küresi (canlı retrieval sinyali) ── */}
          <RoomSign
            x={INTELLIGENCE_CORE.x + INTELLIGENCE_CORE.w / 2}
            y={INTELLIGENCE_CORE.y - 0.22}
            text={INTELLIGENCE_CORE.sign}
          />
          <BrainSphere
            x={INTELLIGENCE_CORE.x + INTELLIGENCE_CORE.w / 2}
            y={INTELLIGENCE_CORE.y + 4.3}
            active={brainActive}
          />
          <Plant x={INTELLIGENCE_CORE.x + 0.5} y={INTELLIGENCE_CORE.y + 0.4} />
          <Plant x={INTELLIGENCE_CORE.x + INTELLIGENCE_CORE.w - 1.7} y={INTELLIGENCE_CORE.y + 0.4} />

          {/* ── Common Area — mobilya solda, legacy ajanlar sağda oturur ── */}
          <RoomSign x={COMMON_AREA.x + 9} y={COMMON_AREA.y - 0.22} text={COMMON_AREA.sign} size={0.62} />
          <Sofa x={COMMON_AREA.x + 2} y={COMMON_AREA.y + 0.6} facing="down" />
          <CoffeeTable x={COMMON_AREA.x + 8.2} y={COMMON_AREA.y + 0.9} />
          <Cooler x={COMMON_AREA.x + 11.6} y={COMMON_AREA.y + 0.8} />
          <Vending x={COMMON_AREA.x + 13.4} y={COMMON_AREA.y + 0.5} />
          <Plant x={COMMON_AREA.x + 0.3} y={COMMON_AREA.y + 0.4} />
          {commonAgents.slice(0, COMMON_SEAT_XS.length).map((agent, i) =>
            renderClickableAgent(agent, { x: COMMON_SEAT_XS[i], y: COMMON_SEAT_Y }),
          )}

          {/* ── 13 departman odası — company registry'den ── */}
          {DEPT_ROOMS.map(renderDeptRoom)}
        </g>
      </svg>

      {/* alt status bar — son koşu (gerçek agent_runs verisi) */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-white/10 bg-black/55 px-4 py-2 backdrop-blur-sm">
        {lastRun ? (
          <>
            <StatusBadge status={statusFromRun(lastRun.status)} className="shrink-0" />
            <p className="truncate text-2xs text-white/70">
              <span className="font-semibold text-white/90">{lastRunAgent}</span>
              {' · '}
              {runSummary(lastRun)}
              {' · '}
              {fmtRelative(lastRun.started_at)}
            </p>
          </>
        ) : (
          <p className="text-2xs text-white/60">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-white/30 align-middle" />
            Şirket hazır, henüz koşu yok — bir ajana tıklayıp detayından başlayabilirsin.
          </p>
        )}
      </div>
    </div>

    {selectedAgent && (
      <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedAgentId(null)} />
    )}
    </div>
  )
}
