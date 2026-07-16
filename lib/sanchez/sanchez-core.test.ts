import { describe, expect, it } from 'vitest'

// Sanchez Core testi — orkestrasyon katmanının davranış sözleşmesini korur:
// 1. Pipeline sözlüğü: aşamalar ve sıraları sabittir (mimari sözleşme).
// 2. Olay protokolü (MockProvider + canlı Supabase): normal turda en az bir
//    text olayı ve SON olay olarak tek 'done'; hata senaryosunda 'error'.
// 3. Tool döngüsü: 'hafıza' senaryosu gerçek read_memories yürütmesiyle
//    tool_start → tool_end(ok) → done zinciri üretir.
// Kullanıcının gerçek verisine YAZAN senaryolar ('kaydet', onboarding onayı)
// bilinçli test edilmez — bu test canlı profile karşı salt okumadır.

// getAIProvider ilk çağrıda cache'ler — core'dan önce mock'a sabitle.
process.env.AI_PROVIDER = 'mock'

import type { ChatEvent } from '../chat-events'
import { SANCHEZ_PIPELINE_STAGES } from './types'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

describe('sanchez pipeline sözlüğü', () => {
  it('aşamalar ve sıraları mimari sözleşmedir — değişiklik bilinçli olmalı', () => {
    expect(SANCHEZ_PIPELINE_STAGES).toEqual([
      'observe', 'understand', 'retrieve', 'reason', 'plan',
      'delegate', 'execute', 'learn', 'brain-update',
    ])
  })
})

describe.skipIf(!hasEnv)('runSanchezTurn (MockProvider + canlı Supabase)', () => {
  async function collectTurn(content: string): Promise<ChatEvent[]> {
    const { runSanchezTurn } = await import('./core')
    const events: ChatEvent[] = []
    await runSanchezTurn(
      { messages: [{ role: 'user', content }] },
      (event) => events.push(event),
    )
    return events
  }

  it('normal tur: en az bir text olayı, son olay tek done, error yok', async () => {
    const events = await collectTurn('Selam, bugün plan ne?')
    expect(events.some((e) => e.type === 'text')).toBe(true)
    expect(events.filter((e) => e.type === 'done')).toHaveLength(1)
    expect(events[events.length - 1].type).toBe('done')
    expect(events.some((e) => e.type === 'error')).toBe(false)
  }, 60_000)

  it("tool döngüsü: 'hafıza' senaryosu tool_start → tool_end(ok) → done zinciri üretir", async () => {
    const events = await collectTurn('hafıza kayıtlarıma bak')
    const toolStart = events.find((e) => e.type === 'tool_start')
    const toolEnd = events.find((e) => e.type === 'tool_end')
    expect(toolStart).toMatchObject({ name: 'read_memories' })
    expect(toolEnd).toMatchObject({ name: 'read_memories', ok: true })
    // Sıra: tool_start, tool_end'den; tool_end, done'dan önce gelir.
    expect(events.findIndex((e) => e.type === 'tool_start')).toBeLessThan(
      events.findIndex((e) => e.type === 'tool_end'),
    )
    expect(events[events.length - 1].type).toBe('done')
  }, 60_000)

  it("hata senaryosu: provider çökse de tur 'error' olayıyla kapanır, fırlatmaz", async () => {
    const events = await collectTurn('hata çıkar bakalım')
    expect(events[events.length - 1].type).toBe('error')
    expect(events.some((e) => e.type === 'done')).toBe(false)
  }, 60_000)
})
