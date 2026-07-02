import { openai } from '@/lib/openai-client'

export async function POST(req: Request) {
  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }

  if (messages.length < 2) {
    return Response.json({ summary: null })
  }

  // Fallback: if no OpenAI key, use the first user message as the summary
  if (!process.env.OPENAI_API_KEY) {
    const firstUser = messages.find((m) => m.role === 'user')
    return Response.json({ summary: firstUser?.content.slice(0, 200) ?? null })
  }

  const conversation = messages
    .map((m) => `${m.role === 'user' ? 'Bero' : 'Sanchez'}: ${m.content}`)
    .join('\n')

  try {
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
  } catch {
    // OpenAI call failed — fall back to first user message
    const firstUser = messages.find((m) => m.role === 'user')
    return Response.json({ summary: firstUser?.content.slice(0, 200) ?? null })
  }
}
