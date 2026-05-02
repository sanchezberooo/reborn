'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { dbLoadModules } from '@/lib/db'
import type { ModuleItem, ActionType } from '@/lib/modules'

// ─── types ────────────────────────────────────────────────────────────────────

type Word = {
  word: string
  meaning_tr: string
  example?: string
  pronunciation?: string
  topic?: string
  status: 'new' | 'learning' | 'learned'
}

type Pattern = {
  pattern: string
  meaning_tr: string
  examples?: string[]
}

type WritingEntry = {
  date: string
  type: 'daily' | 'task1' | 'task2'
  topic: string
  text?: string
  correction?: string
  score?: string
}

type Tab = 'words' | 'output'

const TODAY = new Date().toISOString().slice(0, 10)

const STATUS = {
  new:      { label: 'Yeni',        cls: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  learning: { label: 'Öğreniliyor', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  learned:  { label: 'Öğrenildi',   cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
} as const

const TYPE_LABEL = { daily: 'Günlük', task1: 'Task 1', task2: 'Task 2' } as const

// ─── root ─────────────────────────────────────────────────────────────────────

export default function EnglishModule({ moduleId }: { moduleId: string }) {
  const router = useRouter()
  const [mod, setMod] = useState<ModuleItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('words')

  async function reload() {
    try {
      const mods = await dbLoadModules()
      setMod(mods.find((m) => m.id === moduleId) ?? null)
    } catch {
      // keep previous
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    window.addEventListener('reborn:modules-updated', reload)
    return () => window.removeEventListener('reborn:modules-updated', reload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId])

  async function act(action: ActionType) {
    await fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: [action] }),
    }).catch(() => {})
    window.dispatchEvent(new CustomEvent('reborn:modules-updated'))
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-5 h-5 rounded-full bg-gold animate-pulse" />
      </div>
    )
  }

  if (!mod) {
    return (
      <div className="flex h-full items-center justify-center text-muted text-sm">
        Modül bulunamadı.{' '}
        <button onClick={() => router.back()} className="text-gold underline ml-1">Geri dön</button>
      </div>
    )
  }

  const words    = (mod.data.words            as Word[])         ?? []
  const patterns = (mod.data.sentence_patterns as Pattern[])     ?? []
  const archive  = (mod.data.writing_archive  as WritingEntry[]) ?? []
  const learned  = words.filter((w) => w.status === 'learned').length

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border">
        <div className="px-6 pt-5 pb-0 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5">
            <span className="text-xl">{mod.icon}</span>
            <h1 className="font-display text-base font-semibold text-foreground">{mod.name}</h1>
          </div>

          <div className="ml-auto flex items-center gap-6">
            <Stat label="Öğrenilen" value={`${learned}/${words.length}`} />
            <Stat label="Kalıp"     value={String(patterns.length)} />
            <Stat label="Hedef"     value={(mod.data.ielts_target as string) ?? '—'} gold />
          </div>
        </div>

        <div className="flex px-6 mt-4 gap-0">
          {([
            { id: 'words',  label: '📚  Kelimeler & Kalıplar' },
            { id: 'output', label: '✍️  Output' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-gold text-gold'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'words'  && <WordsTab  words={words} patterns={patterns} moduleId={moduleId} act={act} />}
        {tab === 'output' && <OutputTab archive={archive} moduleId={moduleId} act={act} />}
      </div>
    </div>
  )
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold ${gold ? 'text-gold' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}

// ─── Tab: Kelimeler & Kalıplar ────────────────────────────────────────────────

function WordsTab({ words, patterns, moduleId, act }: {
  words: Word[]
  patterns: Pattern[]
  moduleId: string
  act: (a: ActionType) => Promise<void>
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | Word['status']>('all')
  const [showAddWord, setShowAddWord] = useState(false)
  const [showAddPattern, setShowAddPattern] = useState(false)
  const [wf, setWf] = useState({ word: '', meaning_tr: '', example: '', status: 'new' as Word['status'] })
  const [pf, setPf] = useState({ pattern: '', meaning_tr: '', ex1: '', ex2: '' })
  const [saving, setSaving] = useState(false)

  const filtered = statusFilter === 'all' ? words : words.filter((w) => w.status === statusFilter)
  const counts = {
    new:      words.filter((w) => w.status === 'new').length,
    learning: words.filter((w) => w.status === 'learning').length,
    learned:  words.filter((w) => w.status === 'learned').length,
  }

  async function cycleStatus(realIndex: number) {
    const cycle = { new: 'learning', learning: 'learned', learned: 'new' } as const
    const updated = words.map((w, i) =>
      i === realIndex ? { ...w, status: cycle[w.status] } : w
    )
    await act({ type: 'UPDATE_MODULE', payload: { id: moduleId, patch: { words: updated } } })
  }

  async function removeWord(realIndex: number) {
    await act({ type: 'UPDATE_MODULE', payload: { id: moduleId, patch: { words: words.filter((_, i) => i !== realIndex) } } })
  }

  async function addWord() {
    if (!wf.word.trim() || !wf.meaning_tr.trim() || saving) return
    setSaving(true)
    await act({
      type: 'APPEND_TO_FIELD',
      payload: {
        id: moduleId, field: 'words',
        item: {
          word: wf.word.trim(), meaning_tr: wf.meaning_tr.trim(), status: wf.status,
          ...(wf.example.trim() ? { example: wf.example.trim() } : {}),
        },
      },
    })
    setWf({ word: '', meaning_tr: '', example: '', status: 'new' })
    setShowAddWord(false)
    setSaving(false)
  }

  async function removePattern(i: number) {
    await act({ type: 'UPDATE_MODULE', payload: { id: moduleId, patch: { sentence_patterns: patterns.filter((_, j) => j !== i) } } })
  }

  async function addPattern() {
    if (!pf.pattern.trim() || !pf.meaning_tr.trim() || saving) return
    setSaving(true)
    const examples = [pf.ex1, pf.ex2].map((e) => e.trim()).filter(Boolean)
    await act({
      type: 'APPEND_TO_FIELD',
      payload: {
        id: moduleId, field: 'sentence_patterns',
        item: { pattern: pf.pattern.trim(), meaning_tr: pf.meaning_tr.trim(), ...(examples.length ? { examples } : {}) },
      },
    })
    setPf({ pattern: '', meaning_tr: '', ex1: '', ex2: '' })
    setShowAddPattern(false)
    setSaving(false)
  }

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">

      {/* ── Kelimeler ── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">Kelimeler</h2>
            <span className="text-[10px] text-emerald-400">{counts.learned} öğrenildi</span>
            <span className="text-[10px] text-muted/40">·</span>
            <span className="text-[10px] text-amber-400">{counts.learning} öğreniliyor</span>
            <span className="text-[10px] text-muted/40">·</span>
            <span className="text-[10px] text-sky-400">{counts.new} yeni</span>
          </div>
          <button
            onClick={() => { setShowAddWord((v) => !v); setShowAddPattern(false) }}
            className="text-xs text-gold hover:opacity-70 transition-opacity"
          >
            + Kelime Ekle
          </button>
        </div>

        {/* Add word form */}
        {showAddWord && (
          <div className="mb-5 pb-5 border-b border-border flex flex-col gap-2">
            <div className="flex gap-2">
              <input autoFocus value={wf.word} onChange={(e) => setWf({ ...wf, word: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addWord()}
                placeholder="Word (e.g. perseverance)"
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/40 outline-none focus:border-gold transition-colors" />
              <input value={wf.meaning_tr} onChange={(e) => setWf({ ...wf, meaning_tr: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addWord()}
                placeholder="Türkçe anlam"
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/40 outline-none focus:border-gold transition-colors" />
            </div>
            <div className="flex gap-2">
              <input value={wf.example} onChange={(e) => setWf({ ...wf, example: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addWord()}
                placeholder="Örnek cümle (opsiyonel)"
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/40 outline-none focus:border-gold transition-colors" />
              <select value={wf.status} onChange={(e) => setWf({ ...wf, status: e.target.value as Word['status'] })}
                className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors">
                <option value="new">Yeni</option>
                <option value="learning">Öğreniliyor</option>
                <option value="learned">Öğrenildi</option>
              </select>
              <button onClick={addWord} disabled={!wf.word.trim() || !wf.meaning_tr.trim() || saving}
                className="px-4 py-2 bg-gold text-background text-sm font-medium rounded-xl disabled:opacity-30 hover:opacity-80 transition-opacity">
                {saving ? '…' : 'Ekle'}
              </button>
            </div>
          </div>
        )}

        {/* Status filter */}
        {words.length > 0 && (
          <div className="flex gap-1.5 mb-4">
            {(['all', 'new', 'learning', 'learned'] as const).map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                  statusFilter === f
                    ? 'border-gold/40 bg-gold/10 text-gold'
                    : 'border-transparent text-muted hover:text-foreground'
                }`}>
                {f === 'all' ? `Tümü (${words.length})` : `${STATUS[f].label} (${counts[f]})`}
              </button>
            ))}
          </div>
        )}

        {/* Word list */}
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {words.length === 0 ? '+ Kelime Ekle ile başla.' : 'Bu filtrede kelime yok.'}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((w) => {
              const ri = words.indexOf(w)
              const sc = STATUS[w.status]
              return (
                <div key={ri} className="group flex items-start gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-base font-semibold tracking-wide text-foreground uppercase">{w.word}</span>
                      {w.pronunciation && <span className="text-xs text-muted/60 lowercase font-normal">/{w.pronunciation}/</span>}
                    </div>
                    <p className="text-sm text-muted">{w.meaning_tr}</p>
                    {w.example && (
                      <p className="text-xs text-muted/50 italic mt-1 leading-relaxed">&ldquo;{w.example}&rdquo;</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <button onClick={() => cycleStatus(ri)}
                      className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition-colors ${sc.cls}`}>
                      {sc.label}
                    </button>
                    <button onClick={() => removeWord(ri)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-all">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Ayırıcı ── */}
      <div className="border-t border-border mb-8" />

      {/* ── Cümle Kalıpları ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Cümle Kalıpları</h2>
          <button
            onClick={() => { setShowAddPattern((v) => !v); setShowAddWord(false) }}
            className="text-xs text-gold hover:opacity-70 transition-opacity"
          >
            + Kalıp Ekle
          </button>
        </div>

        {/* Add pattern form */}
        {showAddPattern && (
          <div className="mb-5 pb-5 border-b border-border flex flex-col gap-2">
            <div className="flex gap-2">
              <input autoFocus value={pf.pattern} onChange={(e) => setPf({ ...pf, pattern: e.target.value })}
                placeholder="Pattern (e.g. However, ...)"
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/40 outline-none focus:border-gold transition-colors" />
              <input value={pf.meaning_tr} onChange={(e) => setPf({ ...pf, meaning_tr: e.target.value })}
                placeholder="Türkçe karşılık"
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/40 outline-none focus:border-gold transition-colors" />
            </div>
            <div className="flex gap-2">
              <input value={pf.ex1} onChange={(e) => setPf({ ...pf, ex1: e.target.value })}
                placeholder="Örnek cümle 1"
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/40 outline-none focus:border-gold transition-colors" />
              <input value={pf.ex2} onChange={(e) => setPf({ ...pf, ex2: e.target.value })}
                placeholder="Örnek cümle 2"
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/40 outline-none focus:border-gold transition-colors" />
            </div>
            <div className="flex justify-end">
              <button onClick={addPattern} disabled={!pf.pattern.trim() || !pf.meaning_tr.trim() || saving}
                className="px-4 py-2 bg-gold text-background text-sm font-medium rounded-xl disabled:opacity-30 hover:opacity-80 transition-opacity">
                {saving ? '…' : 'Ekle'}
              </button>
            </div>
          </div>
        )}

        {patterns.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">+ Kalıp Ekle ile başla.</p>
        ) : (
          <div className="divide-y divide-border">
            {patterns.map((p, i) => (
              <div key={i} className="group flex items-start gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-mono font-semibold text-gold">{p.pattern}</span>
                    <span className="text-muted/40 text-xs">→</span>
                    <span className="text-sm text-muted">{p.meaning_tr}</span>
                  </div>
                  {p.examples?.map((ex, ei) => (
                    <p key={ei} className="text-xs text-muted/50 italic mt-0.5 leading-relaxed">
                      &ldquo;{ex}&rdquo;
                    </p>
                  ))}
                </div>
                <button onClick={() => removePattern(i)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-all mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-20" />
    </div>
  )
}

// ─── Tab: Output ──────────────────────────────────────────────────────────────

function OutputTab({ archive, moduleId, act }: {
  archive: WritingEntry[]
  moduleId: string
  act: (a: ActionType) => Promise<void>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [form, setForm] = useState({ date: TODAY, type: 'task2' as WritingEntry['type'], topic: '', text: '' })
  const [saving, setSaving] = useState(false)

  async function addEntry() {
    if (!form.topic.trim() || saving) return
    setSaving(true)
    await act({
      type: 'APPEND_TO_FIELD',
      payload: {
        id: moduleId, field: 'writing_archive',
        item: {
          date: form.date, type: form.type, topic: form.topic.trim(),
          ...(form.text.trim() ? { text: form.text.trim() } : {}),
        },
      },
    })
    setForm({ date: TODAY, type: 'task2', topic: '', text: '' })
    setShowAdd(false)
    setSaving(false)
  }

  async function removeEntry(index: number) {
    await act({ type: 'UPDATE_MODULE', payload: { id: moduleId, patch: { writing_archive: archive.filter((_, i) => i !== index) } } })
  }

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Yazı Arşivi</h2>
          <p className="text-xs text-muted mt-0.5">Sanchez yazılarını düzeltir, gelişimini takip edersin.</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs text-gold hover:opacity-70 transition-opacity"
        >
          + Yeni Yazı
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mt-5 mb-6 pb-6 border-b border-border flex flex-col gap-3">
          <div className="flex gap-2">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as WritingEntry['type'] })}
              className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-gold transition-colors">
              <option value="task2">Task 2</option>
              <option value="task1">Task 1</option>
              <option value="daily">Günlük</option>
            </select>
          </div>
          <input autoFocus value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="Konu / başlık"
            className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/40 outline-none focus:border-gold transition-colors" />
          <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Yazını buraya yaz… Sonra Sanchez'e düzelttir."
            rows={7}
            className="bg-surface-2 border border-border rounded-xl px-3 py-3 text-sm text-foreground placeholder:text-muted/40 outline-none focus:border-gold transition-colors resize-none leading-relaxed" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors">
              İptal
            </button>
            <button onClick={addEntry} disabled={!form.topic.trim() || saving}
              className="px-4 py-2 bg-gold text-background text-sm font-medium rounded-xl disabled:opacity-30 hover:opacity-80 transition-opacity">
              {saving ? '…' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {archive.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-sm">Henüz yazı yok.</p>
          <p className="text-muted/50 text-xs mt-1">+ Yeni Yazı ile başla, Sanchez düzeltsin.</p>
        </div>
      ) : (
        <div className="divide-y divide-border mt-4">
          {[...archive].reverse().map((e, i) => {
            const realIndex = archive.length - 1 - i
            const isOpen = expanded === realIndex
            return (
              <div key={i} className="group py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-muted uppercase tracking-wider">{TYPE_LABEL[e.type]}</span>
                      <span className="text-muted/30 text-[10px]">·</span>
                      <span className="text-[10px] text-muted">{e.date}</span>
                      {e.score && <span className="text-[10px] text-gold font-semibold ml-1">{e.score}</span>}
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug">{e.topic}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => setExpanded(isOpen ? null : realIndex)}
                      className="text-xs text-muted hover:text-foreground transition-colors">
                      {isOpen ? 'Kapat' : 'Aç'}
                    </button>
                    <button onClick={() => removeEntry(realIndex)}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-all">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 flex flex-col gap-4">
                    {e.text && (
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{e.text}</p>
                    )}
                    {e.correction ? (
                      <div className="border-l-2 border-gold/40 pl-4">
                        <p className="text-[10px] text-gold uppercase tracking-wider mb-1.5">Sanchez</p>
                        <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">{e.correction}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted/40 italic">
                        Sanchez henüz düzeltmedi. Chat'te paylaş, düzeltsin.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="h-20" />
    </div>
  )
}
