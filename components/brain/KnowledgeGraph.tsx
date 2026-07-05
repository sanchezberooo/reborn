'use client'

// Brain bilgi grafiği — SVG çizimi (v0 portu, nötr dil). Görselleştirme
// mantığı DEĞİŞMEDİ; veri kaynağı artık statik mock import değil, gerçek
// entities/links'ten türetilmiş props (bkz. lib/brain-layout.ts buildBrainView,
// app/brain/page.tsx).

import { useMemo, useState } from 'react'
import type { Note } from '@/lib/brain-data'

const sizeRadius: Record<Note['size'], number> = {
  hub: 13,
  mid: 8,
  leaf: 5.5,
}

export default function KnowledgeGraph({
  notes,
  edges,
  noteById,
  activeId,
  onSelect,
}: {
  notes: Note[]
  edges: { source: string; target: string }[]
  noteById: Record<string, Note>
  activeId: string | null
  onSelect: (note: Note) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const focus = hovered ?? activeId

  const connectedIds = useMemo(() => {
    if (!focus) return null
    const node = noteById[focus]
    if (!node) return null
    return new Set<string>([focus, ...node.links])
  }, [focus])

  return (
    <svg
      viewBox="0 0 1000 680"
      className="h-full w-full"
      role="img"
      aria-label="Bağlantılı notların bilgi grafiği"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="graphGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="var(--ring)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--ring)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="1000" height="680" fill="url(#graphGlow)" />

      {edges.map((e, i) => {
        const a = noteById[e.source]
        const b = noteById[e.target]
        if (!a || !b) return null
        const active =
          connectedIds && connectedIds.has(e.source) && connectedIds.has(e.target)
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={active ? 'var(--ring)' : 'var(--border)'}
            strokeWidth={active ? 1.5 : 0.9}
            strokeOpacity={connectedIds ? (active ? 0.7 : 0.1) : 0.4}
            className="transition-all duration-300"
          />
        )
      })}

      {notes.map((n) => {
        const dim = connectedIds ? !connectedIds.has(n.id) : false
        const isFocus = focus === n.id
        const r = sizeRadius[n.size]
        return (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            className="cursor-pointer transition-opacity duration-300"
            style={{ opacity: dim ? 0.2 : 1 }}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(n)}
          >
            {isFocus && <circle r={r + 9} fill="var(--ring)" opacity={0.14} />}
            <circle
              r={r}
              fill={n.size === 'hub' ? 'var(--primary)' : 'var(--card)'}
              fillOpacity={n.size === 'hub' ? (isFocus ? 1 : 0.9) : 1}
              stroke={n.size === 'hub' ? 'var(--background)' : 'var(--ring)'}
              strokeWidth={1.5}
              strokeOpacity={n.size === 'hub' ? 1 : 0.7}
            />
            <text
              x={0}
              y={r + 14}
              textAnchor="middle"
              className="pointer-events-none select-none"
              fill="var(--foreground)"
              fontSize={n.size === 'hub' ? 13 : 11}
              fontWeight={n.size === 'hub' ? 500 : 400}
              fillOpacity={dim ? 0.3 : 0.75}
            >
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
