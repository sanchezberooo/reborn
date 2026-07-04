'use client'

// Sanchez sohbet yüzeyi — UI v1 nötr dil. Görsel katman v0'dan uyarlandı;
// veri/durum mantığı (useSanchezChat, /api/onboarding, streaming protokolü)
// DEĞİŞMEDİ.

import { useRef, useEffect, useState } from 'react'
import { Sparkles, ArrowUp } from 'lucide-react'
import { useSanchezChat } from './useSanchezChat'
import MessageBubble from './Message'

const SUGGESTIONS = [
  'Bugün ne yapmalıyım?',
  'IELTS hazırlığımı değerlendir',
  'Burs başvuru takvimini güncelle',
]

// Onboarding (roadmap ilke 14): klasik kurulum ekranı yok — yeni kullanıcının
// boş sohbet ekranı tanışma davetine dönüşür. Senaryonun kendisi sunucuda
// tetiklenir (api/chat system marker'ı); burada yalnızca giriş metni değişir.
const ONBOARDING_SUGGESTIONS = ['Merhaba Sanchez, tanışalım']

export default function ChatInterface() {
  const { messages, input, setInput, loading, dataLoading, toolStatus, send } = useSanchezChat()
  const [onboarding, setOnboarding] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isEmpty = messages.length === 0

  // Boş ekrana her dönüşte (ilk açılış, yeni sohbet) durumu tazele — ilk goal
  // kaydedildiği anda sunucu false döndürür ve davet bir daha görünmez.
  useEffect(() => {
    if (!isEmpty) return
    fetch('/api/onboarding')
      .then((r) => r.json())
      .then((d) => setOnboarding(Boolean(d.onboarding)))
      .catch(() => setOnboarding(false))
  }, [isEmpty])

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
              className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-primary/40">
            <Sparkles className="size-4 text-primary-foreground" strokeWidth={2} />
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-success" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground">Sanchez</h1>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-3xs font-medium text-muted-foreground">
                Tek muhatabın
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Seni tanıyor, hafızası bağlantılı</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="size-1.5 rounded-full bg-success" />
          Burada
        </div>
      </header>

      {/* Messages */}
      <div className="no-scrollbar flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
            <div className="text-center">
              <p className="text-2xl font-semibold leading-snug text-foreground">
                {onboarding ? 'Hoş geldin. Ben Sanchez.' : 'Seni görmek güzel, Bero.'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {onboarding
                  ? 'Kurulum ekranı yok — tanışarak başlıyoruz.'
                  : 'Ne konuşmak istiyorsun?'}
              </p>
            </div>

            <div className="flex w-full max-w-lg flex-col gap-2">
              {(onboarding ? ONBOARDING_SUGGESTIONS : SUGGESTIONS).map((s) => (
                <button
                  key={s}
                  onClick={() => pickSuggestion(s)}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-6 pb-2 pt-8">
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

      {/* Composer */}
      <div className="border-t border-border px-6 pb-5 pt-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 pl-4 transition-colors focus-within:border-ring/40">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Sanchez'e yaz…"
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
              style={{ maxHeight: '200px' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              aria-label="Gönder"
            >
              <ArrowUp className="size-5" strokeWidth={2} />
            </button>
          </div>

          <p className="mt-2 text-center text-3xs text-muted-foreground/60">
            Enter — gönder · Shift+Enter — yeni satır
          </p>
        </div>
      </div>
    </div>
  )
}
