'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { dbLoadModules } from '@/lib/db'
import {
  GRAMMAR_FALLBACK,
  GRAMMAR_TOPIC_META,
  type GrammarTopicContent,
} from '../../lib/grammar-data'

// ─── level badge ──────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  A1: '#22c55e', A2: '#3b82f6', B1: '#c8a96e', B2: '#8b5cf6',
}

function LevelBadge({ level }: { level: string }) {
  const c = LEVEL_COLORS[level] ?? '#a0a0a0'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
      color: c, background: c + '22', border: `1px solid ${c}44`,
      borderRadius: 5, padding: '2px 7px',
    }}>
      {level}
    </span>
  )
}

// ─── zone card ────────────────────────────────────────────────────────────────

function Zone({
  label, labelColor, bg, border, children,
}: {
  label: string
  labelColor: string
  bg: string
  border: string
  children: React.ReactNode
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: labelColor, margin: 0 }}>
        {label}
      </p>
      {children}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function GramerLessonPage() {
  const { topic } = useParams<{ topic: string }>()
  const [content, setContent] = useState<GrammarTopicContent | null>(null)
  const [loading, setLoading] = useState(true)

  const meta  = GRAMMAR_TOPIC_META[topic]
  const label = meta?.label ?? topic.replace(/-/g, ' ')
  const level = meta?.level ?? '—'

  useEffect(() => {
    dbLoadModules()
      .then((mods) => {
        const eng = mods.find((m) => m.id === 'english')
        const gc  = (eng?.data?.grammarContent ?? {}) as Record<string, GrammarTopicContent>
        setContent(gc[topic] ?? GRAMMAR_FALLBACK[topic] ?? {})
      })
      .catch(() => setContent(GRAMMAR_FALLBACK[topic] ?? {}))
      .finally(() => setLoading(false))
  }, [topic])

  // ── loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0F14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map((i) => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: '50%', background: '#c8a96e',
              animation: 'bounce 0.9s infinite', animationDelay: `${i * 120}ms`,
            }} />
          ))}
        </div>
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const hasKural    = Boolean(content?.kural)
  const hasOrnekler = (content?.ornekler?.length ?? 0) > 0
  const hasHatalar  = (content?.hatalar?.length ?? 0) > 0
  const hasKaliplar = (content?.kaliplar?.length ?? 0) > 0

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F14' }}>

      {/* ── sticky header ────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: '#0B0F14', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 28px',
      }}>
        <Link
          href="/ingilizce"
          style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#c8a96e', textDecoration: 'none' }}
        >
          ← Gramer&apos;e dön
        </Link>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <LevelBadge level={level} />
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: 0, lineHeight: 1.2 }}>
          {label}
        </h1>
      </div>

      {/* ── study board ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* top row: 2 columns */}
        <div className="gramer-grid">

          {/* LEFT: Konu Anlatımı */}
          {hasKural ? (
            <Zone
              label="Konu Anlatımı"
              labelColor="#c8a96e"
              bg="rgba(200,169,110,0.05)"
              border="rgba(200,169,110,0.25)"
            >
              <p style={{ color: '#d0d0d0', fontSize: 14, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
                {content!.kural}
              </p>
            </Zone>
          ) : (
            <Zone label="Konu Anlatımı" labelColor="#c8a96e" bg="rgba(200,169,110,0.03)" border="rgba(200,169,110,0.12)">
              <p style={{ color: '#3a3a3a', fontSize: 13, fontStyle: 'italic', margin: 0 }}>İçerik yakında eklenecek.</p>
            </Zone>
          )}

          {/* RIGHT: Doğru Örnekler */}
          {hasOrnekler ? (
            <Zone
              label="Doğru Örnekler"
              labelColor="#22c55e"
              bg="rgba(34,197,94,0.04)"
              border="rgba(34,197,94,0.2)"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {content!.ornekler!.map((ex, i) => (
                  <div key={i} style={{ padding: '9px 12px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 9 }}>
                    <p style={{ color: '#ffffff', fontSize: 13, fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{ex.en}</p>
                    {ex.tr && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '3px 0 0', fontStyle: 'italic' }}>{ex.tr}</p>}
                  </div>
                ))}
              </div>
            </Zone>
          ) : (
            <Zone label="Doğru Örnekler" labelColor="#22c55e" bg="rgba(34,197,94,0.03)" border="rgba(34,197,94,0.1)">
              <p style={{ color: '#3a3a3a', fontSize: 13, fontStyle: 'italic', margin: 0 }}>Henüz örnek eklenmedi.</p>
            </Zone>
          )}

        </div>

        {/* bottom: full-width zones */}

        {/* Sık Yapılan Hatalar */}
        {hasHatalar && (
          <Zone
            label="Sık Yapılan Hatalar"
            labelColor="#ef4444"
            bg="rgba(239,68,68,0.04)"
            border="rgba(239,68,68,0.18)"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {content!.hatalar!.map((err, i) => (
                <div key={i} style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <span style={{ color: '#ef4444', fontSize: 13, textDecoration: 'line-through', fontStyle: 'italic' }}>
                      ✗ {err.yanlis}
                    </span>
                    <span style={{ color: '#2a2a2a' }}>→</span>
                    <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 500 }}>
                      ✓ {err.dogru}
                    </span>
                  </div>
                  {err.neden && (
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '5px 0 0', lineHeight: 1.5 }}>
                      {err.neden}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Zone>
        )}

        {/* Kalıplar / Structures (optional) */}
        {hasKaliplar && (
          <Zone
            label="Kalıplar / Structures"
            labelColor="#3b82f6"
            bg="rgba(59,130,246,0.04)"
            border="rgba(59,130,246,0.18)"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {content!.kaliplar!.map((k, i) => (
                <div key={i} style={{ padding: '8px 12px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)', borderRadius: 8 }}>
                  <p style={{ color: '#c8a96e', fontSize: 13, fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap' }}>{k}</p>
                </div>
              ))}
            </div>
          </Zone>
        )}

      </div>

      {/* responsive grid + bounce animation */}
      <style>{`
        .gramer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 700px) {
          .gramer-grid { grid-template-columns: 1fr; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
