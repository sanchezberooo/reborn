export type AvatarColorScheme = 'sanchez' | 'knowledge' | 'marketing'

// 12x16 birimlik pixel-grid üzerinde çizilmiş basit insan silüeti: kafa
// (üst kare), gövde (orta dikdörtgen), kollar ve bacaklar (yan/alt ince
// dikdörtgenler). Tamamen <rect> tabanlı, dış asset yok. shape-rendering
// "crispEdges" + küçük viewBox + CSS ile büyütme sayesinde piksel netliği
// korunur (bulanıklaşma olmaz).
const PALETTES: Record<AvatarColorScheme, { head: string; body: string; limb: string; outline: string }> = {
  sanchez: { head: '#fcd34d', body: '#f59e0b', limb: '#d97706', outline: '#78350f' },
  knowledge: { head: '#67e8f9', body: '#0891b2', limb: '#0e7490', outline: '#164e63' },
  marketing: { head: '#f9a8d4', body: '#ec4899', limb: '#db2777', outline: '#831843' },
}

interface PixelAvatarProps {
  colorScheme: AvatarColorScheme
  name: string
}

export default function PixelAvatar({ colorScheme, name }: PixelAvatarProps) {
  const palette = PALETTES[colorScheme]

  return (
    <div className="pointer-events-none z-10 flex flex-col items-center gap-1">
      <style>{`
        @keyframes maxaiAvatarBob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        .maxai-avatar-bob {
          animation: maxaiAvatarBob 2s ease-in-out infinite;
        }
      `}</style>
      <svg
        viewBox="0 0 12 16"
        width={32}
        height={48}
        shapeRendering="crispEdges"
        className="maxai-avatar-bob"
        role="img"
        aria-label={name}
      >
        {/* kafa */}
        <rect x={4} y={1} width={4} height={4} fill={palette.head} stroke={palette.outline} strokeWidth={0.2} />
        {/* gövde */}
        <rect x={3} y={5} width={6} height={6} fill={palette.body} stroke={palette.outline} strokeWidth={0.2} />
        {/* kollar */}
        <rect x={2} y={5} width={1} height={5} fill={palette.limb} />
        <rect x={9} y={5} width={1} height={5} fill={palette.limb} />
        {/* bacaklar */}
        <rect x={4} y={11} width={2} height={4} fill={palette.limb} stroke={palette.outline} strokeWidth={0.2} />
        <rect x={7} y={11} width={2} height={4} fill={palette.limb} stroke={palette.outline} strokeWidth={0.2} />
      </svg>
      <span className="text-2xs font-medium uppercase tracking-wide text-white/70">{name}</span>
    </div>
  )
}
