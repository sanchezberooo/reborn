import { getAIProvider } from '@/lib/ai'

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

  try {
    const provider = getAIProvider()
    const turn = await provider.complete({
      // Özet basit/ucuz bir iş — Sanchez'in ana modeli yerine haiku (bkz. registry deseni)
      model: 'claude-haiku-4-5',
      system:
        'Aşağıdaki sohbeti 1-2 cümleyle Türkçe özetle. Bero ne hakkında konuştu, ne öğrendi veya ne kararlaştırdı? Özet bilgi yoğun ve net olsun.',
      messages: [{ role: 'user', content: conversation }],
      maxTokens: 200,
    })

    return Response.json({ summary: turn.text || null })
  } catch {
    // Provider çağrısı başarısız — ilk kullanıcı mesajına düşen zarif fallback
    const firstUser = messages.find((m) => m.role === 'user')
    return Response.json({ summary: firstUser?.content.slice(0, 200) ?? null })
  }
}
