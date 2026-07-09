// MAXAİ Ofis — bit-office (github.com/longyangxi/bit-office) varsayılan "Retro"
// ofisinin mimari planının tile-grid klonu, Reborn görünümüne uyarlanmış hali.
// Plan birebir referanstan: 4 köşe odası (sol üst büyük çalışma alanı, sağ üst
// oda, sol alt oda, sağ alt oda), odaları bağlayan merkez hol + dikey koridor,
// üst-orta ve alt-orta void girintileri. Oda anlamları MAXAİ'ye göre atandı:
// sağ üst = Brain (parlak küre), sol alt = Lounge (karşılıklı koltuklar),
// sol üst = Çalışma Alanı (Knowledge + Marketing), sağ alt = Sanchez Komuta.
//
// Duvarlar gri, zemin beyaz; bina dışında uzay/yıldız arka planı korunur.
// Tamamen client-side statik SVG — asset yok, backend yok.

const COLS = 32
const ROWS = 32
const T = 8 // SVG birimi / tile

// ── kat planı ─────────────────────────────────────────────────────────────────
// Zemin dikdörtgenleri tile koordinatında (x=col, y=row, w, h). Duvarlar elle
// çizilmez: zemine 8-komşulukla değen her boş hücre otomatik duvar olur. Böylece
// kapılar = iki bölgeyi köprüleyen zemin hücreleri; plan tutarlılığı garantili.
const FLOOR_RECTS: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 2, y: 2, w: 14, h: 12 },   // sol üst: çalışma alanı
  { x: 20, y: 2, w: 10, h: 8 },   // sağ üst: Brain odası
  { x: 24, y: 10, w: 2, h: 1 },   // Brain kapısı (güneye, hole)
  { x: 20, y: 11, w: 10, h: 4 },  // Brain altı hol bandı (yazıcı/otomat nişi)
  { x: 12, y: 14, w: 2, h: 1 },   // çalışma alanı kapısı (güneye, hole)
  { x: 10, y: 15, w: 20, h: 3 },  // merkez hol (yatay)
  { x: 14, y: 18, w: 4, h: 7 },   // dikey koridor (hol → alt odalar)
  { x: 2, y: 19, w: 11, h: 11 },  // sol alt: Lounge
  { x: 13, y: 21, w: 1, h: 2 },   // Lounge kapısı (doğuya, koridora)
  { x: 19, y: 19, w: 11, h: 11 }, // sağ alt: Sanchez Komuta
  { x: 18, y: 21, w: 1, h: 2 },   // Komuta kapısı (batıya, koridora)
]

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
const C = {
  floor: '#fafafa',
  grid: '#94a3b8',
  wall: '#a4abb6',
  wallEdge: '#7d8590',
  deskTop: '#cbd5e1',
  deskEdge: '#64748b',
  monitor: '#1e293b',
  screen: '#67e8f9',
  chair: '#94a3b8',
  sofa: '#c7cdd6',
  sofaEdge: '#8e97a3',
  label: '#b6bcc6',
  name: '#334155',
  plantPot: '#9ca3af',
  plantLeaf: '#34d399',
  metal: '#b0b7c3',
  metalEdge: '#828a96',
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
  // 3 kişilik koltuk: gövde + sırtlık + 2 kolçak + 3 minder çizgisi
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

function Armchair({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={1.6} height={2} rx={0.24} fill={C.sofa} stroke={C.sofaEdge} strokeWidth={0.09} />
      <rect x={x} y={y} width={0.5} height={2} rx={0.2} fill={C.sofaEdge} opacity={0.55} />
      <rect x={x} y={y - 0.02} width={1.6} height={0.45} rx={0.18} fill={C.sofaEdge} opacity={0.4} />
      <rect x={x} y={y + 1.57} width={1.6} height={0.45} rx={0.18} fill={C.sofaEdge} opacity={0.4} />
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

function Printer({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y + 0.35} width={1.6} height={1.0} rx={0.12} fill={C.metal} stroke={C.metalEdge} strokeWidth={0.08} />
      <rect x={x + 0.3} y={y} width={1.0} height={0.45} rx={0.08} fill="#e6e9ee" stroke={C.metalEdge} strokeWidth={0.06} />
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

function Whiteboard({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={0.8} rx={0.08} fill="#f1f5f9" stroke={C.metalEdge} strokeWidth={0.08} />
      <line x1={x + 0.4} y1={y + 0.28} x2={x + w * 0.55} y2={y + 0.28} stroke="#94a3b8" strokeWidth={0.08} />
      <line x1={x + 0.4} y1={y + 0.52} x2={x + w * 0.4} y2={y + 0.52} stroke="#94a3b8" strokeWidth={0.08} />
    </g>
  )
}

// Komuta odası duvar panosu: 3 segmentli cyan ekran şeridi
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

// ── Brain küresi ──────────────────────────────────────────────────────────────

function BrainSphere({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* zemin halkası */}
      <circle cx={x} cy={y} r={2.7} fill="#ede9fe" opacity={0.55} />
      <circle cx={x} cy={y} r={2.7} fill="none" stroke="#c4b5fd" strokeWidth={0.16} opacity={0.8} />
      {/* dış glow (nabız) */}
      <circle className="maxai-brain-pulse" cx={x} cy={y} r={2.2} fill="url(#brainGlow)" />
      {/* yörünge halkası */}
      <circle
        className="maxai-brain-orbit"
        cx={x} cy={y} r={1.85}
        fill="none" stroke="#a78bfa" strokeWidth={0.09}
        strokeDasharray="0.55 0.75" opacity={0.75}
        style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
      />
      {/* çekirdek */}
      <circle cx={x} cy={y} r={1.25} fill="url(#brainCore)" />
      <circle cx={x - 0.4} cy={y - 0.45} r={0.28} fill="#ffffff" opacity={0.85} />
    </g>
  )
}

// ── Among Us tarzı avatar ─────────────────────────────────────────────────────

function Avatar({ x, y, body, dark, name }: { x: number; y: number; body: string; dark: string; name: string }) {
  return (
    <g>
      <ellipse cx={x + 0.8} cy={y + 2.12} rx={0.78} ry={0.17} fill="#0f172a" opacity={0.14} />
      <g className="maxai-bob">
        {/* sırt çantası */}
        <rect x={x - 0.18} y={y + 0.55} width={0.42} height={1.0} rx={0.16} fill={dark} />
        {/* bacaklar */}
        <rect x={x + 0.2} y={y + 1.5} width={0.5} height={0.56} rx={0.14} fill={body} stroke={dark} strokeWidth={0.07} />
        <rect x={x + 0.92} y={y + 1.5} width={0.5} height={0.56} rx={0.14} fill={body} stroke={dark} strokeWidth={0.07} />
        {/* gövde (fasulye) */}
        <rect x={x + 0.14} y={y} width={1.34} height={1.72} rx={0.62} fill={body} stroke={dark} strokeWidth={0.09} />
        {/* vizör */}
        <rect x={x + 0.6} y={y + 0.4} width={0.92} height={0.58} rx={0.28} fill="#d6ecf9" stroke={dark} strokeWidth={0.08} />
        <rect x={x + 0.76} y={y + 0.5} width={0.34} height={0.18} rx={0.09} fill="#ffffff" opacity={0.9} />
      </g>
      <text
        x={x + 0.8} y={y + 2.75} textAnchor="middle"
        fontSize={0.72} fontWeight={700} letterSpacing="0.06em"
        fill={C.name} stroke="#ffffff" strokeWidth={0.16}
        style={{ paintOrder: 'stroke', textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}
      >
        {name}
      </text>
    </g>
  )
}

function RoomLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text
      x={x} y={y} textAnchor="middle"
      fontSize={0.78} fontWeight={700} letterSpacing="0.22em"
      fill={C.label}
      style={{ textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}
    >
      {text}
    </text>
  )
}

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
  return (
    <div
      className="relative h-full min-h-[520px] w-full overflow-hidden"
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

        @keyframes maxaiOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .maxai-brain-orbit { animation: maxaiOrbit 16s linear infinite; }

        @keyframes maxaiBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-0.14px); }
        }
        .maxai-bob { animation: maxaiBob 2.4s ease-in-out infinite; }
      `}</style>

      <div className="pointer-events-none absolute inset-0" style={FAR_STARS} />
      <div className="maxai-star-pulse pointer-events-none absolute inset-0" style={NEAR_STARS} />

      <svg
        viewBox={`0 0 ${COLS * T} ${ROWS * T}`}
        preserveAspectRatio="xMidYMid meet"
        className="relative z-10 mx-auto h-full w-full p-2"
        role="img"
        aria-label="MAXAİ Ofis kat planı"
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
              <rect key={`g${i}`} x={r.x} y={r.y} width={r.w} height={1} fill="url(#floorGrid)" opacity={0.16} />
            ))}
            {WALL_RUNS.map((r, i) => (
              <rect key={`w${i}`} x={r.x} y={r.y} width={r.w} height={1} fill={C.wall} stroke={C.wallEdge} strokeWidth={0.09} />
            ))}
          </g>

          {/* ── sol üst: Çalışma Alanı ── */}
          <Whiteboard x={6} y={1.1} w={4} />
          <Cabinet x={13} y={2.1} />
          <Cabinet x={14} y={2.1} />
          <Plant x={2.2} y={2.1} />
          <Plant x={2.2} y={11.5} />
          <Desk x={4} y={3.5} />
          <Desk x={10} y={3.5} />
          <Desk x={4} y={8.5} />
          <Desk x={10} y={8.5} />
          <RoomLabel x={9} y={13.45} text="Çalışma Alanı" />
          <Avatar x={7.2} y={4.1} body="#06b6d4" dark="#0e7490" name="Knowledge" />
          <Avatar x={13.1} y={9.0} body="#ec4899" dark="#be185d" name="Marketing" />

          {/* ── sağ üst: Brain odası ── */}
          <BrainSphere x={25} y={5.7} />
          <Plant x={20.3} y={2.1} />
          <Plant x={28.5} y={2.1} />
          <RoomLabel x={25} y={9.55} text="Brain" />

          {/* ── hol: yazıcı nişi + otomat + su sebili ── */}
          <Printer x={20.3} y={11.4} />
          <Vending x={28.3} y={11.2} />
          <Cooler x={24} y={16.6} />
          <Plant x={10.3} y={15.4} />

          {/* ── sol alt: Lounge ── */}
          <rect x={3.4} y={20.4} width={8.2} height={7.9} rx={0.3} fill="#f0f1f4" />
          <Sofa x={4.8} y={20.9} facing="down" />
          <Sofa x={4.8} y={26.1} facing="up" />
          <CoffeeTable x={6.2} y={23.6} />
          <Armchair x={2.6} y={23.35} />
          <Armchair x={10.9} y={23.35} />
          <Plant x={2.3} y={19.2} />
          <RoomLabel x={7.5} y={29.5} text="Lounge" />

          {/* ── sağ alt: Sanchez Komuta ── */}
          <WallScreens x={22} y={19.15} />
          <Cabinet x={19.3} y={19.5} />
          <Cabinet x={20.25} y={19.5} />
          {/* komuta masası: daha büyük masa + 3 ekran */}
          <g>
            <rect x={21.5} y={21.7} width={6} height={1.5} rx={0.12} fill={C.deskTop} stroke={C.deskEdge} strokeWidth={0.09} />
            <rect x={23.7} y={20.65} width={1.6} height={1.15} rx={0.08} fill={C.monitor} />
            <rect x={23.85} y={20.8} width={1.3} height={0.8} fill={C.screen} opacity={0.9} />
            <rect x={22.1} y={20.9} width={1.25} height={0.95} rx={0.08} fill={C.monitor} />
            <rect x={22.22} y={21.02} width={1.0} height={0.65} fill={C.screen} opacity={0.75} />
            <rect x={25.65} y={20.9} width={1.25} height={0.95} rx={0.08} fill={C.monitor} />
            <rect x={25.77} y={21.02} width={1.0} height={0.65} fill={C.screen} opacity={0.75} />
            <rect x={24.1} y={22.05} width={0.85} height={0.24} rx={0.06} fill={C.deskEdge} opacity={0.55} />
            <rect x={24.05} y={23.5} width={0.95} height={0.9} rx={0.2} fill={C.chair} stroke={C.deskEdge} strokeWidth={0.07} />
          </g>
          <Plant x={28.6} y={27.8} />
          <RoomLabel x={24.5} y={29.5} text="Komuta" />
          <Avatar x={25.9} y={23.9} body="#f59e0b" dark="#b45309" name="Sanchez" />
        </g>
      </svg>
    </div>
  )
}
