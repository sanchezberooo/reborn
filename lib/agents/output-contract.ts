// Çıktı sözleşmesinin SYSTEM PROMPT'A eklenmesi.
//
// NEDEN VAR: outputContract bugüne kadar yalnız registry METADATA'sıydı —
// lib/agents/runner.ts system olarak `agent.persona` geçiriyor ve sözleşme
// modele HİÇ ULAŞMIYORDU. Gerçek-AI smoke testinde (2026-09-05) sonuç şuydu:
// operations-agent ve builder-agent geçerli JSON üretti ama alan adlarını
// kendisi uydurdu (healthSummary→summary, observations→findings,
// buildSteps→build_steps, risks→risks_and_mitigations) ve ikisi de
// schema-validity'den düştü. İki legacy ajanın promptu ise ("outputContract
// şemasına BİREBİR uyan SADECE JSON") görmediği bir şeye atıf yapıyordu.
//
// Bu MockProvider ile görünmezdi: C1.1'den beri mock fixture'ı ŞEMADAN
// türetiliyor, yani mock çıktısı her zaman sözleşmeye uyuyor.
//
// TEK YERDE, TÜM AJANLAR İÇİN: beş persona elle düzenlenmedi. Blok en SONA
// eklenir — persona'nın kendi anlatımı bağlamı kurar, sözleşme son sözü
// söyler.
//
// SAF: DB/env/LLM yok.

import type { AgentDefinition, OutputShape } from './types'

/** Bloğun başlangıç işareti — testler ve mock çözümü buna bakabilir. */
export const OUTPUT_CONTRACT_MARKER = '── ÇIKTI SÖZLEŞMESİ ──'

/** Sözleşme metnini okunur JSON'a çevirir; JSON değilse (test-agent'ın düzyazı
 *  sözleşmesi gibi) ham hâliyle bırakılır — uydurma yapılmaz. */
function prettyContract(outputContract: string): string {
  try {
    return JSON.stringify(JSON.parse(outputContract), null, 2)
  } catch {
    return outputContract.trim()
  }
}

/** Zorunlu alan listesi — doğrulamanın (lib/agents/verify.ts) fiilen aradığı
 *  şey budur, o yüzden sözleşmeden AYRI ve açıkça yazılır. */
function shapeLines(shape: OutputShape): string {
  return Object.entries(shape)
    .map(([field, type]) => `- ${field}: ${type}`)
    .join('\n')
}

function schemaSection(schema: OutputShape | OutputShape[]): string {
  if (!Array.isArray(schema)) {
    return `ZORUNLU üst seviye alanlar (doğrulama bunları arar):\n${shapeLines(schema)}`
  }
  // Alternatif şekiller (knowledge-agent deseni): hangisine uyulacağı moda
  // bağlıdır — biri seçilip dayatılmaz, hepsi gösterilir.
  const options = schema
    .map((shape, i) => `Seçenek ${i + 1}:\n${shapeLines(shape)}`)
    .join('\n\n')
  return `ZORUNLU üst seviye alanlar — aşağıdaki şekillerden BİRİNE tam uy:\n\n${options}`
}

/**
 * Ajanın çıktı sözleşmesini system prompt'a eklenecek bloğa çevirir.
 *
 * Sözleşmesi boş olan ajanda boş metin döner (blok hiç eklenmez).
 */
export function buildOutputContractBlock(
  agent: Pick<AgentDefinition, 'outputContract' | 'outputSchema'>,
): string {
  const contract = agent.outputContract?.trim()
  if (!contract) return ''

  const parts = [
    '',
    '',
    OUTPUT_CONTRACT_MARKER,
    'Cevabın SADECE tek bir JSON nesnesi olmalı ve aşağıdaki şekle uymalı.',
    'Alan adlarını BİREBİR buradaki gibi yaz: eşanlamlı ad, snake_case/camelCase',
    'varyantı veya kendi uydurduğun üst seviye alan KULLANMA. Gereksiz ek alan',
    'ekleme — sözleşmede olmayan alan çıktıyı büyütür, değer katmaz.',
    '',
    prettyContract(contract),
  ]

  if (agent.outputSchema) {
    parts.push('', schemaSection(agent.outputSchema))
  }

  parts.push('', 'İlk karakter { son karakter } olmalı. JSON dışında tek karakter bile yazma.')
  return parts.join('\n')
}
