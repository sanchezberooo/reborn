import { openai, buildSystemPrompt } from '@/lib/openai'
import type { BeroProfile, Memory } from '@/lib/memory'
import type { ModuleItem } from '@/lib/modules'

export async function POST(req: Request) {
  const { messages, profile, memories, modules, lastConversation, activeModule } = (await req.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    profile: BeroProfile
    memories: Memory[]
    modules: ModuleItem[]
    lastConversation?: { role: string; content: string }[]
    activeModule?: ModuleItem
  }

  const systemPrompt = buildSystemPrompt(profile, memories, modules, lastConversation, activeModule)

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
    max_tokens: 2048,
  })

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
