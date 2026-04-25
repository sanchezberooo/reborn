'use client'

import { useState, useRef, useEffect } from 'react'
import type { ModuleItem } from '@/lib/modules'
import { parseAction, executeAction } from '@/lib/modules'
import { DEFAULT_PROFILE } from '@/lib/memory'
import { dbLoadProfile, dbLoadMemories, dbLoadModules, dbExecuteAction } from '@/lib/db'

type Msg = { id: string; role: 'user' | 'assistant'; content: string }

function rid() { return Math.random().toString(36).slice(2, 8) }

function stripAction(raw: string): string {
  let s = raw
    .replace(/<REBORN_ACTION>[\s\S]*?<\/REBORN_ACTION>/g, '')
    .replace(/<REBORN_ACTION>[\s\S]*$/, '')
  const TAG = '<REBORN_ACTION>'
  for (let len = TAG.length - 1; len >= 1; len--) {
    if (s.endsWith(TAG.slice(0, len))) { s = s.slice(0, -len); break }
  }
  return s.trim()
}

export default function ModuleChat({ module }: { module: ModuleItem }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ctx, setCtx] = useState<{
    profile: typeof DEFAULT_PROFILE
    memories: unknown[]
    modules: ModuleItem[]
  } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    Promise.all([dbLoadProfile(), dbLoadMemories(), dbLoadModules()])
      .then(([profile, memories, modules]) => setCtx({ profile, memories: memories as unknown[], modules }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function refresh() {
      dbLoadModules().then(mods => setCtx(prev => prev ? { ...prev, modules: mods } : prev)).catch(() => {})
    }
    window.addEventListener('reborn:modules-updated', refresh)
    return () => window.removeEventListener('reborn:modules-updated', refresh)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading || !ctx) return

    const userMsg: Msg = { id: rid(), role: 'user', content: text }
    const aId = rid()
    setMessages(prev => [...prev, userMsg, { id: aId, role: 'assistant', content: '' }])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    let full = ''
    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          profile: ctx.profile,
          memories: ctx.memories,
          modules: ctx.modules,
          activeModule: module,
        }),
      })
      if (!res.body) throw new Error('no body')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value, { stream: true })
        setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: stripAction(full) } : m))
      }
      full += dec.decode() // flush remaining bytes
      console.log('[Reborn ModuleChat] full response:', full.slice(-200))
      const { clean, action } = parseAction(full)
      setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: clean } : m))
      if (action) {
        console.log('[Reborn ModuleChat] executing action:', action)
        executeAction(action)
        window.dispatchEvent(new CustomEvent('reborn:modules-updated'))
        await dbExecuteAction(action).catch((err) => console.error('[Reborn ModuleChat] db error:', err))
      }
    } catch (err) {
      console.error('[Reborn ModuleChat] send error:', err)
      setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: 'Bir hata oluştu.' } : m))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-gold/20 flex items-center justify-center">
          <span className="text-[11px] font-bold text-gold">S</span>
        </div>
        <span className="text-sm font-medium text-foreground">Sanchez</span>
        <span className="text-[10px] text-muted/60 ml-auto">bu modülü düzenleyebilir</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-[11px] text-muted/50 text-center mt-6 leading-relaxed">
            {module.name} modülü hakkında<br />
            Sanchez&apos;e bir şey sor.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] text-[12px] leading-relaxed px-3 py-2 rounded-xl ${
              msg.role === 'user'
                ? 'bg-gold/15 text-foreground'
                : 'bg-surface border border-border text-foreground/90'
            }`}>
              {msg.content || (loading && i === messages.length - 1 ? (
                <span className="flex gap-1">
                  {[0, 1, 2].map(j => (
                    <span key={j} className="w-1 h-1 rounded-full bg-muted/60 animate-bounce" style={{ animationDelay: `${j * 120}ms` }} />
                  ))}
                </span>
              ) : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 pb-3 pt-2">
        <div className="flex gap-2 items-end bg-surface-2 border border-border rounded-xl px-3 py-2 focus-within:border-gold/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Sanchez'e sor..."
            rows={1}
            disabled={!ctx}
            className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted/60 resize-none outline-none leading-relaxed py-0.5 disabled:opacity-40"
            style={{ maxHeight: '100px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || !ctx}
            className="shrink-0 w-6 h-6 rounded-lg bg-gold flex items-center justify-center disabled:opacity-25 hover:opacity-75 transition-opacity"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-background -rotate-90">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
