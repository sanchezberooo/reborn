import { openai, buildSystemPrompt } from '@/lib/openai'
import { dbLoadProfile, dbLoadMemories, dbLoadModules } from '@/lib/db'
import type { ModuleItem } from '@/lib/modules'

export async function POST(req: Request) {
  const { messages, lastConversation, activeModule } = (await req.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    lastConversation?: { role: string; content: string }[]
    activeModule?: ModuleItem
  }

  const data = await Promise.all([
    dbLoadProfile(),
    dbLoadMemories(),
    dbLoadModules(),
  ]).catch(() => null)

  if (!data) {
    return new Response('Bağlantı sorunu. Tekrar dene.', { status: 503 })
  }

  const [profile, memories, modules] = data
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
