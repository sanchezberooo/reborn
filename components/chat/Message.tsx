import type { Message } from '@/lib/types'

interface Props {
  message: Message
  isStreaming?: boolean
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`
          shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
          ${isUser
            ? 'bg-surface-3 text-foreground'
            : 'bg-gold text-background font-display'
          }
        `}
      >
        {isUser ? 'B' : 'S'}
      </div>

      {/* Bubble */}
      <div
        className={`
          max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-surface-2 text-foreground rounded-tr-sm'
            : 'bg-surface text-foreground rounded-tl-sm border border-border'
          }
        `}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-gold ml-0.5 animate-pulse rounded-sm align-middle" />
        )}
      </div>
    </div>
  )
}
