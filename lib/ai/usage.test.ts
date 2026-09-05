import { describe, expect, it } from 'vitest'

// Token toplama testi (Paket B / TASK B3 + B5). SAF — DB/env/LLM yok,
// CI'da her zaman koşar.
//
// Korunan sözleşme: "ölçülmedi" (null) ile "sıfır harcandı" (0) ASLA
// karışmamalı. Bu ayrım maliyet görünürlüğünün tamamıdır — MockProvider ile
// koşan bir run'a 0 token yazmak, bedava bir çalıştırma olduğunu iddia eder.

process.env.AI_PROVIDER = 'mock'

import { sumUsage } from './usage'

describe('sumUsage', () => {
  it('birden fazla turu toplar (asıl maliyet turların toplamıdır)', () => {
    expect(sumUsage([
      { inputTokens: 1200, outputTokens: 300 },
      { inputTokens: 1800, outputTokens: 150 },
      { inputTokens: 2400, outputTokens: 90 },
    ])).toEqual({ inputTokens: 5400, outputTokens: 540 })
  })

  it('tek tur aynen döner', () => {
    expect(sumUsage([{ inputTokens: 10, outputTokens: 4 }]))
      .toEqual({ inputTokens: 10, outputTokens: 4 })
  })

  it('hiç ölçüm yoksa null — 0 DEĞİL', () => {
    expect(sumUsage([])).toEqual({ inputTokens: null, outputTokens: null })
    expect(sumUsage([undefined, undefined])).toEqual({ inputTokens: null, outputTokens: null })
  })

  it('gerçekten sıfır harcanmışsa 0 döner (null ile karışmaz)', () => {
    expect(sumUsage([{ inputTokens: 0, outputTokens: 0 }]))
      .toEqual({ inputTokens: 0, outputTokens: 0 })
  })

  it('turların bir kısmı ölçümsüzse eldeki ölçüm çöpe atılmaz', () => {
    expect(sumUsage([
      { inputTokens: 100, outputTokens: 20 },
      undefined,
      { inputTokens: 50, outputTokens: 5 },
    ])).toEqual({ inputTokens: 150, outputTokens: 25 })
  })
})
