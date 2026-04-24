export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface Agent {
  id: string
  name: string
  description: string
  status: 'active' | 'idle' | 'error'
  lastRun?: Date
  logs: string[]
}

export interface Module {
  id: string
  title: string
  description: string
  icon: string
  color: string
}
