'use client'

// Global semantik arama (Faz 3, roadmap "Global semantik arama" — Faz 1
// hibrit retrieval motorunun UI'ı). Cmd/Ctrl+K ile her yerden açılır;
// SettingsPanel'deki modal deseniyle tutarlı (backdrop + kart), komut
// paleti tarzında ortalanmış. Veri: GET /api/search → lib/ai/retrieval.ts
// searchEntities (yazma katmanına dokunmaz).

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EntityType } from '@/lib/db-server'

interface SearchResult {
  id: string
  type: EntityType
  title: string
  snippet: string | null
  score: number
}

const TYPE_LABEL: Record<EntityType, string> = {
  journal: 'Günlük',
  goal: 'Hedef',
  essay: 'Essay',
  note: 'Not',
  project: 'Proje',
  person: 'Kişi',
  task: 'Görev',
  habit: 'Alışkanlık',
  resource: 'Kaynak',
  event: 'Etkinlik',
}

/** entityType → ilgili içeriğin yaşadığı modül rotası (components/brain/Brain.tsx
 *  TYPE_ROUTE ile aynı üç eşleme); karşılığı olmayan tipler Brain'e düşer. */
const TYPE_ROUTE: Partial<Record<EntityType, string>> = {
  journal: '/dashboard/gunluk',
  goal: '/dashboard/hedefler',
  essay: '/dashboard/essay',
}

const DEBOUNCE_MS = 300

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQuery('')
      setResults(null)
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        const body = await res.json()
        setResults(res.ok ? (body.results as SearchResult[]) : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  function goTo(result: SearchResult) {
    router.push(TYPE_ROUTE[result.type] ?? '/brain')
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-16 flex-col items-center gap-1 rounded-xl py-2.5 text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        aria-label="Ara (Ctrl+K)"
      >
        <Search className="size-[20px]" strokeWidth={1.75} />
        <span className="text-[10px] font-medium leading-none">Ara</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              {loading ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Günlük, hedef, essay veya not ara…"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Kapat"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {!query.trim() && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Aramak için yazmaya başla.
                </p>
              )}
              {query.trim() && !loading && results && results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Sonuç bulunamadı.</p>
              )}
              {results?.map((r) => (
                <button
                  key={r.id}
                  onClick={() => goTo(r)}
                  className="flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground',
                      )}
                    >
                      {TYPE_LABEL[r.type]}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">{r.title}</span>
                  </div>
                  {r.snippet && (
                    <p className="truncate text-xs text-muted-foreground">{r.snippet}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
