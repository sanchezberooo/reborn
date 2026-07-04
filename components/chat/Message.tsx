import { Sparkles } from 'lucide-react'
import type { Message } from '@/lib/types'

interface Props {
  message: Message
  isStreaming?: boolean
  /** "alışkanlıkları okuyor", "web'de araştırıyor" vb. — null/undefined ise sade "düşünüyor" gösterilir. */
  statusLabel?: string | null
}

function StatusDots() {
  return (
    <span className="inline-flex h-5 items-center gap-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }} />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }} />
    </span>
  )
}

export default function MessageBubble({ message, isStreaming, statusLabel }: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end py-1.5">
        <div className="max-w-[72%] rounded-2xl rounded-br-sm bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  const showStatusRow = isStreaming && (statusLabel || message.content === '')

  return (
    <div className="flex gap-3 py-1.5">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-primary/40">
        <Sparkles className="size-3.5 text-primary-foreground" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5 text-sm leading-7 text-foreground/90">
        <p className="whitespace-pre-wrap">{message.content}</p>
        {showStatusRow && (
          <span className="inline-flex h-5 items-center gap-2 text-xs text-muted-foreground">
            <StatusDots />
            <span>{statusLabel ? `Sanchez ${statusLabel}…` : 'Sanchez düşünüyor…'}</span>
          </span>
        )}
        {isStreaming && message.content !== '' && !statusLabel && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-foreground/60 align-middle" />
        )}
      </div>
    </div>
  )
}
