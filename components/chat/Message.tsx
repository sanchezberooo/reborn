import type { Message } from '@/lib/types'

interface Props {
  message: Message
  isStreaming?: boolean
  /** "alışkanlıkları okuyor", "web'de araştırıyor" vb. — null/undefined ise sade "düşünüyor" gösterilir. */
  statusLabel?: string | null
}

function StatusDots() {
  return (
    <span className="inline-flex gap-1 items-center h-5">
      <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  )
}

export default function MessageBubble({ message, isStreaming, statusLabel }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end py-1.5">
        <div className="max-w-[72%] bg-surface-2 border border-border/60 text-foreground text-sm leading-relaxed px-4 py-3 rounded-2xl rounded-br-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  const showStatusRow = isStreaming && (statusLabel || message.content === '')

  return (
    <div className="flex gap-3 py-1.5">
      <div className="shrink-0 w-7 h-7 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center mt-0.5">
        <span className="text-gold text-xs font-bold font-display">S</span>
      </div>
      <div className="flex-1 min-w-0 text-sm text-foreground/90 leading-7 pt-0.5">
        <p className="whitespace-pre-wrap">{message.content}</p>
        {showStatusRow && (
          <span className="inline-flex gap-2 items-center h-5 text-xs text-muted/70">
            <StatusDots />
            <span>{statusLabel ? `Sanchez ${statusLabel}…` : 'Sanchez düşünüyor…'}</span>
          </span>
        )}
        {isStreaming && message.content !== '' && !statusLabel && (
          <span className="inline-block w-1.5 h-4 bg-gold/60 ml-0.5 animate-pulse rounded-sm align-middle" />
        )}
      </div>
    </div>
  )
}
