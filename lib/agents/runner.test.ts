import { describe, expect, it } from 'vitest'
import { parseAgentOutput } from './runner'

describe('parseAgentOutput', () => {
  it('temiz JSON metnini doğrudan parse eder', () => {
    const result = parseAgentOutput('{"ok": true, "value": 42}')
    expect(result).toEqual({ ok: true, value: 42 })
  })

  it('```json kod bloğuyla sarmalanmış JSON\'ı ayıklar', () => {
    const text = '```json\n{"ok": true, "items": [1, 2, 3]}\n```'
    const result = parseAgentOutput(text)
    expect(result).toEqual({ ok: true, items: [1, 2, 3] })
  })

  it('```(dilsiz) kod bloğuyla sarmalanmış JSON\'ı da ayıklar', () => {
    const text = '```\n{"a": 1}\n```'
    const result = parseAgentOutput(text)
    expect(result).toEqual({ a: 1 })
  })

  it('açıklama metniyle çevrelenmiş, iç içe süslü parantezli JSON\'ı ilk { ile son } arasından ayıklar', () => {
    const text = 'İşte sonuç:\n{"outer": {"inner": {"deep": true}}, "list": [{"x": 1}]}\nUmarım işine yarar.'
    const result = parseAgentOutput(text)
    expect(result).toEqual({ outer: { inner: { deep: true } }, list: [{ x: 1 }] })
  })

  it('bozuk/parse edilemeyen çıktıda parseError fallback döner, veri kaybetmez', () => {
    const text = 'Bu bir JSON değil { henüz bitmemiş'
    const result = parseAgentOutput(text) as { parseError: boolean; rawLength: number; raw: string }
    expect(result.parseError).toBe(true)
    expect(result.rawLength).toBe(text.length)
    expect(result.raw).toBe(text)
  })

  it('hiç süslü parantez içermeyen metinde de parseError fallback döner', () => {
    const text = 'sadece düz metin, hiç JSON yok'
    const result = parseAgentOutput(text) as { parseError: boolean }
    expect(result.parseError).toBe(true)
  })
})
