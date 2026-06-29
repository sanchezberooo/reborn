'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { dbLoadModules, dbExecuteAction } from '@/lib/db'

// ─── types ────────────────────────────────────────────────────────────────────

export type Level = 'A1' | 'A2' | 'B1' | 'B2'

export interface TopicItem {
  id: string
  title: string
  body?: React.ReactNode
  href?: string
}

export interface LevelContent {
  A1: TopicItem[]
  A2: TopicItem[]
  B1: TopicItem[]
}

interface Props {
  moduleKey: string
  content: LevelContent
}

// ─── completion hook ──────────────────────────────────────────────────────────

function useCompletion(moduleKey: string) {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    dbLoadModules().then((mods) => {
      const eng = mods.find((m) => m.id === 'english')
      if (eng) {
        const raw = (eng.data?.completed_topics as string[] | undefined) ?? []
        setCompleted(new Set(raw.filter((k: string) => k.startsWith(moduleKey + '_'))))
      }
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [moduleKey])

  const toggle = useCallback((key: string) => {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      dbLoadModules().then((mods) => {
        const eng = mods.find((m) => m.id === 'english')
        const existing = (eng?.data?.completed_topics as string[] | undefined) ?? []
        const others = existing.filter((k: string) => !k.startsWith(moduleKey + '_'))
        dbExecuteAction({
          type: 'UPDATE_MODULE',
          payload: { id: 'english', patch: { completed_topics: [...others, ...Array.from(next)] } },
        }).catch(() => {})
      }).catch(() => {})
      return next
    })
  }, [moduleKey])

  return { completed, toggle, loaded }
}

// ─── level badge ──────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  A1: '#22c55e',
  A2: '#3b82f6',
  B1: '#c8a96e',
  B2: '#8b5cf6',
}

function LevelBadge({ level }: { level: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: LEVEL_COLORS[level] ?? '#a0a0a0',
        background: (LEVEL_COLORS[level] ?? '#a0a0a0') + '20',
        border: `1px solid ${(LEVEL_COLORS[level] ?? '#a0a0a0')}40`,
        borderRadius: 4,
        padding: '2px 5px',
        letterSpacing: '0.05em',
      }}
    >
      {level}
    </span>
  )
}

// ─── topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic, level, fullKey, completed, onToggle,
}: {
  topic: TopicItem
  level: string
  fullKey: string
  completed: boolean
  onToggle: (key: string) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const isLink = Boolean(topic.href)

  function handleHeaderClick() {
    if (isLink && topic.href) {
      router.push(topic.href)
    } else {
      setOpen((o) => !o)
    }
  }

  return (
    <div
      style={{
        background: '#111111',
        border: `1px solid ${completed ? '#22c55e30' : '#222222'}`,
        borderRadius: 12,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={handleHeaderClick}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(fullKey) }}
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: `1.5px solid ${completed ? '#22c55e' : '#333'}`,
            background: completed ? '#22c55e' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {completed && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4l3 3 6-6" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <LevelBadge level={level} />

        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#ffffff' }}>
          {topic.title}
        </span>

        {/* Chevron: rotates for accordion, static arrow for link */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#555"
          strokeWidth="2"
          style={{
            transform: isLink ? 'none' : open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* Accordion body — only for non-link topics */}
      {!isLink && open && topic.body && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #1e1e1e' }}>
          <div style={{ paddingTop: 12 }}>
            {topic.body}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── level tabs layout ────────────────────────────────────────────────────────

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2']

export function LevelTabsLayout({ moduleKey, content }: Props) {
  const [activeLevel, setActiveLevel] = useState<Level>('A1')
  const { completed, toggle } = useCompletion(moduleKey)

  const topics = activeLevel === 'B2' ? [] : content[activeLevel]
  const total = activeLevel === 'B2' ? 0 : topics.length
  const done = activeLevel === 'B2' ? 0 : topics.filter((t) => completed.has(`${moduleKey}_${activeLevel}_${t.id}`)).length

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {LEVELS.map((lv) => {
          const isLocked = lv === 'B2'
          const isActive = activeLevel === lv
          return (
            <button
              key={lv}
              onClick={() => setActiveLevel(lv)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: isLocked ? 'default' : 'pointer',
                border: `1px solid ${isActive ? LEVEL_COLORS[lv] : '#222222'}`,
                background: isActive ? LEVEL_COLORS[lv] + '20' : 'transparent',
                color: isLocked ? '#333' : isActive ? LEVEL_COLORS[lv] : '#a0a0a0',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
              }}
            >
              {isLocked && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {lv}
              {isLocked && <span style={{ fontSize: 9, color: '#444' }}>Haziran</span>}
            </button>
          )
        })}

        {/* Progress */}
        {activeLevel !== 'B2' && total > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, height: 4, background: '#1e1e1e', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(done / total) * 100}%`,
                  background: LEVEL_COLORS[activeLevel],
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: '#a0a0a0' }}>{done}/{total}</span>
          </div>
        )}
      </div>

      {/* Locked B2 */}
      {activeLevel === 'B2' && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            border: '1px dashed #222222',
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <p style={{ color: '#ffffff', fontWeight: 600, marginBottom: 6 }}>B2 Seviyesi Kilitli</p>
          <p style={{ color: '#a0a0a0', fontSize: 13 }}>Haziran 2026'da açılıyor.</p>
          <p style={{ color: '#555', fontSize: 12, marginTop: 6 }}>Önce A1, A2 ve B1 konularını tamamla.</p>
        </div>
      )}

      {/* Topics */}
      {activeLevel !== 'B2' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topics.map((topic) => {
            const fullKey = `${moduleKey}_${activeLevel}_${topic.id}`
            return (
              <TopicCard
                key={topic.id}
                topic={topic}
                level={activeLevel}
                fullKey={fullKey}
                completed={completed.has(fullKey)}
                onToggle={toggle}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// ─── rich word list ───────────────────────────────────────────────────────────

export interface RichWord {
  en: string
  tr: string
  example?: string
  irregular?: string
}

export function RichWordList({ words }: { words: RichWord[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {words.map((w) => (
        <div
          key={w.en}
          style={{
            padding: '8px 12px',
            background: '#0d0d0d',
            border: '1px solid #1e1e1e',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 600 }}>{w.en}</span>
            <span style={{ color: '#a0a0a0', fontSize: 12 }}>— {w.tr}</span>
            {w.irregular && (
              <span style={{ color: '#c8a96e', fontSize: 10, marginLeft: 'auto', fontFamily: 'monospace' }}>
                {w.irregular}
              </span>
            )}
          </div>
          {w.example && (
            <p style={{ color: '#666', fontSize: 11, lineHeight: 1.5, fontStyle: 'italic', marginTop: 3 }}>
              {w.example}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── full grammar box ─────────────────────────────────────────────────────────

export function FullGrammarBox({
  descTR, formula, examples, exercises, errors,
}: {
  descTR: string
  formula: string
  examples: string[]
  exercises?: string[]
  errors?: { wrong: string; correct: string }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'rgba(200,169,110,0.06)', border: '1px solid rgba(200,169,110,0.2)', borderRadius: 8, padding: '9px 12px' }}>
        <p style={{ fontSize: 10, color: '#c8a96e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Türkçe Açıklama</p>
        <p style={{ color: '#d0d0d0', fontSize: 13, lineHeight: 1.6 }}>{descTR}</p>
      </div>
      <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '8px 12px' }}>
        <p style={{ fontSize: 10, color: '#a0a0a0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formül</p>
        <p style={{ color: '#c8a96e', fontSize: 13, fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{formula}</p>
      </div>
      <div>
        <p style={{ fontSize: 10, color: '#a0a0a0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Örnekler</p>
        {examples.map((ex, i) => (
          <p key={i} style={{ color: '#ffffff', fontSize: 13, lineHeight: 1.7, marginBottom: 3 }}>
            <span style={{ color: '#555', marginRight: 6 }}>›</span>{ex}
          </p>
        ))}
      </div>
      {exercises && exercises.length > 0 && (
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 12px' }}>
          <p style={{ fontSize: 10, color: '#3b82f6', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Pratik Yap</p>
          {exercises.map((ex, i) => (
            <p key={i} style={{ color: '#d0d0d0', fontSize: 13, lineHeight: 1.7, marginBottom: 3 }}>
              <span style={{ color: '#3b82f6', marginRight: 6, fontWeight: 700 }}>{i + 1}.</span>{ex}
            </p>
          ))}
        </div>
      )}
      {errors && errors.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px' }}>
          <p style={{ fontSize: 10, color: '#ef4444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Yaygın Hatalar</p>
          {errors.map((err, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ color: '#ef4444', fontSize: 12, textDecoration: 'line-through' }}>{err.wrong}</span>
              <span style={{ color: '#444' }}>→</span>
              <span style={{ color: '#22c55e', fontSize: 12 }}>{err.correct}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── word list (simple) ───────────────────────────────────────────────────────

export function WordList({ words }: { words: { en: string; tr: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {words.map((w) => (
        <div
          key={w.en}
          style={{
            padding: '4px 10px',
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ color: '#ffffff', fontSize: 12, fontWeight: 500 }}>{w.en}</span>
          <span style={{ color: '#555', fontSize: 10 }}>·</span>
          <span style={{ color: '#a0a0a0', fontSize: 11 }}>{w.tr}</span>
        </div>
      ))}
    </div>
  )
}

export function GrammarBox({ formula, examples, tip }: { formula: string; examples: string[]; tip?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '8px 12px' }}>
        <p style={{ fontSize: 10, color: '#a0a0a0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formül</p>
        <p style={{ color: '#c8a96e', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{formula}</p>
      </div>
      <div>
        <p style={{ fontSize: 10, color: '#a0a0a0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Örnekler</p>
        {examples.map((ex, i) => (
          <p key={i} style={{ color: '#ffffff', fontSize: 13, lineHeight: 1.6, marginBottom: 2 }}>
            <span style={{ color: '#555', marginRight: 6 }}>›</span>{ex}
          </p>
        ))}
      </div>
      {tip && (
        <div style={{ background: 'rgba(200,169,110,0.06)', border: '1px solid rgba(200,169,110,0.15)', borderRadius: 8, padding: '7px 10px' }}>
          <p style={{ color: '#a0a0a0', fontSize: 12, lineHeight: 1.5 }}>
            <span style={{ color: '#c8a96e' }}>💡 </span>{tip}
          </p>
        </div>
      )}
    </div>
  )
}

export function ReadingCard({ text, questions }: { text: string; questions: string[] }) {
  const [showQ, setShowQ] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '12px 14px', lineHeight: 1.7 }}>
        <p style={{ color: '#d0d0d0', fontSize: 13 }}>{text}</p>
      </div>
      <button
        onClick={() => setShowQ((v) => !v)}
        style={{
          alignSelf: 'flex-start',
          padding: '5px 12px',
          background: 'transparent',
          border: '1px solid #333',
          borderRadius: 6,
          color: '#a0a0a0',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        {showQ ? 'Soruları Gizle' : 'Anlama Sorularını Gör'}
      </button>
      {showQ && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {questions.map((q, i) => (
            <div key={i} style={{ padding: '8px 12px', background: '#0d0d0d', borderRadius: 8, border: '1px solid #1e1e1e' }}>
              <p style={{ color: '#ffffff', fontSize: 12, lineHeight: 1.5 }}>
                <span style={{ color: '#c8a96e', fontWeight: 700, marginRight: 6 }}>{i + 1}.</span>{q}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function WritingCard({ template, blanks, example }: { template: string; blanks?: string[]; example?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ fontSize: 10, color: '#a0a0a0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yapı / Şablon</p>
        <p style={{ color: '#c8a96e', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{template}</p>
      </div>
      {blanks && blanks.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: '#a0a0a0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Boşlukları Doldur</p>
          {blanks.map((b, i) => (
            <p key={i} style={{ color: '#d0d0d0', fontSize: 13, lineHeight: 1.8 }}>
              <span style={{ color: '#555', marginRight: 6 }}>›</span>{b}
            </p>
          ))}
        </div>
      )}
      {example && (
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, padding: '8px 12px' }}>
          <p style={{ fontSize: 10, color: '#3b82f6', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Örnek</p>
          <p style={{ color: '#d0d0d0', fontSize: 12, lineHeight: 1.6 }}>{example}</p>
        </div>
      )}
    </div>
  )
}
