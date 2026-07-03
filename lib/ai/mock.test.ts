import { describe, expect, it } from 'vitest'
import { MockProvider } from './mock'
import type { AIRequest, AIStreamEvent } from './provider'

async function collect(events: AsyncIterable<AIStreamEvent>): Promise<AIStreamEvent[]> {
  const out: AIStreamEvent[] = []
  for await (const e of events) out.push(e)
  return out
}

function req(content: string, extra: Partial<AIRequest> = {}): AIRequest {
  return { system: 'Sen Sanchez\'sin.', messages: [{ role: 'user', content }], ...extra }
}

describe('MockProvider.stream', () => {
  const provider = new MockProvider()

  it('normal sohbet akışında yalnızca text olayları + sonda done(end_turn) üretir', async () => {
    const events = await collect(provider.stream(req('merhaba nasılsın')))

    expect(events.length).toBeGreaterThan(1)
    expect(events.slice(0, -1).every((e) => e.type === 'text')).toBe(true)

    const last = events.at(-1)!
    expect(last.type).toBe('done')
    if (last.type === 'done') {
      expect(last.turn.stopReason).toBe('end_turn')
      expect(last.turn.toolUses).toEqual([])
    }
  })

  it('mesajda "hata" geçtiğinde birkaç text olayından sonra fırlatır', async () => {
    const events: AIStreamEvent[] = []
    await expect(async () => {
      for await (const e of provider.stream(req('bana hata senaryosunu göster'))) {
        events.push(e)
      }
    }).rejects.toThrow(/hata senaryosu/)

    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => e.type === 'text')).toBe(true)
  })

  it('mesajda "araştır"/"web" geçtiğinde tool_start(web_search) → text → done(end_turn) sırasını üretir', async () => {
    const events = await collect(provider.stream(req('bunu araştır lütfen')))

    expect(events[0]).toEqual({ type: 'tool_start', name: 'web_search' })
    expect(events.slice(1, -1).every((e) => e.type === 'text')).toBe(true)

    const last = events.at(-1)!
    expect(last.type).toBe('done')
    if (last.type === 'done') {
      expect(last.turn.stopReason).toBe('end_turn')
      expect(last.turn.toolUses).toEqual([])
    }
  })

  it('mesajda "hafıza" geçtiğinde ilk turda gerçek read_memories tool çağrısı ister (tool_use)', async () => {
    const events = await collect(provider.stream(req('hafızamda ne var')))

    const toolStarts = events.filter((e) => e.type === 'tool_start')
    expect(toolStarts).toEqual([{ type: 'tool_start', name: 'read_memories' }])

    const last = events.at(-1)!
    expect(last.type).toBe('done')
    if (last.type === 'done') {
      expect(last.turn.stopReason).toBe('tool_use')
      expect(last.turn.toolUses).toEqual([
        { id: 'mock-tool-use-1', name: 'read_memories', input: { limit: 5 } },
      ])
    }
  })

  it('hafıza senaryosunda tool_results geldikten sonra 2. tur normal cevap üretir (end_turn)', async () => {
    const secondTurnReq = req('hafızamda ne var', {
      messages: [
        { role: 'user', content: 'hafızamda ne var' },
        { role: 'assistant', content: 'Hafızama bakıyorum... ', raw: undefined },
        {
          role: 'tool_results',
          results: [{ toolUseId: 'mock-tool-use-1', content: '[]' }],
        },
      ],
    })

    const events = await collect(provider.stream(secondTurnReq))

    expect(events.some((e) => e.type === 'tool_start')).toBe(false)
    const last = events.at(-1)!
    expect(last.type).toBe('done')
    if (last.type === 'done') {
      expect(last.turn.stopReason).toBe('end_turn')
    }
  })
})

describe('MockProvider.complete', () => {
  const provider = new MockProvider()

  it('system promptu "özetle" içeriyorsa özet fixture döner (hata kelimesi olsa bile)', async () => {
    const turn = await provider.complete({
      system: 'Aşağıdaki sohbeti özetle.',
      messages: [{ role: 'user', content: 'hata hata hata' }],
    })
    expect(turn.stopReason).toBe('end_turn')
    expect(turn.text).toContain('özet')
  })

  it('"hata" geçen normal (ajan) istekte fırlatır', async () => {
    await expect(provider.complete(req('hata ver'))).rejects.toThrow(/hata senaryosu/)
  })

  it('diğer isteklerde parse edilebilir JSON döner', async () => {
    const turn = await provider.complete(req('normal ajan girdisi'))
    expect(turn.stopReason).toBe('end_turn')
    expect(() => JSON.parse(turn.text)).not.toThrow()
  })
})
