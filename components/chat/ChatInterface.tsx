'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Message } from '@/lib/types'
import type { BeroProfile, Memory } from '@/lib/memory'
import type { ModuleItem } from '@/lib/modules'
import { loadProfile, loadMemories, saveMemory, DEFAULT_PROFILE } from '@/lib/memory'
import { loadModules, executeAction, parseAction } from '@/lib/modules'
import MessageBubble from './Message'

function randomId() {
  return Math.random().toString(36).slice(2, 9)
}

interface ActionToast {
  id: string
  text: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [profile, setProfile] = useState<BeroProfile>(DEFAULT_PROFILE)
  const [memories, setMemories] = useState<Memory[]>([])
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [toasts, setToasts] = useState<ActionToast[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setProfile(loadProfile())
    setMemories(loadMemories())
    const mods = loadModules()
    setModules(mods)

    // ?module=id parametresi varsa input'u ön-doldur
    const params = new URLSearchParams(window.location.search)
    const moduleId = params.get('module')
    if (moduleId) {
      const mod = mods.find((m) => m.id === moduleId)
      if (mod) setInput(`${mod.name} modülü hakkında ne yapmalıyım?`)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function showToast(text: string) {
    const id = randomId()
    setToasts((prev) => [...prev, { id, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }

  const finalizeMessage = useCallback(
    (assistantId: string, rawContent: string) => {
      const { clean, action } = parseAction(rawContent)

      // Temizlenmiş metni mesaja yaz
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: clean } : m))
      )

      // Action varsa çalıştır
      if (action) {
        const updated = executeAction(action)
        setModules(updated)

        const labels: Record<string, string> = {
          ADD_MODULE: '+ Modül eklendi',
          REMOVE_MODULE: '− Modül silindi',
          UPDATE_MODULE_DATA: '✎ Modül güncellendi',
        }
        showToast(labels[action.type] ?? 'Modül değiştirildi')

        // Dashboard'ın yeniden yükleyebilmesi için event at
        window.dispatchEvent(new CustomEvent('reborn:modules-updated'))
      }
    },
    []
  )

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = {
      id: randomId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    const assistantId = randomId()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    let fullContent = ''

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, profile, memories, modules }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullContent += chunk

        // Streaming sırasında action tag'ini gizle ama metni göster
        const displayContent = fullContent
          .replace(/<REBORN_ACTION>[\s\S]*?<\/REBORN_ACTION>/g, '')
          .replace(/<REBORN_ACTION>[\s\S]*$/, '') // henüz kapanmamış tag
          .trim()

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: displayContent } : m
          )
        )
      }

      // Stream bitti — action'ı işle
      finalizeMessage(assistantId, fullContent)
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Bir hata oluştu. Tekrar dene.' }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  async function newChat() {
    if (messages.length < 2 || summarizing) return
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
        setMemories(loadMemories())
      }
    } catch {
      // özet alınamazsa yine de sohbeti temizle
    } finally {
      setSummarizing(false)
      setMessages([])
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
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const memoryCount = memories.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-background text-sm font-semibold font-display">
            S
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Sanchez</p>
            <p className="text-xs text-muted">
              {memoryCount > 0 ? `${memoryCount} sohbet hatırlıyor` : 'AI Mentor · Online'}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={newChat}
            disabled={summarizing}
            className="text-xs text-muted border border-border rounded-lg px-3 py-1.5 hover:text-foreground hover:border-gold transition-colors disabled:opacity-40"
          >
            {summarizing ? 'Kaydediliyor...' : 'Yeni Sohbet'}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-surface-2 border border-border flex items-center justify-center">
              <span className="font-display text-gold text-xl font-semibold">S</span>
            </div>
            <div>
              <p className="font-display text-xl text-foreground mb-1">Sanchez hazır</p>
              <p className="text-muted text-sm max-w-xs">
                {memoryCount > 0
                  ? `${profile.name}'yu tanıyorum. Geçen seferden devam edelim mi?`
                  : 'Burs hedeflerin, modüller, kod — ne istersen konuşalım.'}
              </p>
            </div>

            {memoryCount > 0 && (
              <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-3 text-left">
                <p className="text-xs text-gold mb-2 font-medium">Son sohbet özeti</p>
                <p className="text-xs text-muted leading-relaxed">{memories[0].summary}</p>
                <p className="text-[10px] text-muted mt-1 opacity-50">{memories[0].date}</p>
              </div>
            )}

            <div className="flex flex-col gap-2 mt-1 w-full max-w-sm">
              {[
                'Fitness modülü ekle',
                'IELTS hedefimi 7.5 yap',
                'Bugün ne yapmalıyım?',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus() }}
                  className="text-left text-sm text-muted border border-border rounded-xl px-4 py-3 hover:border-gold hover:text-foreground transition-colors bg-surface"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={loading && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="flex items-end gap-2 bg-surface-2 border border-border rounded-2xl px-4 py-3 focus-within:border-gold transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Sanchez'e yaz..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted resize-none outline-none leading-relaxed"
            style={{ maxHeight: '160px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-xl bg-gold flex items-center justify-center transition-opacity disabled:opacity-30 hover:opacity-80"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-background -rotate-90">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-muted mt-2">
          Enter — gönder · Shift+Enter — yeni satır
        </p>
      </div>

      {/* Action toasts */}
      <div className="fixed bottom-20 right-4 flex flex-col gap-2 pointer-events-none z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-surface-2 border border-gold/30 text-gold text-xs px-3 py-2 rounded-lg shadow-lg animate-fade-in"
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}
