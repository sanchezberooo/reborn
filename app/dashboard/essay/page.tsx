'use client'

// Essay — UI v1 nötr dil. Görsel katman yeni tasarım sistemine taşındı
// (altın vurgusu ve hardcoded laciverte yakın zeminler kaldırıldı); veri ve
// ajan mantığı DEĞİŞMEDİ: dbLoad/dbCreate/dbUpdate/dbDeleteEssay*,
// /api/agents/run çağrıları ve output sözleşmeleri aynen duruyor.
// Renk yalnız semantik durum için kullanılır (statü rozetleri, hata/başarı).

import { useState, useEffect, useCallback } from 'react'
import {
  dbLoadEssays, dbCreateEssay, dbUpdateEssayMeta, dbDeleteEssay,
  dbLoadEssayVersions, dbSaveEssayVersion,
} from '@/lib/db'
import type { Essay, EssayVersion, EssayStatus } from '@/lib/db'
import SectionHeader from '@/components/SectionHeader'
import { cn } from '@/lib/utils'

// ─── status helpers ───────────────────────────────────────────────────────────

// Statü rengi semantiktir (ilerleme durumu), vurgu/accent değildir.
const STATUS_META: Record<EssayStatus, { label: string; dot: string; text: string }> = {
  brainstorm: { label: 'Beyin Fırtınası', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  draft:      { label: 'Taslak',          dot: 'bg-warning',          text: 'text-warning' },
  revision:   { label: 'Revizyon',        dot: 'bg-foreground',       text: 'text-foreground' },
  done:       { label: 'Bitti',           dot: 'bg-success',          text: 'text-success' },
}

const STATUS_ORDER: EssayStatus[] = ['brainstorm', 'draft', 'revision', 'done']

function StatusBadge({ status }: { status: EssayStatus }) {
  const m = STATUS_META[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-1 text-[9px] font-semibold tracking-wide', m.text)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', m.dot)} />
      {m.label}
    </span>
  )
}

function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── agent output types (registry outputContract'larıyla eşleşir) ────────────

interface BrainstormOutput {
  promptSummary?: string
  questions?: { question: string; why: string }[]
  strongMaterial?: { material: string; whyStrong: string }[]
  avoidThese?: string[]
  parseError?: boolean
  raw?: string
}

interface CriticOutput {
  clicheRisk?: { quote: string; issue: string }[]
  showDontTell?: { quote: string; issue: string }[]
  structureFlow?: string
  promptFit?: { answersPrompt: boolean; explanation: string }
  wordCount?: { limit: number | null; actual: number; verdict: string }
  officerImpression?: string
  topPriorities?: string[]
  parseError?: boolean
  raw?: string
}

interface AgentRun {
  id: string
  agent_name: string
  status: string
  input: Record<string, unknown> | null
  output: unknown
  error: string | null
  started_at: string
}

// ─── agent output renderers ───────────────────────────────────────────────────

function FeedbackSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground/70">{title}</p>
      {children}
    </div>
  )
}

function QuoteIssueList({ items, emptyText }: { items?: { quote: string; issue: string }[]; emptyText: string }) {
  if (!items || items.length === 0) {
    return <p className="text-2xs text-success/70">{emptyText}</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
          <p className="text-2xs italic leading-relaxed text-foreground/50">&ldquo;{it.quote}&rdquo;</p>
          <p className="mt-1.5 text-2xs leading-relaxed text-foreground/75">{it.issue}</p>
        </div>
      ))}
    </div>
  )
}

function BrainstormView({ out }: { out: BrainstormOutput }) {
  if (out.parseError) {
    return <pre className="whitespace-pre-wrap text-3xs text-foreground/50">{out.raw}</pre>
  }
  return (
    <div className="flex flex-col gap-4">
      {out.promptSummary && (
        <FeedbackSection title="Prompt aslında ne soruyor">
          <p className="text-xs leading-relaxed text-foreground/75">{out.promptSummary}</p>
        </FeedbackSection>
      )}
      {out.questions && out.questions.length > 0 && (
        <FeedbackSection title={`Kazıcı sorular (${out.questions.length})`}>
          <div className="flex flex-col gap-2">
            {out.questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
                <p className="text-xs font-medium leading-relaxed text-foreground/90">{i + 1}. {q.question}</p>
                <p className="mt-1 text-3xs leading-relaxed text-muted-foreground">{q.why}</p>
              </div>
            ))}
          </div>
        </FeedbackSection>
      )}
      {out.strongMaterial && out.strongMaterial.length > 0 && (
        <FeedbackSection title="Güçlü malzemen">
          <div className="flex flex-col gap-2">
            {out.strongMaterial.map((m, i) => (
              <div key={i} className="rounded-lg border border-success/15 bg-success/5 px-3 py-2.5">
                <p className="text-xs leading-relaxed text-foreground/85">{m.material}</p>
                <p className="mt-1 text-3xs leading-relaxed text-success/60">{m.whyStrong}</p>
              </div>
            ))}
          </div>
        </FeedbackSection>
      )}
      {out.avoidThese && out.avoidThese.length > 0 && (
        <FeedbackSection title="Bunlardan kaçın">
          <ul className="flex flex-col gap-1">
            {out.avoidThese.map((a, i) => (
              <li key={i} className="text-2xs leading-relaxed text-destructive/70">• {a}</li>
            ))}
          </ul>
        </FeedbackSection>
      )}
    </div>
  )
}

function CriticView({ out }: { out: CriticOutput }) {
  if (out.parseError) {
    return <pre className="whitespace-pre-wrap text-3xs text-foreground/50">{out.raw}</pre>
  }
  return (
    <div className="flex flex-col gap-4">
      {out.officerImpression && (
        <div className="rounded-xl border border-border bg-secondary/60 px-4 py-3">
          <p className="mb-1.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
            Admission officer izlenimi
          </p>
          <p className="text-xs leading-relaxed text-foreground/85">{out.officerImpression}</p>
        </div>
      )}
      {out.topPriorities && out.topPriorities.length > 0 && (
        <FeedbackSection title="Öncelikli düzeltmeler">
          <ol className="flex flex-col gap-1">
            {out.topPriorities.map((p, i) => (
              <li key={i} className="text-xs leading-relaxed text-foreground/85">
                <span className="font-semibold text-foreground">{i + 1}.</span> {p}
              </li>
            ))}
          </ol>
        </FeedbackSection>
      )}
      {out.promptFit && (
        <FeedbackSection title="Prompt'a cevap veriyor mu">
          <p className={cn('text-xs leading-relaxed', out.promptFit.answersPrompt ? 'text-success/85' : 'text-destructive/85')}>
            {out.promptFit.answersPrompt ? '✓ Evet' : '✗ Hayır'} — <span className="text-foreground/70">{out.promptFit.explanation}</span>
          </p>
        </FeedbackSection>
      )}
      <FeedbackSection title="Klişe riski">
        <QuoteIssueList items={out.clicheRisk} emptyText="Belirgin klişe tespit edilmedi." />
      </FeedbackSection>
      <FeedbackSection title="Show, don't tell">
        <QuoteIssueList items={out.showDontTell} emptyText="Anlatım genel olarak gösteriyor." />
      </FeedbackSection>
      {out.structureFlow && (
        <FeedbackSection title="Yapı ve akış">
          <p className="text-xs leading-relaxed text-foreground/75">{out.structureFlow}</p>
        </FeedbackSection>
      )}
      {out.wordCount && (
        <FeedbackSection title="Kelime sayısı">
          <p className="text-2xs text-foreground/70">
            {out.wordCount.actual} kelime{out.wordCount.limit ? ` / limit ${out.wordCount.limit}` : ''} — {out.wordCount.verdict}
          </p>
        </FeedbackSection>
      )}
    </div>
  )
}

// ─── new essay form ───────────────────────────────────────────────────────────

function NewEssayForm({ onCreated, onCancel }: { onCreated: (e: Essay) => void; onCancel: () => void }) {
  const [title, setTitle]         = useState('')
  const [school, setSchool]       = useState('')
  const [prompt, setPrompt]       = useState('')
  const [wordLimit, setWordLimit] = useState('')
  const [saving, setSaving]       = useState(false)

  async function create() {
    if (!title.trim() || !prompt.trim() || saving) return
    setSaving(true)
    try {
      const essay = await dbCreateEssay({
        title: title.trim(),
        school: school.trim() || undefined,
        prompt: prompt.trim(),
        word_limit: wordLimit ? Number(wordLimit) : null,
      })
      onCreated(essay)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-ring/40 focus:outline-none'

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-semibold text-foreground">Yeni Essay</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Başlık (örn: Common App Personal Statement)" className={inputCls} />
      <div className="flex gap-3">
        <input value={school} onChange={(e) => setSchool(e.target.value)}
          placeholder="Hedef okul (opsiyonel)" className={inputCls} />
        <input value={wordLimit} onChange={(e) => setWordLimit(e.target.value.replace(/\D/g, ''))}
          placeholder="Kelime limiti" className={`${inputCls} !w-32`} inputMode="numeric" />
      </div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder="Essay prompt'u (cevaplanacak soru — aynen yapıştır)" rows={3}
        className={`${inputCls} resize-none`} />
      <div className="flex gap-2">
        <button onClick={create} disabled={!title.trim() || !prompt.trim() || saving}
          className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
          {saving ? 'Oluşturuluyor…' : 'Oluştur'}
        </button>
        <button onClick={onCancel}
          className="rounded-xl border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          Vazgeç
        </button>
      </div>
    </div>
  )
}

// ─── essay detail ─────────────────────────────────────────────────────────────

function EssayDetail({ essay, onBack, onMetaChange }: {
  essay: Essay
  onBack: () => void
  onMetaChange: (patch: Partial<Essay>) => void
}) {
  const [versions,   setVersions]   = useState<EssayVersion[]>([])
  const [content,    setContent]    = useState('')
  const [viewingVer, setViewingVer] = useState<EssayVersion | null>(null) // eski versiyon görüntüleme
  const [saving,     setSaving]     = useState(false)
  const [dirty,      setDirty]      = useState(false)

  const [runs,       setRuns]       = useState<AgentRun[]>([])
  const [runningAgent, setRunningAgent] = useState<string | null>(null)
  const [agentError,   setAgentError]   = useState<string | null>(null)

  const loadVersions = useCallback(async () => {
    const v = await dbLoadEssayVersions(essay.id).catch(() => [])
    setVersions(v)
    return v
  }, [essay.id])

  const loadRuns = useCallback(async () => {
    // essayId input'a yazıldığı için geçmiş çalıştırmalar bu essay'e bağlanabiliyor
    const all: AgentRun[] = []
    for (const agent of ['essay-brainstorm', 'essay-critic']) {
      const r = await fetch(`/api/agents/runs?agent=${agent}`).then((x) => x.json()).catch(() => [])
      if (Array.isArray(r)) all.push(...r)
    }
    const mine = all
      .filter((r) => (r.input as Record<string, unknown> | null)?.essayId === essay.id)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    setRuns(mine)
  }, [essay.id])

  useEffect(() => {
    loadVersions().then((v) => {
      if (v.length > 0) setContent(v[0].content)
    })
    loadRuns()
  }, [loadVersions, loadRuns])

  async function saveVersion() {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      await dbSaveEssayVersion(essay.id, content)
      await loadVersions()
      setDirty(false)
      if (essay.status === 'brainstorm') {
        onMetaChange({ status: 'draft' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function runEssayAgent(agentName: 'essay-brainstorm' | 'essay-critic') {
    if (runningAgent) return
    setAgentError(null)

    const input: Record<string, unknown> = {
      essayId: essay.id,
      essayPrompt: essay.prompt,
      school: essay.school ?? undefined,
      wordLimit: essay.word_limit,
    }
    if (agentName === 'essay-critic') {
      const draft = content.trim() || versions[0]?.content
      if (!draft) {
        setAgentError('Eleştiri için önce bir taslak yaz ve kaydet.')
        return
      }
      input.draft = draft
    }

    setRunningAgent(agentName)
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, input }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `API ${res.status}`)
      }
      await loadRuns()
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : 'Ajan çalıştırılamadı.')
    } finally {
      setRunningAgent(null)
    }
  }

  const editorText = viewingVer ? viewingVer.content : content
  const wc = wordCount(editorText)
  const overLimit = essay.word_limit != null && wc > essay.word_limit

  return (
    <div className="flex flex-col gap-5">
      {/* header */}
      <div>
        <button onClick={onBack} className="mb-3 block text-xs text-muted-foreground transition-colors hover:text-foreground">
          ← Essay listesine dön
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[240px] flex-1">
            <h2 className="text-xl font-bold text-foreground">{essay.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {essay.school ? `${essay.school} · ` : ''}
              {essay.word_limit ? `limit ${essay.word_limit} kelime` : 'limit belirtilmemiş'}
            </p>
          </div>
          <select
            value={essay.status}
            onChange={(e) => onMetaChange({ status: e.target.value as EssayStatus })}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:border-ring/40 focus:outline-none"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 rounded-xl border border-border bg-card px-4 py-3">
          <p className="mb-1 text-[9px] font-medium uppercase tracking-widest text-muted-foreground/70">Prompt</p>
          <p className="text-xs leading-relaxed text-foreground/80">{essay.prompt}</p>
        </div>
      </div>

      {/* two-pane: editor left, agent feedback right */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* ── left: writing area ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-3xs font-medium uppercase tracking-widest text-muted-foreground/70">
              {viewingVer ? `v${viewingVer.version_number} görüntüleniyor (salt okunur)` : 'Yazım alanı — sen yazarsın'}
            </p>
            <span className={cn('text-3xs', overLimit ? 'text-destructive' : 'text-muted-foreground/70')}>
              {wc} kelime{essay.word_limit ? ` / ${essay.word_limit}` : ''}
            </span>
          </div>

          {viewingVer ? (
            <>
              <div className="min-h-[380px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground/70"
                style={{ maxHeight: 520 }}>
                {viewingVer.content}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setContent(viewingVer.content); setViewingVer(null); setDirty(true) }}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                  Bu versiyonu editöre yükle
                </button>
                <button onClick={() => setViewingVer(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                  Editöre dön
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setDirty(true) }}
                placeholder="Essay'ini buraya yaz. Ajanlar senin yerine yazmaz — sorar, işaretler, eleştirir. Cümleler senin."
                className="min-h-[380px] resize-y rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground transition-colors placeholder:text-muted-foreground/40 focus:border-ring/40 focus:outline-none"
                style={{ maxHeight: 640 }}
              />
              <button onClick={saveVersion} disabled={!content.trim() || saving || !dirty}
                className="self-start rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
                {saving ? 'Kaydediliyor…' : `Kaydet — yeni versiyon (v${(versions[0]?.version_number ?? 0) + 1})`}
              </button>
            </>
          )}

          {/* version history */}
          {versions.length > 0 && (
            <div className="mt-2">
              <p className="mb-2 text-[9px] font-medium uppercase tracking-widest text-muted-foreground/70">
                Versiyon geçmişi ({versions.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {versions.map((v) => (
                  <button key={v.id}
                    onClick={() => setViewingVer(viewingVer?.id === v.id ? null : v)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:bg-secondary/60',
                      viewingVer?.id === v.id ? 'border-ring/50' : 'border-border',
                    )}>
                    <span className="font-mono text-3xs font-semibold text-foreground">v{v.version_number}</span>
                    <span className="flex-1 text-3xs text-muted-foreground">{wordCount(v.content)} kelime</span>
                    <span className="text-3xs text-muted-foreground/60">{fmtTs(v.created_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── right: agent feedback ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-3xs font-medium uppercase tracking-widest text-muted-foreground/70">
            Ajan geri bildirimleri — metin yazmazlar
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => runEssayAgent('essay-brainstorm')}
              disabled={runningAgent !== null}
              className="flex-1 rounded-xl border border-border bg-secondary py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-40">
              {runningAgent === 'essay-brainstorm' ? '⏳ Sorular hazırlanıyor…' : '💭 Beyin Fırtınası'}
            </button>
            <button
              onClick={() => runEssayAgent('essay-critic')}
              disabled={runningAgent !== null}
              className="flex-1 rounded-xl border border-border bg-secondary py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-40">
              {runningAgent === 'essay-critic' ? '⏳ Taslak inceleniyor…' : '✒️ Eleştiri Al'}
            </button>
          </div>

          {agentError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              {agentError}
            </div>
          )}

          {runs.length === 0 && !runningAgent && (
            <div className="rounded-2xl border border-border bg-card py-14 text-center">
              <p className="text-sm text-muted-foreground/60">Henüz geri bildirim yok.</p>
              <p className="mx-auto mt-1.5 max-w-[280px] text-3xs leading-relaxed text-muted-foreground/40">
                Beyin Fırtınası ile başla: ajanlar profilini ve hafızanı okuyup bu prompt için kazıcı sorular üretir.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 720 }}>
            {runs.map((run) => {
              const isBrainstorm = run.agent_name === 'essay-brainstorm'
              return (
                <div key={run.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-2xs font-semibold text-foreground">
                      {isBrainstorm ? '💭 Beyin Fırtınası' : '✒️ Eleştiri'}
                    </p>
                    <span className="text-3xs text-muted-foreground/60">{fmtTs(run.started_at)}</span>
                  </div>
                  {run.status === 'error' ? (
                    <p className="text-2xs text-destructive/80">{run.error ?? 'Ajan hatayla bitti.'}</p>
                  ) : run.status === 'running' ? (
                    <p className="text-2xs text-muted-foreground">Çalışıyor…</p>
                  ) : isBrainstorm ? (
                    <BrainstormView out={(run.output ?? {}) as BrainstormOutput} />
                  ) : (
                    <CriticView out={(run.output ?? {}) as CriticOutput} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function EssayPage() {
  const [essays,   setEssays]   = useState<Essay[]>([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Essay | null>(null)
  const [verCounts, setVerCounts] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    try {
      const list = await dbLoadEssays()
      setEssays(list)
      // versiyon sayıları (liste rozetleri için)
      await Promise.all(list.map(async (e) => {
        const v = await dbLoadEssayVersions(e.id).catch(() => [])
        setVerCounts((p) => ({ ...p, [e.id]: v.length }))
      }))
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function updateMeta(id: string, patch: Partial<Essay>) {
    await dbUpdateEssayMeta(id, patch).catch(() => {})
    setEssays((p) => p.map((e) => e.id === id ? { ...e, ...patch } : e))
    setSelected((p) => p && p.id === id ? { ...p, ...patch } : p)
  }

  async function removeEssay(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Bu essay ve tüm versiyonları silinecek. Emin misin?')) return
    await dbDeleteEssay(id).catch(() => {})
    setEssays((p) => p.filter((x) => x.id !== id))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!selected && (
        <SectionHeader
          title="Essay"
          subtitle="Sen yazarsın — ajanlar sorar, işaretler, eleştirir. Asla senin yerine yazmazlar."
        >
          {!creating && (
            <button onClick={() => setCreating(true)}
              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              + Yeni Essay
            </button>
          )}
        </SectionHeader>
      )}

      <div className="no-scrollbar flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">

          {selected ? (
            <EssayDetail
              essay={selected}
              onBack={() => { setSelected(null); load() }}
              onMetaChange={(patch) => updateMeta(selected.id, patch)}
            />
          ) : (
            <>
              {creating && (
                <div className="mb-6">
                  <NewEssayForm
                    onCreated={(e) => { setCreating(false); setEssays((p) => [e, ...p]); setSelected(e) }}
                    onCancel={() => setCreating(false)}
                  />
                </div>
              )}

              {loading && (
                <div className="py-16 text-center text-sm text-muted-foreground/50">Yükleniyor…</div>
              )}

              {!loading && essays.length === 0 && !creating && (
                <div className="rounded-2xl border border-border bg-card py-20 text-center">
                  <p className="text-sm text-muted-foreground">Henüz essay yok.</p>
                  <p className="mx-auto mt-1.5 max-w-sm text-2xs leading-relaxed text-muted-foreground/60">
                    Common App personal statement veya okul bazlı supplemental essay ekleyerek başla.
                    Ekim-Kasım başvuru döneminden önce her essay birkaç revizyon turu görmeli.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {essays.map((e) => (
                  <div key={e.id}
                    onClick={() => setSelected(e)}
                    className="group flex cursor-pointer flex-col gap-2.5 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-ring/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[15px] font-semibold leading-snug text-foreground">
                          {e.title}
                        </p>
                        {e.school && <p className="mt-0.5 text-2xs text-muted-foreground">{e.school}</p>}
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                    <p className="line-clamp-2 text-2xs leading-relaxed text-muted-foreground/70">{e.prompt}</p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-3xs text-muted-foreground/60">
                        {verCounts[e.id] ?? 0} versiyon{e.word_limit ? ` · limit ${e.word_limit}` : ''}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-3xs text-muted-foreground/60">{fmtTs(e.updated_at)}</span>
                        <button onClick={(ev) => removeEssay(ev, e.id)} title="Sil"
                          className="text-xs text-muted-foreground/50 opacity-0 transition-all hover:text-destructive group-hover:opacity-100">
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
