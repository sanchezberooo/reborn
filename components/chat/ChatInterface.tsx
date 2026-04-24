'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Message } from '@/lib/types'
import type { BeroProfile } from '@/lib/memory'
import type { Memory } from '@/lib/memory'
import type { ModuleItem } from '@/lib/modules'
import { DEFAULT_PROFILE } from '@/lib/memory'
import { parseAction, executeAction } from '@/lib/modules'
import {
  dbLoadProfile,
  dbLoadMemories,
  dbSaveMemory,
  dbLoadModules,
  dbExecuteAction,
  dbSaveMessage,
} from '@/lib/db'
import MessageBubble from './Message'

function randomId() {
  return Math.random().toString(36).slice(2, 9)
}

// Strips complete + partial <REBORN_ACTION> tags from streamed content
function stripAction(raw: string): string {
  let s = raw
    .replace(/<REBORN_ACTION>[\s\S]*?<\/REBORN_ACTION>/g, '')   // complete tag
    .replace(/<REBORN_ACTION>[\s\S]*$/, '')                      // opened, not yet closed
  // Strip any partial prefix of '<REBORN_ACTION>' at end of string
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

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionIdRef = useRef<string>(crypto.randomUUID())

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
      } catch {}
      finally {
        setDataLoading(false)
      }
    }
    load()
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
    assistantId: string,
    rawContent: string,
    sessionId: string,
  ) => {
    const { clean, action } = parseAction(rawContent)
    // Show clean text (no action tags)
    setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, content: clean } : m))
    await dbSaveMessage(sessionId, 'assistant', clean).catch(() => {})

    if (action) {
      // 1. localStorage — always works, immediate UI update
      const updated = executeAction(action)
      setModules(updated)
      window.dispatchEvent(new CustomEvent('reborn:modules-updated'))

      const labels: Record<string, string> = {
        ADD_MODULE: '+ Modül eklendi',
        REMOVE_MODULE: '− Modül silindi',
        UPDATE_MODULE_DATA: '✎ Modül güncellendi',
        ADD_ITEM_TO_FIELD: '+ Eklendi',
      }
      showToast(labels[action.type] ?? 'Kaydedildi')

      // 2. Supabase sync in background — best effort
      dbExecuteAction(action).catch(() => {})
    }
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const sessionId = sessionIdRef.current
    const userMsg: Message = { id: randomId(), role: 'user', content: text, timestamp: new Date() }
    const aId = randomId()
    const assistantMsg: Message = { id: aId, role: 'assistant', content: '', timestamp: new Date() }

    setMessages((p) => [...p, userMsg, assistantMsg])
    setInput('')
    setLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    dbSaveMessage(sessionId, 'user', text).catch(() => {})

    let full = ''
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, profile, memories, modules }),
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
      await finalizeMessage(aId, full, sessionId)
    } catch {
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
        await dbSaveMemory(summary)
        setMemories(await dbLoadMemories())
      }
    } catch {}
    finally {
      setSummarizing(false)
      setMessages([])
      sessionIdRef.current = crypto.randomUUID()
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
          <div className="flex flex-col items-center justify-center h-full gap-7 px-6">
            {/* Avatar + greeting */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <span className="font-display text-gold text-2xl font-bold select-none">S</span>
              </div>
              <div className="text-center">
                <p className="text-foreground font-semibold text-lg leading-tight">
                  {memories.length > 0 ? `Hoş geldin, ${profile.name}` : 'Sanchez hazır'}
                </p>
                <p className="text-muted text-sm mt-1">
                  {memories.length > 0
                    ? `${memories.length} sohbet hafızamda`
                    : 'Ne konuşmak istiyorsun?'}
                </p>
              </div>
            </div>

            {/* Last memory */}
            {memories.length > 0 && (
              <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-4">
                <p className="text-[11px] text-gold font-medium mb-2 uppercase tracking-wide">Son özet</p>
                <p className="text-sm text-muted leading-relaxed">{memories[0].summary}</p>
                <p className="text-[11px] text-muted/40 mt-2">{memories[0].date}</p>
              </div>
            )}

            {/* Suggestions */}
            <div className="flex flex-col gap-2 w-full max-w-md">
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

          {/* New chat button */}
          {!isEmpty && (
            <div className="flex justify-end mb-2.5">
              <button
                onClick={newChat}
                disabled={summarizing}
                className="text-xs text-muted hover:text-foreground disabled:opacity-40 transition-colors flex items-center gap-1.5 group"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:stroke-gold transition-colors">
                  <path d="M12 5v14M5 12l7-7 7 7" />
                </svg>
                {summarizing ? 'Kaydediliyor...' : 'Yeni sohbet'}
              </button>
            </div>
          )}

          {/* Input box */}
          <div className="flex items-end gap-3 bg-surface border border-border rounded-2xl px-4 py-3 focus-within:border-gold/40 transition-colors duration-150 shadow-xl shadow-black/30">
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
