'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Message } from '@/lib/types'
import {
  dbSaveMemory,
  dbSaveConversation,
  dbLoadConversations,
  dbLoadConversation,
  dbMigrateModules,
} from '@/lib/db'
import type { ConversationMessage } from '@/lib/db'
import type { ChatEvent } from '@/lib/chat-events'
import { toolStatusLabel } from '@/lib/chat-events'

// ─── shared helpers ─────────────────────────────────────────────────────────
// Tek Sanchez, tek hafıza garantisi: ChatInterface ve MiniChat aynı konuşma
// kaydı + hafıza özetleme hattını (bu hook) kullanır — kendi ayrı kopyalarını
// tutmazlar. Bkz. REBORN-DURUM-RAPORU.md §6 madde 3.

function randomId() {
  return Math.random().toString(36).slice(2, 9)
}

export function useSanchezChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [lastConversation, setLastConversation] = useState<ConversationMessage[]>([])
  /** Sanchez şu an bir araç mı çalıştırıyor — "düşünüyor" / "X yapıyor" göstergesi için. null = araç yok. */
  const [toolStatus, setToolStatus] = useState<string | null>(null)

  const conversationIdRef = useRef<string | null>(null)
  const newChatRef = useRef<() => void>(() => {})

  useEffect(() => {
    async function load() {
      try {
        dbMigrateModules().catch(() => {})

        // Restore active conversation from localStorage (paylaşılan anahtar —
        // ChatInterface ve MiniChat aynı "aktif sohbet"i sürdürür)
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
    setToolStatus(null)

    // Immediately create conversation so sidebar updates before response arrives
    if (messages.length === 0) {
      dbSaveConversation(sessionId, text.slice(0, 40), [{ role: 'user', content: text }]).catch(() => {})
      window.dispatchEvent(new CustomEvent('reborn:conversation-saved'))
    }

    let full = ''
    let streamError: string | null = null
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          lastConversation: messages.length === 0 ? lastConversation : undefined,
        }),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      if (!res.body) throw new Error('no body')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += dec.decode(value, { stream: true })

        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl)
          buffer = buffer.slice(nl + 1)
          if (!line) continue

          let event: ChatEvent
          try { event = JSON.parse(line) } catch { continue }

          if (event.type === 'text') {
            full += event.text
            setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: full } : m))
          } else if (event.type === 'tool_start') {
            setToolStatus(toolStatusLabel(event.name))
          } else if (event.type === 'tool_end') {
            setToolStatus(null)
          } else if (event.type === 'error') {
            streamError = event.message
          }
        }
      }
      setToolStatus(null)

      if (streamError) {
        setMessages((p) => p.map((m) => m.id === aId ? { ...m, content: streamError! } : m))
        return
      }

      // Sanchez'in tool çağrıları (update_module vb.) sunucu tarafında zaten
      // uygulandı — burada yalnızca ilgili UI'ları tazelemek için bildiriyoruz.
      window.dispatchEvent(new CustomEvent('reborn:modules-updated'))

      const completedMessages: Message[] = [
        ...messages,
        userMsg,
        { id: aId, role: 'assistant', content: full, timestamp: new Date() },
      ]
      await finalizeMessage(sessionId, completedMessages)
    } catch (err) {
      console.error('[Reborn] send error:', err)
      setMessages((p) =>
        p.map((m) => m.id === aId ? { ...m, content: 'Bir hata oluştu. Tekrar dene.' } : m)
      )
    } finally {
      setLoading(false)
      setToolStatus(null)
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
        await dbSaveMemory(summary).catch(() => {})
        window.dispatchEvent(new CustomEvent('reborn:new-memory'))
      }
    } catch {} finally {
      setSummarizing(false)
      setMessages([])
      conversationIdRef.current = null
      localStorage.removeItem('reborn:active-conversation')
    }
  }

  return {
    messages,
    input,
    setInput,
    loading,
    summarizing,
    dataLoading,
    toolStatus,
    send,
    newChat,
  }
}
