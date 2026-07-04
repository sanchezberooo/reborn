import ChatInterface from '@/components/chat/ChatInterface'
import ContextRail from '@/components/chat/ContextRail'

export default function ChatPage() {
  return (
    <div className="flex h-full min-h-0 w-full">
      <ChatInterface />
      <ContextRail />
    </div>
  )
}
