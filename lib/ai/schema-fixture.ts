// Şema-türetilmiş mock fixture üretimi (Paket C1 / TASK C1.1).
//
// PROBLEM: MockProvider ajanlara jenerik { mock, note, input } döndürüyordu;
// outputSchema beyan eden her ajanın mock koşusu bu yüzden verify_failed
// oluyordu (Paket B'nin duvarı). Fixture artık ajanın KENDİ şemasından
// türetilir — şema zaten alan → tip eşlemesi olduğu için her tip için
// deterministik bir örnek değer üretmek yeterli.
//
// SAF ve DETERMİNİSTİK (roadmap ilke 14): aynı şema her zaman aynı fixture'ı
// üretir. Rastgelelik, tarih, sayaç YOK — testler fixture'ı sabit kabul
// edebilir.
//
// PROVIDER SOYUTLAMASI KİRLENMEZ: AIRequest'e ajan kimliği EKLENMEDİ.
// Provider tek bir model turunu soyutlar ve kimin çağırdığını bilmemelidir;
// şemayı bulma işi lib/ai/mock.ts'in registry'ye bakmasıyla çözülür
// (bkz. resolveOutputSchema).

import type { OutputFieldType, OutputShape } from '../agents/types'

/** Fixture değerlerinin mock kökenli olduğunu gösteren önek — üretilen her
 *  metin alanı bunu taşır ki çıktı yanlışlıkla gerçek veri sanılmasın. */
export const MOCK_FIELD_PREFIX = '[MOCK]'

/**
 * Bir alan için deterministik örnek değer.
 *
 * Diziler ve nesneler BOŞ doğar: şema yalnız üst seviye alan → tip söyler,
 * eleman/iç alan şekli hakkında bilgi TAŞIMAZ (lib/agents/types.ts: iç içe
 * doğrulama bilinçli yok). Uydurma eleman üretmek, şemanın söylemediği bir
 * yapıyı varsaymak olurdu. Boş dizi/nesne verify'ın tip kontrolünü geçer —
 * kontrol edilen şey tiptir, doluluk değil.
 */
function sampleValue(field: string, type: OutputFieldType): unknown {
  switch (type) {
    case 'string':  return `${MOCK_FIELD_PREFIX} ${field}`
    case 'number':  return 1
    case 'boolean': return true
    case 'array':   return []
    case 'object':  return {}
  }
}

/**
 * Şemadan fixture nesnesi üretir.
 *
 * Dizi (alternatif şekiller) verilirse İLK şekil seçilir — determinizm için
 * sabit kural; "hangi mod" bilgisi şemada yoktur ve mock'un tahmin etmesi
 * gereken bir şey değildir. Kendi modlu senaryosu olan ajan (knowledge-agent)
 * zaten kendi fixture yolundadır ve buraya hiç uğramaz.
 *
 * `mock: true` zarfta KALIR: fixture'ın mock kökenli olduğu tek bakışta
 * görünsün diye ve mevcut testler (roster/runtime) bu işarete bakıyor.
 * Şema aynı adda bir alan tanımlarsa şema kazanır — sözleşme işaretten
 * önce gelir.
 */
export function buildSchemaFixture(schema: OutputShape | OutputShape[]): Record<string, unknown> {
  const shape = Array.isArray(schema) ? schema[0] : schema
  const fixture: Record<string, unknown> = { mock: true }
  if (!shape) return fixture

  for (const [field, type] of Object.entries(shape)) {
    fixture[field] = sampleValue(field, type)
  }
  return fixture
}
