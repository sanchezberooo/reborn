'use client'

import { useState, useRef, useEffect } from 'react'
import { useSanchezChat } from './useSanchezChat'
import MessageBubble from './Message'

function randomId() {
  return Math.random().toString(36).slice(2, 9)
}

const SUGGESTIONS = [
  'Bugün ne yapmalıyım?',
  'IELTS hazırlığımı değerlendir',
  'Burs başvuru takvimini güncelle',
]

export default function ChatInterface() {
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([])

  function showToast(text: string) {
    const id = randomId()
    setToasts((p) => [...p, { id, text }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000)
  }

  const { messages, input, setInput, loading, dataLoading, toolStatus, send } = useSanchezChat({ notify: showToast })

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
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
                statusLabel={toolStatus}
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
