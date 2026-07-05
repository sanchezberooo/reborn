'use client'

// Brain — Reborn'un ikinci beyni (roadmap §6.1/4). v0 "obsidian" ekranının
// portu; isim bilinçli olarak Brain: Obsidian yalnızca Brain'e veri sağlayan
// kaynaklardan biridir. Graf artık gerçek entities/links'ten geliyor (bkz.
// app/brain/page.tsx, lib/brain-layout.ts); yalnız "Keşifler" ve "Günlük
// notlar" panelleri hâlâ mock (gerçek analiz Faz AI'nın işi).

import { useState } from 'react'
import Link from 'next/link'
import KnowledgeGraph from './KnowledgeGraph'
import { discoveries, dailyNotes, type Note } from '@/lib/brain-data'
import SectionHeader from '@/components/SectionHeader'
import {
  Brain as BrainIcon,
  Search,
  Sparkles,
  Link2,
  Clock,
  X,
  FileText,
  Hash,
  ArrowUpRight,
} from 'lucide-react'

/** entityType → ilgili içeriğin yaşadığı modül rotası. Karşılığı olmayan
 *  tipler (note, project, person, task, habit, resource, event) için henüz
 *  ayrı bir görüntüleyici sayfa yok — o notlar yalnızca bu panelde açılır. */
const TYPE_ROUTE: Partial<Record<NonNullable<Note['entityType']>, string>> = {
  journal: '/dashboard/gunluk',
  goal: '/dashboard/hedefler',
  essay: '/dashboard/essay',
}

export default function Brain({
  notes,
  edges,
  noteById,
}: {
  notes: Note[]
  edges: { source: string; target: string }[]
  noteById: Record<string, Note>
}) {
  const [activeId, setActiveId] = useState<string | null>(notes[0]?.id ?? null)
  const [query, setQuery] = useState('')

  const active = activeId ? noteById[activeId] : null

  const filtered = query
    ? notes.filter(
        (n) =>
          n.label.toLowerCase().includes(query.toLowerCase()) ||
          n.tags.some((t) => t.toLowerCase().includes(query.toLowerCase())),
      )
    : notes

  return (
    <div className="flex h-full flex-col">
      <SectionHeader
        icon={BrainIcon}
        title="Brain"
        subtitle="İkinci beynin — her fikir birbirine bağlı"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Not ve etiketlerde ara"
            className="h-9 w-64 rounded-lg border border-border bg-secondary/60 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring/60"
          />
        </div>
      </SectionHeader>

      <div className="flex min-h-0 flex-1 gap-4 p-4 lg:p-6">
        {/* Sol — not dizini */}
        <aside className="hidden w-64 shrink-0 flex-col gap-1 overflow-y-auto pr-1 lg:flex">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {filtered.length} not
          </p>
          {filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => setActiveId(n.id)}
              className={`group flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                activeId === n.id
                  ? 'border-ring/40 bg-secondary/60'
                  : 'border-transparent hover:bg-secondary/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText
                  className="size-3.5 text-muted-foreground"
                  strokeWidth={1.75}
                />
                <span className="text-sm font-medium text-foreground">
                  {n.label}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-5.5 text-xs text-muted-foreground">
                <span>{n.links.length} bağlantı</span>
                <span aria-hidden>·</span>
                <span>{n.updated}</span>
              </div>
            </button>
          ))}
        </aside>

        {/* Orta — graf */}
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <span className="inline-block size-2 rounded-full bg-success" />
            Canlı bilgi grafiği
          </div>
          {notes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              Henüz bağlantılı bir kayıt yok — günlük, hedef veya not ekledikçe graf burada büyüyecek.
            </div>
          ) : (
            <KnowledgeGraph
              notes={notes}
              edges={edges}
              noteById={noteById}
              activeId={activeId}
              onSelect={(n) => setActiveId(n.id)}
            />
          )}
        </div>

        {/* Sağ — detay + keşifler */}
        <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto xl:flex">
          {active ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-foreground text-balance">
                    {active.label}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" strokeWidth={1.75} />
                    Güncellendi: {active.updated}
                  </div>
                </div>
                <button
                  onClick={() => setActiveId(null)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Notu kapat"
                >
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-1.5">
                {active.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <Hash className="size-2.5" strokeWidth={2} />
                    {t.replace('#', '')}
                  </span>
                ))}
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {active.body}
              </p>

              {active.entityType && TYPE_ROUTE[active.entityType] && (
                <Link
                  href={TYPE_ROUTE[active.entityType]!}
                  className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary transition-opacity hover:opacity-80"
                >
                  İçeriğe git
                  <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
                </Link>
              )}

              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Link2 className="size-3.5" strokeWidth={1.75} />
                  Bağlı notlar
                </p>
                <div className="flex flex-col gap-1">
                  {active.links.map((id) => {
                    const linked = noteById[id]
                    if (!linked) return null
                    return (
                      <button
                        key={id}
                        onClick={() => setActiveId(id)}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-secondary/70"
                      >
                        {linked.label}
                        <ArrowUpRight
                          className="size-3.5 text-muted-foreground"
                          strokeWidth={1.75}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              Bağlantıyı keşfetmek için bir düğüm seç.
            </div>
          )}

          {/* AI keşifleri */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5 text-foreground/70" strokeWidth={1.75} />
              Keşifler
            </p>
            <div className="flex flex-col gap-3">
              {discoveries.map((d, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <p className="text-sm leading-relaxed text-foreground text-pretty">
                    {d.text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.by} · {d.time}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Günlük notlar */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Günlük notlar
            </p>
            <div className="flex flex-col gap-2">
              {dailyNotes.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.date}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {d.words} kelime
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
