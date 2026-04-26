'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Message } from '@/lib/types'
import type { BeroProfile } from '@/lib/memory'
import type { Memory } from '@/lib/memory'
import type { ModuleItem } from '@/lib/modules'
import { DEFAULT_PROFILE } from '@/lib/memory'
import { executeAction, loadModules } from '@/lib/modules'
import type { ActionType } from '@/lib/modules'
import { saveMemory } from '@/lib/memory'
import {
  dbLoadProfile,
  dbLoadMemories,
  dbSaveMemory,
  dbLoadModules,
  dbExecuteAction,
  dbSaveConversation,
  dbLoadConversations,
  dbLoadConversation,
  dbMigrateModules,
} from '@/lib/db'
import type { ConversationMessage } from '@/lib/db'
import MessageBubble from './Message'

function randomId() {
  return Math.random().toString(36).slice(2, 9)
}

// Executes every REBORN_ACTION in text (localStorage) and returns cleaned display string
function cleanResponse(text: string): string {
  const actionRegex = /<REBORN_ACTION>([\s\S]*?)<\/REBORN_ACTION>/g
  let match
  while ((match = actionRegex.exec(text)) !== null) {
    try {
      const action = JSON.parse(match[1]) as ActionType
      executeAction(action)
    } catch (e) {
      console.error('Action parse error:', e)
    }
  }
  return text.replace(/<REBORN_ACTION>[\s\S]*?<\/REBORN_ACTION>/g, '').trim()
}

function stripAction(raw: string): string {
  let s = raw
    .replace(/<REBORN_ACTION>[\s\S]*?<\/REBORN_ACTION>/g, '')
    .replace(/<REBORN_ACTION>[\s\S]*$/, '')
  const TAG = '<REBORN_ACTION>'
  for (let len = TAG.length - 1; len >= 1; len--) {
    if (s.endsWith(TAG.slice(0, len))) {
      s = s.slice(0, s.length - len)
      break
    }
  }
  return s.trim()
}

const SUGGESTIONS = [
  'Bugün ne yapmalıyım?',
  'IELTS hazırlığımı değerlendir',
  'Burs başvuru takvimini güncelle',
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [profile, setProfile] = useState<BeroProfile>(DEFAULT_PROFILE)
  const [memories, setMemories] = useState<Memory[]>([])
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [lastConversation, setLastConversation] = useState<ConversationMessage[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const conversationIdRef = useRef<string | null>(null)
  const newChatRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function load() {
      try {
        const [prof, mems, mods] = await Promise.all([
          dbLoadProfile(),
          dbLoadMemories(),
          dbLoadModules(),
        ])
        setProfile(prof)
        setMemories(mems)
        setModules(mods)
        dbMigrateModules().catch(() => {})

        // Restore active conversation from localStorage
        const savedId = localStorage.getItem('reborn:active-conversation')
        if (savedId) {
          conversationIdRef.current = savedId
          const msgs = await dbLoadConversation(savedId).catch(() => null)
          if (msgs && msgs.length > 0) {
            setMessages(msgs.map((m) => ({
              id: randomId(),
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: new Date(),
            })))
          }
        } else {
          // No active conversation — load last one for cross-session context
          const convs = await dbLoadConversations().catch(() => [])
          if (convs.length > 0) {
            const msgs = await dbLoadConversation(convs[0].id).catch(() => null)
            if (msgs && msgs.length > 0) {
              setLastConversation(msgs.slice(-8))
            }
          }
        }
      } catch {} finally {
        setDataLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => { newChatRef.current = newChat })

  useEffect(() => {
    const handler = () => newChatRef.current()
    window.addEventListener('reborn:new-chat', handler)
    return () => window.removeEventListener('reborn:new-chat', handler)
  }, [])

  // Listen for conversation load from sidebar
  useEffect(() => {
    async function handler(e: Event) {
      const { id } = (e as CustomEvent<{ id: string }>).detail
      const msgs = await dbLoadConversation(id).catch(() => null)
      if (!msgs) return
      const loaded: Message[] = msgs.map((m) => ({
        id: randomId(),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(),
      }))
      setMessages(loaded)
      conversationIdRef.current = id
      localStorage.setItem('reborn:active-conversation', id)
    }
    window.addEventListener('reborn:load-conversation', handler)
    return () => window.removeEventListener('reborn:load-conversation', handler)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function showToast(text: string) {
    const id = randomId()
    setToasts((p) => [...p, { id, text }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000)
  }

  const finalizeMessage = useCallback(async (
    sessionId: string,
    completedMessages: Message[],
  ) => {
    const title = completedMessages.find((m) => m.role === 'user')?.content.slice(0, 80) ?? 'Sohbet'
    const msgList = completedMessages.map((m) => ({ role: m.role, content: m.content }))
    await dbSaveConversation(sessionId, title, msgList).catch(() => {})
    window.dispatchEvent(new CustomEvent('reborn:conversation-saved'))
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    // Lazily create conversation ID on first message, persist across page loads
    if (!conversationIdRef.current) {
      conversationIdRef.current = crypto.randomUUID()
      localStorage.setItem('reborn:active-conversation', conversationIdRef.current)
    }
    const sessionId = conversationIdRef.current
    const userMsg: Message = { id: randomId(), role: 'user', content: text, timestamp: new Date() }
    const aId = randomId()
    const assistantMsg: Message = { id: aId, role: 'assistant', content: '', timestamp: new Date() }

    setMessages((p) => [...p, userMsg, assistantMsg])
    setInput('')
    setLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Immediately create conversation so sidebar updates before response arrives
    if (messages.length === 0) {
      dbSaveConversation(sessionId, text.slice(0, 40), [{ role: 'user', content: text }]).catch(() => {})
      window.dispatchEvent(new CustomEvent('reborn:conversation-saved'))
    }

    let full = ''
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          profile,
          memories,
          modules,
          // Only send lastConversation context on the first message of a new session
          lastConversation: messages.length === 0 ? lastConversation : undefined,
        }),
      })
      if (!res.body) throw new Error('no body')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value, { stream: true })
        setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: stripAction(full) } : m))
      }
      // Flush remaining bytes then log tail for debugging
      full += dec.decode()
      console.log('[Reborn] response tail:', full.slice(-200))

      // 1. Execute all actions + get clean display text
      const clean = cleanResponse(full)

      // 2. Update display — no tags
      setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: clean } : m))

      // 3. Refresh modules state from localStorage (executeAction already wrote it)
      setModules(loadModules())
      window.dispatchEvent(new CustomEvent('reborn:modules-updated'))

      // 4. Supabase sync + toast for each action found
      const syncRegex = /<REBORN_ACTION>([\s\S]*?)<\/REBORN_ACTION>/g
      const actionLabels: Record<string, string> = {
        CREATE_MODULE:     '✅ Modül oluşturuldu',
        DELETE_MODULE:     '− Modül silindi',
        REMOVE_MODULE:     '− Modül silindi',
        UPDATE_MODULE_META:'✎ Modül düzenlendi',
        REORDER_MODULES:   '↕ Sıra güncellendi',
        UPDATE_MODULE:     '✎ Güncellendi',
        ADD_FIELD:         '+ Alan eklendi',
        UPDATE_FIELD:      '✎ Alan güncellendi',
        ADD_ITEM_TO_FIELD: '+ Eklendi',
        APPEND_TO_FIELD:   '+ Kayıt eklendi',
        REMOVE_ITEM:       '− Silindi',
        CLEAR_FIELD:       '🗑 Temizlendi',
      }
      let syncMatch
      while ((syncMatch = syncRegex.exec(full)) !== null) {
        try {
          const action = JSON.parse(syncMatch[1]) as ActionType
          showToast(actionLabels[action.type] ?? 'Kaydedildi')
          dbExecuteAction(action).catch((err) => {
            console.error('[Reborn] db action error:', err)
            showToast('⚠ Bulut kaydı başarısız')
          })
        } catch (err) {
          console.error('[Reborn] action sync error:', err)
        }
      }

      // 5. Save conversation
      const completedMessages: Message[] = [
        ...messages,
        userMsg,
        { id: aId, role: 'assistant', content: clean, timestamp: new Date() },
      ]
      await finalizeMessage(sessionId, completedMessages)
    } catch (err) {
      console.error('[Reborn] send error:', err)
      setMessages((p) =>
        p.map((m) => m.id === aId ? { ...m, content: 'Bir hata oluştu. Tekrar dene.' } : m)
      )
    } finally {
      setLoading(false)
    }
  }

  async function newChat() {
    if (messages.length < 1 || summarizing) return
    setSummarizing(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      const { summary } = await res.json()
      if (summary) {
        saveMemory(summary)
        await dbSaveMemory(summary).catch(() => {})
        setMemories(await dbLoadMemories())
        window.dispatchEvent(new CustomEvent('reborn:new-memory'))
      }
    } catch {} finally {
      setSummarizing(false)
      setMessages([])
      conversationIdRef.current = null
      localStorage.removeItem('reborn:active-conversation')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  function pickSuggestion(s: string) {
    setInput(s)
    textareaRef.current?.focus()
  }

  if (dataLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gold/50 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
            <div className="flex flex-col items-center gap-3">
              <div className="text-center">
                <p className="font-display text-foreground text-2xl font-semibold leading-snug">Seni görmek güzel, Bero.</p>
                <p className="text-muted text-sm mt-2">Ne konuşmak istiyorsun?</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => pickSuggestion(s)}
                  className="text-left text-sm text-muted bg-surface border border-border rounded-xl px-4 py-3 hover:border-gold/40 hover:text-foreground transition-all duration-150"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full px-5 pt-8 pb-2">
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={loading && i === messages.length - 1 && msg.role === 'assistant'}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-4 pb-5 pt-3">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-end gap-3 bg-surface-2 border border-border rounded-2xl px-4 py-3 focus-within:border-gold/40 transition-colors duration-150 shadow-xl shadow-black/30">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Sanchez'e yaz..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/60 resize-none outline-none leading-relaxed py-0.5"
              style={{ maxHeight: '200px' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="shrink-0 w-8 h-8 rounded-xl bg-gold flex items-center justify-center transition-all duration-150 disabled:opacity-25 hover:opacity-75 active:scale-95"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-background -rotate-90"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>

          <p className="text-center text-[10px] text-muted/40 mt-2">
            Enter — gönder · Shift+Enter — yeni satır
          </p>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-24 right-5 flex flex-col gap-2 pointer-events-none z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-surface border border-gold/25 text-gold text-xs px-3 py-2 rounded-lg shadow-xl"
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}
