'use client'

import { useState, useRef, useEffect } from 'react'
import { useSanchezChat } from './useSanchezChat'

export default function MiniChat() {
  const [open, setOpen] = useState(true)
  const { messages, input, setInput, loading, toolStatus, send } = useSanchezChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return
    await send()
    inputRef.current?.focus()
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      {/* Chat window */}
      {open && (
        <div
          style={{
            width: 320,
            height: 420,
            background: '#111111',
            border: '1px solid #222222',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid #222222',
              background: 'rgba(255,255,255,0.04)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.20)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#f5f5f5' }}>
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <p style={{ color: '#f5f5f5', fontSize: 13, fontWeight: 600, lineHeight: 1, margin: 0 }}>Sanchez</p>
                <p style={{ color: '#a0a0a0', fontSize: 10, lineHeight: 1, marginTop: 3 }}>Mini asistan · Anthropic</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                color: '#a0a0a0',
                fontSize: 20,
                lineHeight: 1,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 20 }}>
                <p style={{ color: '#f5f5f5', fontSize: 22, marginBottom: 8 }}>✦</p>
                <p style={{ color: '#a0a0a0', fontSize: 12, lineHeight: 1.5 }}>
                  Merhaba! Reborn hakkında<br />sana yardımcı olabilirim.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '7px 11px',
                    borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    background: m.role === 'user' ? 'rgba(255,255,255,0.10)' : '#1a1a1a',
                    border: `1px solid ${m.role === 'user' ? 'rgba(255,255,255,0.20)' : '#222222'}`,
                    color: '#ffffff',
                    fontSize: 12,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {m.content
                    ? (
                      <>
                        {m.content}
                        {loading && i === messages.length - 1 && toolStatus && (
                          <span style={{ display: 'block', marginTop: 4, color: '#a3a3a3', fontSize: 10 }}>
                            Sanchez {toolStatus}…
                          </span>
                        )}
                      </>
                    )
                    : loading && i === messages.length - 1
                    ? (
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', height: 16 }}>
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {[0, 1, 2].map((j) => (
                            <span
                              key={j}
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                background: '#f5f5f5',
                                animation: 'minichat-bounce 1s ease-in-out infinite',
                                animationDelay: `${j * 150}ms`,
                                display: 'inline-block',
                              }}
                            />
                          ))}
                        </span>
                        <span style={{ color: '#a0a0a0', fontSize: 10 }}>
                          {toolStatus ? `Sanchez ${toolStatus}…` : 'Sanchez düşünüyor…'}
                        </span>
                      </span>
                    )
                    : ''}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '8px 10px',
              borderTop: '1px solid #222222',
              flexShrink: 0,
              background: '#111111',
            }}
          >
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Mesajını yaz..."
                disabled={loading}
                style={{
                  flex: 1,
                  background: '#0a0a0a',
                  border: '1px solid #222222',
                  borderRadius: 8,
                  padding: '6px 10px',
                  color: '#ffffff',
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  width: 30,
                  height: 30,
                  background: input.trim() && !loading ? '#f5f5f5' : '#1e1e1e',
                  borderRadius: 7,
                  border: 'none',
                  cursor: input.trim() && !loading ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.15s',
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={input.trim() && !loading ? '#0a0a0a' : '#555'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? 'Kapat' : 'Sanchez Mini'}
        style={{
          width: 46,
          height: 46,
          background: open ? '#1a1a1a' : '#f5f5f5',
          border: open ? '1px solid #222222' : 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: open ? 'none' : '0 4px 20px rgba(255,255,255,0.25)',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a0a0a0" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#0a0a0a' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        )}
      </button>

      <style>{`
        @keyframes minichat-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
