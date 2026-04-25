'use client'

import { useState, useEffect, useCallback } from 'react'
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
    <div className="group flex items-center gap-0.5 rounded-xl hover:bg-white/[0.04] transition-colors">
      <button onClick={() => onLoad(conv.id)} className="flex-1 min-w-0 text-left px-2 py-1.5">
        <p className="text-[12px] text-muted group-hover:text-foreground/70 line-clamp-1 leading-snug transition-colors">
          {conv.title}
        </p>
        <p className="text-[10px] text-muted/30 mt-0.5">
          {new Date(conv.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
        </p>
      </button>
      <button
        onClick={(e) => onDelete(e, conv.id)}
        title="Sil"
        className="opacity-0 group-hover:opacity-100 p-1 mr-1.5 rounded-md text-muted/40 hover:text-red-400 transition-all shrink-0"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
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
      <p className="text-[10px] text-muted/40 uppercase tracking-wider px-2 mb-1.5">{label}</p>
      {items.map((conv) => (
        <ConvItem key={conv.id} conv={conv} onLoad={onLoad} onDelete={onDelete} />
      ))}
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
    <aside className="w-[260px] h-full flex flex-col shrink-0 bg-surface-sidebar border-r border-border">
      {/* New Chat */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={triggerNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gold hover:bg-gold/10 transition-colors font-medium"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Yeni Sohbet
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2 border border-border">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sohbetlerde ara"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted/60 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted/40 hover:text-muted transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-[11px] text-muted/40">Sonuç bulunamadı</p>
          ) : (
            <>
              <p className="text-[10px] text-muted/40 uppercase tracking-wider px-2 mb-2">Sonuçlar</p>
              {filtered.map((conv) => (
                <ConvItem key={conv.id} conv={conv} onLoad={onLoad} onDelete={onDelete} />
              ))}
            </>
          )
        ) : conversations.length === 0 ? (
          <p className="px-2 py-1.5 text-[11px] text-muted/40">Henüz sohbet yok</p>
        ) : (
          <>
            <DateGroup label="Bugün" items={today} onLoad={onLoad} onDelete={onDelete} />
            <DateGroup label="Bu Hafta" items={thisWeek} onLoad={onLoad} onDelete={onDelete} />
            <DateGroup label="Daha Önce" items={earlier} onLoad={onLoad} onDelete={onDelete} />
          </>
        )}
      </div>

      {/* User */}
      <div className="shrink-0 px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gold/15 border border-gold/25 flex items-center justify-center shrink-0">
            <span className="text-gold text-xs font-bold">B</span>
          </div>
          <span className="text-sm text-foreground font-medium">Bero</span>
        </div>
      </div>
    </aside>
  )
}
