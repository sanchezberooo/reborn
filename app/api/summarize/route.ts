import { openai } from '@/lib/openai'

export async function POST(req: Request) {
  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }

  if (messages.length < 2) {
    return Response.json({ summary: null })
  }

  const conversation = messages
    .map((m) => `${m.role === 'user' ? 'Bero' : 'Sanchez'}: ${m.content}`)
    .join('\n')

  const result = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'Aşağıdaki sohbeti 1-2 cümleyle Türkçe özetle. Bero ne hakkında konuştu, ne öğrendi veya ne kararlaştırdı? Özet bilgi yoğun ve net olsun.',
      },
      { role: 'user', content: conversation },
    ],
    max_tokens: 200,
  })

  const summary = result.choices[0]?.message?.content ?? null
  return Response.json({ summary })
}
