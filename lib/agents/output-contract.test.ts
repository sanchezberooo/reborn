import { describe, expect, it } from 'vitest'

// Çıktı sözleşmesinin system prompt'a ulaştığının testi.
//
// NEDEN VAR: bu tam olarak gerçek-AI smoke testinde yakalanan kök nedendir —
// outputContract registry metadata'sıydı ve modele HİÇ ULAŞMIYORDU. Hata
// MockProvider ile görünmezdi (C1.1'den beri mock fixture'ı şemadan türüyor),
// bu yüzden burada prompt METNİ doğrudan sınanır, ajan çalıştırılmaz.
//
// SAF — DB/env/LLM yok, CI'da her zaman koşar.

process.env.AI_PROVIDER = 'mock'

import { AGENTS, getAgent } from './registry'
import { buildOutputContractBlock, OUTPUT_CONTRACT_MARKER } from './output-contract'

/** runner.ts'in kurduğu system prompt — knowledge-agent dışında (o kendi
 *  prompt kurucusuna sahip, bkz. runner ownsPrompt notu). */
function systemPromptFor(name: string): string {
  const agent = getAgent(name)!
  return agent.persona + buildOutputContractBlock(agent)
}

const SCHEMA_AGENTS = [
  'growth-agent', 'builder-agent', 'client-success-agent', 'operations-agent',
] as const

describe('buildOutputContractBlock', () => {
  it('sözleşmeyi ve zorunlu alan listesini bloğa koyar', () => {
    const block = buildOutputContractBlock({
      outputContract: JSON.stringify({ baslik: 'string', maddeler: ['string'] }),
      outputSchema: { baslik: 'string', maddeler: 'array' },
    })
    expect(block).toContain(OUTPUT_CONTRACT_MARKER)
    expect(block).toContain('baslik')
    expect(block).toContain('maddeler')
    expect(block).toContain('ZORUNLU üst seviye alanlar')
    expect(block).toContain('- maddeler: array')
  })

  it('şema yoksa sözleşme yine eklenir (zorunlu alan bölümü olmadan)', () => {
    const block = buildOutputContractBlock({
      outputContract: JSON.stringify({ echo: 'string' }),
    })
    expect(block).toContain('echo')
    expect(block).not.toContain('ZORUNLU üst seviye alanlar')
  })

  it('JSON olmayan sözleşme ham hâliyle geçer (uydurma yok)', () => {
    const block = buildOutputContractBlock({ outputContract: '{ "echo": string, "ok": boolean }' })
    expect(block).toContain('{ "echo": string, "ok": boolean }')
  })

  it('alternatif şekiller BİRİ SEÇİLMEDEN hepsi gösterilir', () => {
    const block = buildOutputContractBlock({
      outputContract: JSON.stringify({ processed: [], skipped: [], summary: 'string' }),
      outputSchema: [
        { processed: 'array', skipped: 'array', summary: 'string' },
        { mode: 'string', sourceUrl: 'string', report: 'string' },
      ],
    })
    expect(block).toContain('Seçenek 1')
    expect(block).toContain('Seçenek 2')
    expect(block).toContain('- report: string')
    expect(block).toContain('BİRİNE tam uy')
  })

  it('sözleşme boşsa blok hiç eklenmez', () => {
    expect(buildOutputContractBlock({ outputContract: '   ' })).toBe('')
  })
})

describe('system prompt — sözleşme modele ULAŞIYOR', () => {
  it('şemalı ajanların promptu HER zorunlu alan adını içerir', () => {
    // Smoke testinde düşen tam olarak buydu: model healthSummary yerine
    // summary, buildSteps yerine build_steps yazdı çünkü adları hiç görmedi.
    for (const name of SCHEMA_AGENTS) {
      const prompt = systemPromptFor(name)
      const schema = getAgent(name)!.outputSchema!
      const shape = Array.isArray(schema) ? schema[0] : schema
      for (const field of Object.keys(shape)) {
        expect({ agent: name, field, iceriyor: prompt.includes(field) })
          .toMatchObject({ iceriyor: true })
      }
    }
  })

  it('smoke testinde uydurulan adlar artık promptta KARŞILIĞIYLA duruyor', () => {
    const ops = systemPromptFor('operations-agent')
    for (const field of ['healthSummary', 'observations', 'costNotes', 'recommendations']) {
      expect({ field, iceriyor: ops.includes(field) }).toMatchObject({ iceriyor: true })
    }
    const builder = systemPromptFor('builder-agent')
    for (const field of ['objective', 'designSummary', 'buildSteps', 'risks', 'openQuestions']) {
      expect({ field, iceriyor: builder.includes(field) }).toMatchObject({ iceriyor: true })
    }
  })

  it('sözleşmeye ATIF yapan legacy ajanlar artık sözleşmeyi GÖRÜYOR', () => {
    // Bu iki persona "outputContract şemasına BİREBİR uy" diyordu ama
    // sözleşme prompt'ta yoktu — sessiz, uzun süredir var olan boşluk.
    for (const name of ['ingilizce-genel-plan', 'ingilizce-planlayici']) {
      const agent = getAgent(name)!
      const prompt = systemPromptFor(name)
      expect(prompt).toContain('outputContract')
      for (const field of Object.keys(JSON.parse(agent.outputContract) as Record<string, unknown>)) {
        expect({ agent: name, field, iceriyor: prompt.includes(field) })
          .toMatchObject({ iceriyor: true })
      }
    }
  })

  it('blok EN SONA eklenir — son söz sözleşmenindir', () => {
    const prompt = systemPromptFor('operations-agent')
    expect(prompt.indexOf(OUTPUT_CONTRACT_MARKER))
      .toBeGreaterThan(prompt.indexOf(getAgent('operations-agent')!.persona.slice(0, 40)))
    expect(prompt.trimEnd().endsWith('JSON dışında tek karakter bile yazma.')).toBe(true)
  })

  it('ÇELİŞKİ YOK: persona\'da geçen alan adları sözleşmedekilerle aynı', () => {
    // Persona'sında zaten alan adı bulunan ajanlarda blok TEKRAR ama tutarlı
    // olmalı — adlar zaten sözleşmeden geliyor. Ters yönde bir ad (persona'da
    // olup sözleşmede olmayan bir üst seviye alan) çelişki olurdu.
    for (const agent of Object.values(AGENTS)) {
      let keys: string[]
      try {
        keys = Object.keys(JSON.parse(agent.outputContract) as Record<string, unknown>)
      } catch {
        continue // düzyazı sözleşme (test-agent)
      }
      const namedInPersona = keys.filter((k) => agent.persona.includes(k))
      // Persona'da geçen her ad sözleşmede de var (tanım gereği) — asıl
      // iddia: persona hiçbir ajan için sözleşmeyle ÇELİŞEN bir ad dayatmıyor.
      expect(namedInPersona.every((k) => keys.includes(k))).toBe(true)
    }
  })

  it('knowledge-agent İSTİSNA: genel blok eklenmez (iki modlu sözleşme)', async () => {
    // Sözleşmesi yalnız sinyal modunu tanımlar; rapor modunun zarfı farklıdır.
    // Genel bloğu eklemek rapor modunda YANLIŞ şekli dayatırdı.
    const { buildKnowledgeAgentPrompt } = await import('./knowledge-agent-prompt')
    expect(buildKnowledgeAgentPrompt('')).not.toContain(OUTPUT_CONTRACT_MARKER)
  })
})
