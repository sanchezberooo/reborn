'use client'

// MAXAİ Ofis ajan detay paneli — sahnede bir ajana tıklanınca açılır.
// Geniş ekranda sahnenin sağında yan panel, dar ekranda alttan açılan sheet
// (tek markup, responsive sınıflarla). Veri: mevcut /api/agents/runs?agent=
// endpoint'i (yeni API yok); koşu aktifken 5 sn'de bir tazelenir
// (MAXAIPanel'deki polling deseni).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import StatusBadge, { statusFromRun } from './StatusBadge'
import { fmtRelative, runSummary, type AgentMeta, type AgentRun } from './office-data'

// Registry'de açıklama alanı yok; UI metni burada eşlenir. (MAXAIPanel'deki
// AGENT_DESC ile aynı içerik — o dosya bu görevde dokunulmaz olduğundan
// export edilemedi, kopya bilinçli.)
const AGENT_ROLES: Record<string, string> = {
  'ingilizce-genel-plan':  '10 haftalık IELTS yol haritası üretir',
  'ingilizce-planlayici':  'Haftalık detaylı günlük ders planı hazırlar',
  'kesif-arastirmaci':     "Web'de derinlemesine araştırma ve analiz yapar",
  'burs-toplu-arastirma':  'ABD üniversiteleri toplu burs araştırması yürütür',
  'burs-derinlestir':      'Tek okul için ayrıntılı burs profili çıkarır',
  'essay-brainstorm':      'Essay için kişisel hikayeyi kazan sorular üretir',
  'essay-critic':          'Essay taslağını 6 eksende eleştirir — metin yazmaz',
}

const MAX_RUNS = 5

export default function AgentDetailPanel({
  agent,
  onClose,
}: {
  agent: AgentMeta
  onClose: () => void
}) {
  // null = yükleniyor (ajan değişince tekrar null'a döner)
  const [runs, setRuns] = useState<AgentRun[] | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/agents/runs?agent=${encodeURIComponent(agent.name)}`)
      const data = await r.json()
      setRuns(Array.isArray(data) ? data.slice(0, MAX_RUNS) : [])
    } catch {
      setRuns([])
    }
  }, [agent.name])

  useEffect(() => {
    setRuns(null)
    load()
  }, [load])

  // koşu aktifken 5 sn'de bir tazele
  useEffect(() => {
    if (!runs?.some((r) => r.status === 'running')) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [runs, load])

  return (
    <>
      {/* dar ekran: sheet arkası karartma — tıklayınca kapanır */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={onClose} />

      <aside
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[65vh] flex-col overflow-y-auto rounded-t-2xl border-t border-border bg-background shadow-2xl lg:static lg:z-auto lg:h-full lg:max-h-none lg:w-[340px] lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
        aria-label={`${agent.displayName} detayı`}
      >
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-foreground">{agent.displayName}</h2>
              <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
                {AGENT_ROLES[agent.name] ?? 'AI agent'}
              </p>
              <p className="mt-1 font-mono text-3xs text-muted-foreground/60">{agent.name}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Paneli kapat"
              className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div>
            <p className="mb-2 text-3xs font-medium uppercase tracking-widest text-muted-foreground">
              Son Koşular
            </p>
            {runs === null && (
              <p className="py-6 text-center text-2xs text-muted-foreground/60">Yükleniyor…</p>
            )}
            {runs !== null && runs.length === 0 && (
              <p className="py-6 text-center text-2xs text-muted-foreground/60">
                Henüz koşu yok — Panel&apos;den başlatılabilir.
              </p>
            )}
            {runs !== null && runs.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {runs.map((run) => (
                  <li
                    key={run.id}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
                  >
                    <StatusBadge status={statusFromRun(run.status)} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-2xs text-foreground/70" title={runSummary(run)}>
                      {runSummary(run)}
                    </span>
                    <span className="shrink-0 text-3xs text-muted-foreground">
                      {fmtRelative(run.started_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/maxai/panel"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-2xs font-semibold text-primary-foreground transition-opacity hover:opacity-85"
          >
            Panele Git
          </Link>
        </div>
      </aside>
    </>
  )
}
