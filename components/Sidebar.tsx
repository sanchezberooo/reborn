'use client'

import { useState, useEffect, useCallback } from 'react'
import { dbLoadConversations, dbLoadConversation } from '@/lib/db'
import type { ConversationMeta } from '@/lib/db'

export default function Sidebar() {
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [search, setSearch] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

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

  async function loadConversation(id: string) {
    if (loadingId) return
    setLoadingId(id)
    try {
      const msgs = await dbLoadConversation(id)
      if (msgs && msgs.length > 0) {
        window.dispatchEvent(new CustomEvent('reborn:load-conversation', { detail: { id } }))
      }
    } finally {
      setLoadingId(null)
    }
  }

  const filtered = search
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations

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
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <p className="text-[10px] text-muted/40 uppercase tracking-wider px-2 mb-2">Yakın zamandakiler</p>
        {filtered.length === 0 ? (
          <p className="px-2 py-1.5 text-[11px] text-muted/40">Henüz sohbet yok</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                disabled={loadingId === c.id}
                className="group flex flex-col w-full px-2 py-2 rounded-xl hover:bg-white/[0.04] text-left transition-colors disabled:opacity-50"
              >
                <p className="text-[12px] text-muted group-hover:text-foreground/70 line-clamp-1 leading-snug transition-colors">
                  {c.title}
                </p>
                <p className="text-[10px] text-muted/30 mt-0.5">
                  {new Date(c.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric', month: 'short',
                  })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom: user */}
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
