'use client'

// Sohbet listesi (Sanchez sekmesinin sol sütunu) — UI v1 nötr dil.
// Veri mantığı değişmedi: dbLoadConversations/dbDeleteConversation +
// reborn:* olay otobüsü. Yalnız görsel katman v0 diline taşındı.

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { dbLoadConversations, dbDeleteConversation } from '@/lib/db'
import type { ConversationMeta } from '@/lib/db'

function groupByDate(items: ConversationMeta[]) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000)
  const today: ConversationMeta[] = []
  const thisWeek: ConversationMeta[] = []
  const earlier: ConversationMeta[] = []
  for (const c of items) {
    const d = new Date(c.created_at)
    if (d >= startOfToday) today.push(c)
    else if (d >= startOfWeek) thisWeek.push(c)
    else earlier.push(c)
  }
  return { today, thisWeek, earlier }
}

function ConvItem({
  conv,
  onLoad,
  onDelete,
}: {
  conv: ConversationMeta
  onLoad: (id: string) => void
  onDelete: (e: React.MouseEvent, id: string) => void
}) {
  return (
    <div className="group flex items-center gap-0.5 rounded-lg transition-colors hover:bg-sidebar-accent/60">
      <button onClick={() => onLoad(conv.id)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-foreground/90 transition-colors group-hover:text-foreground">
            {conv.title}
          </span>
          <span className="shrink-0 text-2xs text-muted-foreground">
            {new Date(conv.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </button>
      <button
        onClick={(e) => onDelete(e, conv.id)}
        title="Sil"
        className="mr-1.5 shrink-0 rounded-md p-1 text-muted-foreground/50 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
      >
        <X className="size-3" strokeWidth={2.5} />
      </button>
    </div>
  )
}

function DateGroup({
  label,
  items,
  onLoad,
  onDelete,
}: {
  label: string
  items: ConversationMeta[]
  onLoad: (id: string) => void
  onDelete: (e: React.MouseEvent, id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-3">
      <p className="px-2 py-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-0.5">
        {items.map((conv) => (
          <ConvItem key={conv.id} conv={conv} onLoad={onLoad} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    const convs = await dbLoadConversations().catch(() => [])
    setConversations(convs)
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('reborn:conversation-saved', refresh)
    return () => window.removeEventListener('reborn:conversation-saved', refresh)
  }, [refresh])

  function triggerNewChat() {
    window.dispatchEvent(new CustomEvent('reborn:new-chat'))
  }

  function onLoad(id: string) {
    window.dispatchEvent(new CustomEvent('reborn:load-conversation', { detail: { id } }))
  }

  async function onDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await dbDeleteConversation(id).catch(() => {})
    refresh()
  }

  const { today, thisWeek, earlier } = groupByDate(conversations)

  const filtered = search.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : null

  return (
    <aside className="hidden w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="p-3">
        <button
          onClick={triggerNewChat}
          className="flex w-full items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" strokeWidth={2} />
          Yeni sohbet
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sohbetlerde ara"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground/60 transition-colors hover:text-foreground">
              <X className="size-3.5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-2 pb-4">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="px-2.5 py-1.5 text-2xs text-muted-foreground">Sonuç bulunamadı</p>
          ) : (
            <>
              <p className="px-2 py-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">Sonuçlar</p>
              <div className="flex flex-col gap-0.5">
                {filtered.map((conv) => (
                  <ConvItem key={conv.id} conv={conv} onLoad={onLoad} onDelete={onDelete} />
                ))}
              </div>
            </>
          )
        ) : conversations.length === 0 ? (
          <p className="px-2.5 py-1.5 text-2xs text-muted-foreground">Henüz sohbet yok</p>
        ) : (
          <>
            <DateGroup label="Bugün" items={today} onLoad={onLoad} onDelete={onDelete} />
            <DateGroup label="Bu Hafta" items={thisWeek} onLoad={onLoad} onDelete={onDelete} />
            <DateGroup label="Daha Önce" items={earlier} onLoad={onLoad} onDelete={onDelete} />
          </>
        )}
      </div>
    </aside>
  )
}
