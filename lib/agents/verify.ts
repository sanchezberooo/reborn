// Agent lifecycle VERIFY aşaması (Paket B / TASK B2).
//
// Sözleşme: PLAN → EXECUTE → VERIFY → LOG → COMPLETE. Bu dosyadan önce
// runAgent şunu yapıyordu: model turu → parseAgentOutput → status 'done'.
// Yani ajan KENDİ ÇIKTISINI OTOMATİK BAŞARILI SAYIYORDU: JSON'ı bozuk çıkan
// bir çalıştırma bile sessizce 'done' olarak kaydediliyordu (parseAgentOutput
// { parseError: true } fallback'ine düşse bile).
//
// SAF: DB, env, LLM, I/O yok — lib/departments/enforcement.ts canUseTool
// deseni. Doğrulama DETERMİNİSTİKTİR: modele "çıktın doğru mu" diye
// SORULMAZ (kendini yargılayan ajan doğrulama değildir; ayrıca ikinci bir
// LLM turu maliyeti demek olurdu).

import type { OutputShape } from './types'

/** Kontrol adları — sonuç jsonb'sinde sabit kalır (agent_runs.verification
 *  okuyan her yer bu adlara bakar). */
export type VerificationCheckName =
  | 'output-existence'
  | 'parse-success'
  | 'schema-validity'
  | 'tool-results'

export interface VerificationCheck {
  name: VerificationCheckName
  passed: boolean
  /** true → kontrol uygulanamadı (şema beyan edilmemiş vb.); passed anlamsız. */
  skipped?: boolean
  /** false → düşse bile run'ı verify_failed yapmaz (yalnız gözlem). */
  blocking: boolean
  detail?: string
}

export interface VerificationResult {
  /** Yalnız BLOKLAYAN kontrollerin hepsi geçtiyse true. */
  passed: boolean
  checks: VerificationCheck[]
  verifiedAt: string
}

/** Bu run'da isError dönen tool çağrıları — verify'a gözlem olarak girer. */
export interface FailedToolCall {
  name: string
  message: string
}

export interface VerifyInput {
  output: unknown
  /** Ajan şema beyan etmemişse undefined → şema kontrolü atlanır. */
  outputSchema?: OutputShape | OutputShape[]
  failedToolCalls?: FailedToolCall[]
}

/** parseAgentOutput'un bozuk çıktı fallback'i — sözleşme orada tanımlı. */
function isParseError(output: unknown): boolean {
  return (
    typeof output === 'object'
    && output !== null
    && (output as { parseError?: unknown }).parseError === true
  )
}

/** "Çıktı var mı": null/undefined değil, boş metin değil, boş nesne değil. */
function hasOutput(output: unknown): boolean {
  if (output === null || output === undefined) return false
  if (typeof output === 'string') return output.trim().length > 0
  if (Array.isArray(output)) return output.length > 0
  if (typeof output === 'object') return Object.keys(output).length > 0
  return true
}

function typeMatches(value: unknown, expected: string): boolean {
  switch (expected) {
    case 'string':  return typeof value === 'string'
    case 'number':  return typeof value === 'number' && Number.isFinite(value)
    case 'boolean': return typeof value === 'boolean'
    case 'array':   return Array.isArray(value)
    case 'object':  return typeof value === 'object' && value !== null && !Array.isArray(value)
    default:        return false
  }
}

/** Tek bir şekle uyum — uymayan alanların listesini döndürür (boş = uyuyor).
 *  YALNIZ üst seviye: iç içe doğrulama bilinçli YOK (gerekmiyor; şema
 *  prompt'un yerini almaz, sözleşmenin makine-kontrol edilebilir çekirdeğidir).
 *  FAZLA alan sorun değildir — eksik veya yanlış tipli alan sorundur. */
function shapeViolations(output: unknown, shape: OutputShape): string[] {
  if (typeof output !== 'object' || output === null || Array.isArray(output)) {
    return ['çıktı bir nesne değil']
  }
  const record = output as Record<string, unknown>
  const violations: string[] = []
  for (const [field, expected] of Object.entries(shape)) {
    if (!(field in record)) {
      violations.push(`'${field}' alanı yok`)
    } else if (!typeMatches(record[field], expected)) {
      violations.push(`'${field}' ${expected} olmalı`)
    }
  }
  return violations
}

/**
 * Bir ajan çalıştırmasının çıktısını doğrular.
 *
 * Kontroller (sırayla):
 *  1. output-existence — çıktı boş/null/boş nesne değil.            [bloklar]
 *  2. parse-success    — parseAgentOutput parseError'a düşmedi.     [bloklar]
 *  3. schema-validity  — outputSchema varsa üst seviye alan+tip.    [bloklar]
 *  4. tool-results     — isError dönen tool çağrısı var mı.     [BLOKLAMAZ]
 *
 * 4. kontrol bilinçli bloklamaz: bir tool'un hata dönmesi ajanın BAŞARISIZ
 * olduğu anlamına gelmez — Sanchez gibi ajan da hatayı görüp devam edebilir
 * (TASK B1.1) ve yine de sözleşmeye uygun çıktı üretebilir. Bilgi kaybolmaz,
 * verification sonucunda görünür.
 */
export function verifyAgentOutput(input: VerifyInput): VerificationResult {
  const { output, outputSchema, failedToolCalls = [] } = input
  const checks: VerificationCheck[] = []

  const exists = hasOutput(output)
  checks.push({
    name: 'output-existence',
    passed: exists,
    blocking: true,
    ...(exists ? {} : { detail: 'çıktı boş, null veya boş nesne' }),
  })

  const parsed = !isParseError(output)
  checks.push({
    name: 'parse-success',
    passed: parsed,
    blocking: true,
    ...(parsed ? {} : { detail: 'model geçerli JSON üretmedi (parseAgentOutput fallback\'ine düşüldü)' }),
  })

  // Şema kontrolü: beyan yoksa atlanır. Parse düştüyse de atlanır — bozuk
  // çıktıyı şemaya vurmak ikinci bir hata satırı üretir, yeni bilgi vermez;
  // kök neden zaten parse-success'te yazılı.
  if (!outputSchema) {
    checks.push({
      name: 'schema-validity',
      passed: true,
      skipped: true,
      blocking: true,
      detail: 'ajan outputSchema beyan etmemiş — şema kontrolü uygulanmadı',
    })
  } else if (!parsed || !exists) {
    checks.push({
      name: 'schema-validity',
      passed: true,
      skipped: true,
      blocking: true,
      detail: 'çıktı ayrıştırılamadığı için şema kontrolü uygulanmadı',
    })
  } else {
    // Birden fazla şekil = ALTERNATİF sözleşmeler (OR): ajanın modu varsa
    // (knowledge-agent sinyal işleme vs. rapor) her modun kendi şekli olur;
    // herhangi birine uymak yeterlidir.
    const shapes = Array.isArray(outputSchema) ? outputSchema : [outputSchema]
    const perShape = shapes.map((shape) => shapeViolations(output, shape))
    const matched = perShape.some((v) => v.length === 0)
    checks.push({
      name: 'schema-validity',
      passed: matched,
      blocking: true,
      ...(matched ? {} : {
        detail: shapes.length === 1
          ? perShape[0].join(', ')
          : `hiçbir alternatif şekle uymadı — ${perShape.map((v, i) => `#${i + 1}: ${v.join(', ')}`).join(' | ')}`,
      }),
    })
  }

  const toolsClean = failedToolCalls.length === 0
  checks.push({
    name: 'tool-results',
    passed: toolsClean,
    blocking: false,
    ...(toolsClean ? {} : {
      detail: `${failedToolCalls.length} tool çağrısı hata döndü: ${failedToolCalls.map((c) => c.name).join(', ')}`,
    }),
  })

  return {
    passed: checks.every((c) => !c.blocking || c.skipped || c.passed),
    checks,
    verifiedAt: new Date().toISOString(),
  }
}
