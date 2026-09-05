import { describe, expect, it } from 'vitest'

// Şema-türetilmiş mock fixture testi (Paket C1 / TASK C1.1 + C1.5).
// SAF — DB/env/LLM yok, CI'da her zaman koşar.
//
// Korunan sözleşme: fixture DETERMİNİSTİK (roadmap ilke 14) ve ajanın kendi
// şemasını SAĞLAR — yani mock koşusu da VERIFY'ı geçer.

process.env.AI_PROVIDER = 'mock'

import type { OutputShape } from '../agents/types'
import { verifyAgentOutput } from '../agents/verify'
import { buildSchemaFixture, MOCK_FIELD_PREFIX } from './schema-fixture'

const SHAPE: OutputShape = {
  baslik: 'string',
  sayi: 'number',
  bayrak: 'boolean',
  liste: 'array',
  nesne: 'object',
}

describe('buildSchemaFixture', () => {
  it('her tip için doğru tipte değer üretir', () => {
    const fixture = buildSchemaFixture(SHAPE)
    expect(typeof fixture.baslik).toBe('string')
    expect(typeof fixture.sayi).toBe('number')
    expect(typeof fixture.bayrak).toBe('boolean')
    expect(Array.isArray(fixture.liste)).toBe(true)
    expect(fixture.nesne).toEqual({})
  })

  it('metin alanları mock kökenini taşır (gerçek veri sanılmasın)', () => {
    expect(buildSchemaFixture(SHAPE).baslik).toContain(MOCK_FIELD_PREFIX)
  })

  it('DETERMİNİSTİK: aynı şema her zaman aynı fixture', () => {
    expect(buildSchemaFixture(SHAPE)).toEqual(buildSchemaFixture(SHAPE))
    // Ayrı çağrılar arasında tarih/sayaç/rastgelelik sızmamalı:
    expect(JSON.stringify(buildSchemaFixture(SHAPE)))
      .toBe(JSON.stringify(buildSchemaFixture(SHAPE)))
  })

  it('mock işareti zarfta kalır (mevcut testler buna bakıyor)', () => {
    expect(buildSchemaFixture(SHAPE).mock).toBe(true)
  })

  it('şema aynı adda alan tanımlarsa SÖZLEŞME kazanır', () => {
    expect(buildSchemaFixture({ mock: 'string' }).mock).toContain(MOCK_FIELD_PREFIX)
  })

  it('alternatif şekiller verilirse İLK şekil seçilir (determinizm)', () => {
    const fixture = buildSchemaFixture([
      { processed: 'array', skipped: 'array', summary: 'string' },
      { mode: 'string', sourceUrl: 'string', report: 'string' },
    ])
    expect(fixture).toHaveProperty('processed')
    expect(fixture).not.toHaveProperty('report')
  })

  it('üretilen fixture ajanın kendi şemasını GEÇER (C1.1\'in amacı)', () => {
    const result = verifyAgentOutput({
      output: buildSchemaFixture(SHAPE),
      outputSchema: SHAPE,
    })
    expect(result.passed).toBe(true)
  })

  it('alternatif şemalı ajanda da verify geçer (knowledge-agent deseni)', () => {
    const alternatives: OutputShape[] = [
      { processed: 'array', skipped: 'array', summary: 'string' },
      { mode: 'string', sourceUrl: 'string', report: 'string' },
    ]
    expect(verifyAgentOutput({
      output: buildSchemaFixture(alternatives),
      outputSchema: alternatives,
    }).passed).toBe(true)
  })
})

describe('MockProvider — sözleşme farkındalığı', () => {
  it('şemalı ajanın persona\'sı verilince fixture şemadan türer', async () => {
    const { MockProvider } = await import('./mock')
    const { registerAgent, unregisterAgent } = await import('../agents/registry')

    // Geçici ajan: mekanizmayı roster'ın o anki içeriğinden BAĞIMSIZ sınar.
    const agent = registerAgent({
      name: 'fixture-probe-agent',
      displayName: 'Fixture Probe',
      department: 'operations',
      persona: 'Fixture probe ajanı — şema-türetilmiş fixture sınaması.',
      toolNames: [],
      moduleTarget: null,
      outputContract: '{ "ozet": string, "maddeler": array }',
      outputSchema: { ozet: 'string', maddeler: 'array' },
    })

    try {
      const turn = await new MockProvider().complete({
        system: agent.persona,
        messages: [{ role: 'user', content: '{"objective":"test"}' }],
      })
      const output = JSON.parse(turn.text) as Record<string, unknown>

      expect(output.ozet).toContain(MOCK_FIELD_PREFIX)
      expect(output.maddeler).toEqual([])
      expect(verifyAgentOutput({ output, outputSchema: agent.outputSchema }).passed).toBe(true)
    } finally {
      unregisterAgent('fixture-probe-agent')
    }
  })

  it('ŞEMASIZ ajan eski davranışı korur (jenerik fixture)', async () => {
    const { MockProvider } = await import('./mock')
    const { AGENTS } = await import('../agents/registry')

    const agent = AGENTS['test-agent']
    expect(agent.outputSchema).toBeUndefined()

    const turn = await new MockProvider().complete({
      system: agent.persona,
      messages: [{ role: 'user', content: '{"probe":true}' }],
    })
    const output = JSON.parse(turn.text) as Record<string, unknown>

    expect(output).toMatchObject({ mock: true })
    expect(output.note).toContain('MockProvider')
    // Şemasız ajanda şema kontrolü atlanır, verify yine geçer:
    expect(verifyAgentOutput({ output, outputSchema: agent.outputSchema }).passed).toBe(true)
  })

  it('tanınmayan system prompt (Sanchez/özet) jenerik fixture\'a düşer', async () => {
    const { MockProvider } = await import('./mock')
    const turn = await new MockProvider().complete({
      system: 'Hiçbir ajana ait olmayan bir system prompt.',
      messages: [{ role: 'user', content: 'merhaba' }],
    })
    expect(JSON.parse(turn.text)).toMatchObject({ mock: true })
  })
})
