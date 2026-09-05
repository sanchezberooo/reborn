import { describe, expect, it } from 'vitest'

// Brain yazma kuralları testi (Paket C1 / TASK C1.3 + C1.5).
//
// TAMAMEN SAF — DB/env/LLM yok, CI'da HER ZAMAN koşar (canUseTool ve verify
// deseni). Brain'e ne yazılacağı kararı, yazmanın kendisinden bilinçli
// ayrıldığı için DB'siz sınanabiliyor.

process.env.AI_PROVIDER = 'mock'

import type { DepartmentId } from '../departments/types'
import {
  AGENT_REUSABILITY_FLOOR,
  REVIEW_THRESHOLD,
  computeAgentOutputQuality,
} from '../knowledge/quality'
import {
  BRAIN_CANDIDATES_FIELD,
  MAX_CANDIDATES_PER_RUN,
  canContributeToBrain,
  decideHarvest,
  parseCandidates,
} from './brain-harvest'

/** Kalite kapısını rahatça geçen, gerçekten tekrar kullanılabilir bir aday. */
const GOOD_CANDIDATE = {
  type: 'pattern',
  title: 'Kuyruk doygunluğunda geri basınç deseni',
  content:
    'Kuyruk derinliği worker kapasitesinin iki katını aştığında yeni görev kabulü '
    + 'yavaşlatılmalı. Aksi halde retry fırtınası doğuyor ve kuyruk kendini '
    + 'besleyerek büyüyor. Bu desen tick tabanlı her worker için geçerlidir ve '
    + 'kuyruk derinliği ile worker sayısı arasındaki oran izlenerek uygulanır.',
  reusable: true,
}

function outputWith(candidates: unknown) {
  return { scope: 'test', [BRAIN_CANDIDATES_FIELD]: candidates }
}

// ── Aday ayıklama ───────────────────────────────────────────────────────────

describe('parseCandidates — çıktının TAMAMI aday değildir', () => {
  it('yalnız işaretlenmiş alan okunur, diğer alanlar aday sayılmaz', () => {
    const { candidates } = parseCandidates({
      healthSummary: 'Bu metin Brain\'e girmemeli — işaretlenmemiş.',
      recommendations: ['bu da değil'],
      [BRAIN_CANDIDATES_FIELD]: [GOOD_CANDIDATE],
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].title).toBe(GOOD_CANDIDATE.title)
  })

  it('alan yoksa aday da yoktur (sessiz — ajanların çoğu yazmaz)', () => {
    expect(parseCandidates({ healthSummary: 'x' }).candidates).toEqual([])
    expect(parseCandidates({}).candidates).toEqual([])
    expect(parseCandidates(null).candidates).toEqual([])
  })

  it('geçersiz tip reddedilir, geçerli adaylar hayatta kalır', () => {
    const { candidates, invalid } = parseCandidates(outputWith([
      { ...GOOD_CANDIDATE, type: 'olmayan_tip' },
      GOOD_CANDIDATE,
    ]))
    expect(candidates).toHaveLength(1)
    expect(invalid[0].reason).toContain('olmayan_tip')
  })

  it('boş içerikli aday reddedilir', () => {
    const { candidates, invalid } = parseCandidates(outputWith([
      { ...GOOD_CANDIDATE, content: '   ' },
    ]))
    expect(candidates).toHaveLength(0)
    expect(invalid[0].reason).toContain('boş')
  })

  it('aday sayısı sınırlanır (damıtma disiplini)', () => {
    const many = Array.from({ length: 12 }, () => GOOD_CANDIDATE)
    const { candidates, invalid } = parseCandidates(outputWith(many))
    expect(candidates).toHaveLength(MAX_CANDIDATES_PER_RUN)
    expect(invalid.some((i) => i.reason.includes(String(MAX_CANDIDATES_PER_RUN)))).toBe(true)
  })

  it('dizi olmayan alan reddedilir', () => {
    const { candidates, invalid } = parseCandidates(outputWith({ type: 'fact' }))
    expect(candidates).toHaveLength(0)
    expect(invalid[0].reason).toContain('dizi')
  })
})

// ── Departman yetkisi ───────────────────────────────────────────────────────

describe('canContributeToBrain — default-deny', () => {
  it('yetkili departmanlar katkı yapabilir', () => {
    const allowed: DepartmentId[] = ['knowledge', 'builder', 'operations']
    for (const department of allowed) {
      expect({ department, can: canContributeToBrain({ name: 'x', department }) })
        .toMatchObject({ can: true })
    }
  })

  it('yetkisiz departmanlar yapamaz (growth/creative/client-success/legacy)', () => {
    const denied: DepartmentId[] = ['growth', 'creative', 'client-success', 'legacy']
    for (const department of denied) {
      expect({ department, can: canContributeToBrain({ name: 'x', department }) })
        .toMatchObject({ can: false })
    }
  })

  it('departmansız veya tanımsız departmanlı ajan yapamaz', () => {
    expect(canContributeToBrain({ name: 'x' })).toBe(false)
    // Tanımsız departman adı: tip sistemi bunu engeller, kapı ÇALIŞMA
    // ZAMANINDA da reddetmeli (registry'ye güvenmeyen ikinci hat).
    expect(canContributeToBrain({ name: 'x', department: 'olmayan' as DepartmentId })).toBe(false)
  })
})

// ── Karar hattı ─────────────────────────────────────────────────────────────

describe('decideHarvest — VERIFY kapısı', () => {
  it('verify_failed run\'ın çıktısı ASLA yazılmaz (kalite bile hesaplanmaz)', () => {
    const plan = decideHarvest({
      agent: { name: 'builder-agent', department: 'builder' },
      output: outputWith([GOOD_CANDIDATE]),
      verifyPassed: false,
      failedToolCallCount: 0,
    })
    expect(plan.allowed).toBe(false)
    expect(plan.accepted).toHaveLength(0)
    expect(plan.deniedReason).toContain('VERIFY')
  })

  it('verify geçen yetkili ajanın iyi adayı yazılır', () => {
    const plan = decideHarvest({
      agent: { name: 'builder-agent', department: 'builder' },
      output: outputWith([GOOD_CANDIDATE]),
      verifyPassed: true,
      failedToolCallCount: 0,
    })
    expect(plan.allowed).toBe(true)
    expect(plan.accepted).toHaveLength(1)
    expect(plan.accepted[0].quality.verdict).not.toBe('reject')
  })
})

describe('decideHarvest — departman kapısı', () => {
  it('yetkisiz ajanın çıktısı hiç değerlendirilmez', () => {
    const plan = decideHarvest({
      agent: { name: 'growth-agent', department: 'growth' },
      output: outputWith([GOOD_CANDIDATE]),
      verifyPassed: true,
      failedToolCallCount: 0,
    })
    expect(plan.allowed).toBe(false)
    expect(plan.deniedReason).toContain('brain.contribute')
    expect(plan.accepted).toHaveLength(0)
  })
})

describe('decideHarvest — kalite kapısı', () => {
  it('tek seferlik durum bilgisi REDDEDİLİR (agent_runs\'ta kalmalı)', () => {
    const plan = decideHarvest({
      agent: { name: 'operations-agent', department: 'operations' },
      output: outputWith([{
        type: 'fact',
        title: 'Tick raporu',
        content: 'Bu çalıştırmada 3 görev düştü ve şu an kuyruk boş; şimdilik ek işlem gerekmiyor.',
        reusable: true,
      }]),
      verifyPassed: true,
      failedToolCallCount: 0,
    })
    expect(plan.accepted).toHaveLength(0)
    expect(plan.rejected).toHaveLength(1)
    expect(plan.rejected[0].reason).toMatch(/tek seferlik/i)
  })

  it('yeniden kullanılabilir işaretlenmemiş aday reddedilir', () => {
    const plan = decideHarvest({
      agent: { name: 'builder-agent', department: 'builder' },
      output: outputWith([{ ...GOOD_CANDIDATE, reusable: false }]),
      verifyPassed: true,
      failedToolCallCount: 0,
    })
    expect(plan.accepted).toHaveLength(0)
  })

  it('çok kısa içerik reddedilir (ağırlıklı puan kurtaramaz)', () => {
    const plan = decideHarvest({
      agent: { name: 'builder-agent', department: 'builder' },
      output: outputWith([{ type: 'fact', title: 'Kısa', content: 'çok kısa', reusable: true }]),
      verifyPassed: true,
      failedToolCallCount: 0,
    })
    expect(plan.accepted).toHaveLength(0)
    expect(plan.rejected[0].reason).toMatch(/karakter/)
  })

  it('review bandındaki aday YAZILIR ama işaretlenir (kuyruk = aday statüsü)', () => {
    // Orta uzunlukta içerik + 3 hatalı tool + Brain'de yüksek benzerlik →
    // trustScore inceleme bandına (0.35–0.6) iner. Bu depoda inceleme kuyruğu
    // ayrı bir tablo DEĞİLDİR: 'aday' statüsünde yazılıp işaretlenmektir.
    const plan = decideHarvest({
      agent: { name: 'builder-agent', department: 'builder' },
      output: outputWith([{
        type: 'pattern',
        title: 'Retry backoff',
        content:
          'Retry backoff süresi kuyruk derinliğine göre ayarlanmalı; sabit backoff '
          + 'yoğun kuyrukta yetersiz kalıyor ve görevler birikiyor.',
        reusable: true,
      }]),
      verifyPassed: true,
      failedToolCallCount: 3,
      duplicationRateByIndex: [0.9],
    })

    expect(plan.rejected).toHaveLength(0)
    expect(plan.accepted).toHaveLength(1)
    // Yazıldı AMA 'accept' değil — inceleme bekliyor.
    expect(plan.accepted[0].quality.verdict).toBe('review')
  })
})

// ── Kalite motorunun ajan yüzü ──────────────────────────────────────────────

describe('computeAgentOutputQuality', () => {
  const base = {
    content: GOOD_CANDIDATE.content,
    title: GOOD_CANDIDATE.title,
    verifyPassed: true,
    failedToolCallCount: 0,
    claimedReusable: true,
    duplicationRate: 0,
  }

  it('iyi aday accept alır', () => {
    expect(computeAgentOutputQuality(base).verdict).toBe('accept')
  })

  it('verify geçmemişse puan ne olursa olsun reject', () => {
    const report = computeAgentOutputQuality({ ...base, verifyPassed: false })
    expect(report.verdict).toBe('reject')
    expect(report.dimensions.reliability).toBe(0)
  })

  it('yeniden kullanılabilirlik tabanı altındaki aday reject', () => {
    const report = computeAgentOutputQuality({ ...base, claimedReusable: false })
    expect(report.dimensions.applicability).toBeLessThan(AGENT_REUSABILITY_FLOOR)
    expect(report.verdict).toBe('reject')
    // ...ve bu, ağırlıklı puan YÜKSEK olmasına rağmen oldu: işaretlenmemiş
    // aday puanla kurtarılamaz.
    expect(report.trustScore).toBeGreaterThan(REVIEW_THRESHOLD)
  })

  it('hatalı tool çağrıları güvenilirliği düşürür', () => {
    const clean = computeAgentOutputQuality(base)
    const dirty = computeAgentOutputQuality({ ...base, failedToolCallCount: 3 })
    expect(dirty.dimensions.reliability).toBeLessThan(clean.dimensions.reliability)
  })

  it('DETERMİNİSTİK: aynı girdi aynı rapor', () => {
    expect(computeAgentOutputQuality(base)).toEqual(computeAgentOutputQuality(base))
  })

  it('boş içerik reject', () => {
    expect(computeAgentOutputQuality({ ...base, content: '  ' }).verdict).toBe('reject')
  })
})
