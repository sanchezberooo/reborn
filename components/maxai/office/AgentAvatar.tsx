// MAXAİ Ofis ajan avatarı — minimal, flat, geometrik dil (Among Us "fasulye +
// vizör + sırt çantası" formu tamamen terk edildi). Yuvarlak kafa + yumuşak
// dikdörtgen gövde + kafanın sağ üstünde ROL rozeti: her ajanın registry'deki
// işlevini anlatan küçük glyph (bayrak, kitap, büyüteç, kep, hedef, ampul,
// göz, yıldız). Tile koordinatında SVG çizer; OfficeLayout'un scale(T) grubu
// içinde kullanılır. Nabız/bob keyframe'leri OfficeLayout <style>'ında yaşar.

import type { AgentStatus } from './StatusBadge'

export type AvatarVariant =
  | 'bayrak'  // yol haritası / genel plan
  | 'kitap'   // ders planı / müfredat
  | 'buyutec' // keşif / araştırma
  | 'kep'     // burs / üniversite
  | 'hedef'   // tek hedefe derinleşme
  | 'ampul'   // beyin fırtınası
  | 'goz'     // eleştirmen / inceleme
  | 'yildiz'  // komutan (Sanchez)
  | 'rozet'   // bilinmeyen ajan: boş rozet

/** Registry ajanı → sahne görseli. Kısa etiket ≤10 karakter (komşu masa
 *  etiketleriyle çakışmasın); variant = rol bazlı rozet glyph'i. */
export const AGENT_AVATAR_VISUALS: Record<
  string,
  { label: string; body: string; dark: string; variant: AvatarVariant }
> = {
  // departman ajanları (Sprint 7 ofisinde kendi odalarında otururlar)
  'knowledge-agent':      { label: 'Knowledge',  body: '#8b5cf6', dark: '#6d28d9', variant: 'kitap' },
  'builder-agent':        { label: 'Builder',    body: '#3b82f6', dark: '#1d4ed8', variant: 'bayrak' },
  'creative-agent':       { label: 'Creative',   body: '#ec4899', dark: '#be185d', variant: 'ampul' },
  'growth-agent':         { label: 'Marketing',  body: '#10b981', dark: '#047857', variant: 'hedef' },
  'client-success-agent': { label: 'C.Success',  body: '#06b6d4', dark: '#0e7490', variant: 'goz' },
  'operations-agent':     { label: 'Operations', body: '#f59e0b', dark: '#b45309', variant: 'buyutec' },
  // legacy ajanlar (Common Area'da otururlar)
  'ingilizce-genel-plan': { label: 'İng Plan',   body: '#06b6d4', dark: '#0e7490', variant: 'bayrak' },
  'ingilizce-planlayici': { label: 'Planlayıcı', body: '#3b82f6', dark: '#1d4ed8', variant: 'kitap' },
  'kesif-arastirmaci':    { label: 'Keşif',      body: '#10b981', dark: '#047857', variant: 'buyutec' },
  'burs-toplu-arastirma': { label: 'Burs Toplu', body: '#a855f7', dark: '#7e22ce', variant: 'kep' },
  'burs-derinlestir':     { label: 'Burs Derin', body: '#8b5cf6', dark: '#6d28d9', variant: 'hedef' },
  'essay-brainstorm':     { label: 'Brainstorm', body: '#ec4899', dark: '#be185d', variant: 'ampul' },
  'essay-critic':         { label: 'Critic',     body: '#ef4444', dark: '#b91c1c', variant: 'goz' },
}

export const FALLBACK_AVATAR_VISUAL = {
  body: '#94a3b8',
  dark: '#64748b',
  variant: 'rozet' as AvatarVariant,
}

function starPoints(cx: number, cy: number, rOut: number, rIn: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOut : rIn
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`)
  }
  return pts.join(' ')
}

/** Rozet içi rol glyph'i — (cx, cy) merkezli, ~0.26 birim yarıçapa sığar. */
function Motif({ variant, cx, cy, color }: {
  variant: AvatarVariant; cx: number; cy: number; color: string
}) {
  switch (variant) {
    case 'bayrak': // direk + flama: yol haritasındaki durak işareti
      return (
        <g>
          <line x1={cx - 0.14} y1={cy - 0.22} x2={cx - 0.14} y2={cy + 0.24} stroke={color} strokeWidth={0.06} strokeLinecap="round" />
          <path d={`M ${cx - 0.14} ${cy - 0.22} L ${cx + 0.24} ${cy - 0.09} L ${cx - 0.14} ${cy + 0.04} Z`} fill={color} />
        </g>
      )
    case 'kitap': // açık kitap: sol/sağ sayfa
      return (
        <g>
          <path d={`M ${cx} ${cy - 0.04} L ${cx - 0.26} ${cy - 0.16} L ${cx - 0.26} ${cy + 0.12} L ${cx} ${cy + 0.22} Z`} fill={color} />
          <path d={`M ${cx} ${cy - 0.04} L ${cx + 0.26} ${cy - 0.16} L ${cx + 0.26} ${cy + 0.12} L ${cx} ${cy + 0.22} Z`} fill={color} opacity={0.7} />
        </g>
      )
    case 'buyutec': // büyüteç: mercek + sap
      return (
        <g>
          <circle cx={cx - 0.06} cy={cy - 0.06} r={0.15} fill="none" stroke={color} strokeWidth={0.07} />
          <line x1={cx + 0.06} y1={cy + 0.06} x2={cx + 0.21} y2={cy + 0.21} stroke={color} strokeWidth={0.09} strokeLinecap="round" />
        </g>
      )
    case 'kep': // mezuniyet kepi: tabla + kasnak + püskül
      return (
        <g>
          <path d={`M ${cx} ${cy - 0.2} L ${cx + 0.26} ${cy - 0.06} L ${cx} ${cy + 0.08} L ${cx - 0.26} ${cy - 0.06} Z`} fill={color} />
          <path d={`M ${cx - 0.11} ${cy + 0.02} L ${cx - 0.11} ${cy + 0.14} Q ${cx} ${cy + 0.22} ${cx + 0.11} ${cy + 0.14} L ${cx + 0.11} ${cy + 0.02}`} fill={color} opacity={0.75} />
          <line x1={cx + 0.26} y1={cy - 0.06} x2={cx + 0.26} y2={cy + 0.14} stroke={color} strokeWidth={0.045} />
          <circle cx={cx + 0.26} cy={cy + 0.17} r={0.04} fill={color} />
        </g>
      )
    case 'hedef': // nişan halkaları: tek okula odaklanma
      return (
        <g>
          <circle cx={cx} cy={cy} r={0.21} fill="none" stroke={color} strokeWidth={0.055} />
          <circle cx={cx} cy={cy} r={0.115} fill="none" stroke={color} strokeWidth={0.055} />
          <circle cx={cx} cy={cy} r={0.04} fill={color} />
        </g>
      )
    case 'ampul': // ampul: cam + duy + tepe ışını
      return (
        <g>
          <circle cx={cx} cy={cy - 0.04} r={0.14} fill="none" stroke={color} strokeWidth={0.06} />
          <rect x={cx - 0.06} y={cy + 0.11} width={0.12} height={0.09} rx={0.03} fill={color} />
          <line x1={cx} y1={cy - 0.28} x2={cx} y2={cy - 0.22} stroke={color} strokeWidth={0.05} strokeLinecap="round" />
          <line x1={cx - 0.17} y1={cy - 0.19} x2={cx - 0.13} y2={cy - 0.15} stroke={color} strokeWidth={0.05} strokeLinecap="round" />
          <line x1={cx + 0.17} y1={cy - 0.19} x2={cx + 0.13} y2={cy - 0.15} stroke={color} strokeWidth={0.05} strokeLinecap="round" />
        </g>
      )
    case 'goz': // göz: badem kontur + iris
      return (
        <g>
          <path
            d={`M ${cx - 0.24} ${cy} Q ${cx} ${cy - 0.19} ${cx + 0.24} ${cy} Q ${cx} ${cy + 0.19} ${cx - 0.24} ${cy} Z`}
            fill="none" stroke={color} strokeWidth={0.055}
          />
          <circle cx={cx} cy={cy} r={0.07} fill={color} />
        </g>
      )
    case 'yildiz': // komutan yıldızı
      return <polygon points={starPoints(cx, cy, 0.2, 0.085)} fill={color} />
    case 'rozet': // bilinmeyen ajan: boş rozet
      return null
  }
}

export interface AgentAvatarProps {
  x: number
  y: number
  name: string
  variant: AvatarVariant
  body: string
  dark: string
  status?: AgentStatus
  labelSize?: number
}

/** Eski Avatar ile aynı ayak izi (~1.6 × 2.1 tile + alt etiket):
 *  gölge y+2.12, isim y+2.75 — çağrı noktaları koordinat değiştirmeden geçer. */
export default function AgentAvatar({
  x, y, name, variant, body, dark, status = 'idle', labelSize = 0.72,
}: AgentAvatarProps) {
  return (
    <g>
      {status === 'running' && (
        <circle
          className="maxai-work-pulse"
          cx={x + 0.8} cy={y + 1.05} r={1.5}
          fill="none" stroke="#fbbf24" strokeWidth={0.14}
        />
      )}
      <ellipse cx={x + 0.8} cy={y + 2.12} rx={0.75} ry={0.16} fill="#0f172a" opacity={0.14} />
      <g className="maxai-bob">
        {/* gövde: yumuşak dikdörtgen + açık göğüs paneli */}
        <rect x={x + 0.22} y={y + 0.9} width={1.16} height={1.1} rx={0.34} fill={body} stroke={dark} strokeWidth={0.08} />
        <rect x={x + 0.52} y={y + 1.14} width={0.56} height={0.36} rx={0.12} fill="#ffffff" opacity={0.38} />
        {/* kafa: daire + iki nokta göz */}
        <circle cx={x + 0.8} cy={y + 0.42} r={0.5} fill={body} stroke={dark} strokeWidth={0.08} />
        <circle cx={x + 0.62} cy={y + 0.4} r={0.085} fill="#0f172a" />
        <circle cx={x + 0.98} cy={y + 0.4} r={0.085} fill="#0f172a" />
        {/* rol rozeti: kafanın sağ üstünde beyaz madalyon + glyph */}
        <circle cx={x + 1.42} cy={y + 0.02} r={0.4} fill="#ffffff" stroke={dark} strokeWidth={0.07} />
        <Motif variant={variant} cx={x + 1.42} cy={y + 0.02} color={dark} />
      </g>
      <text
        x={x + 0.8} y={y + 2.75} textAnchor="middle"
        fontSize={labelSize} fontWeight={700} letterSpacing="0.06em"
        fill="#334155" stroke="#ffffff" strokeWidth={0.16}
        style={{ paintOrder: 'stroke', textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}
      >
        {name}
      </text>
    </g>
  )
}
