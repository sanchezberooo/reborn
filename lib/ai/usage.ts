// Token toplama (Paket B / TASK B3) — bir çalıştırmadaki TÜM model
// turlarının tüketimini toplar.
//
// NEDEN AYRI VE SAF: bir ajan çalıştırması tek model turu değildir — tool
// döngüsü her turda geçmişin tamamını yeniden gönderir, dolayısıyla asıl
// maliyet turların TOPLAMINDADIR. Toplama DB'siz test edilebilir olmalı
// (lib/departments/enforcement.ts deseni).
//
// PARA HESABI YOK (bilinçli): fiyat tablosu koda gömülmez — modeller ve
// fiyatlar değişir, gömülü fiyat sessizce yanlışa döner. Token sayısı ham
// gerçektir; TL/dolar çevrimi UI katmanının işidir.

import type { AIUsage } from './provider'

/** Bir run'ın toplamı. null = BİLİNMİYOR (sağlayıcı ölçüm vermedi) —
 *  0'dan farklıdır: 0 "hiç token harcanmadı" demektir. */
export interface UsageTotals {
  inputTokens: number | null
  outputTokens: number | null
}

/**
 * Turların usage'larını toplar.
 *
 * Hiçbir tur ölçüm vermediyse sonuç null/null'dır — MockProvider ile koşan
 * bir run'a "0 token" yazmak, maliyeti gerçekten sıfır olan bir çalıştırmayla
 * ölçülmemiş bir çalıştırmayı ayırt edilemez yapardı.
 *
 * Turların BİR KISMI ölçüm verdiyse yalnız onlar toplanır: eksik ölçüm,
 * eldeki ölçümü çöpe atmayı gerektirmez — sonuç alt sınırdır.
 */
export function sumUsage(turns: readonly (AIUsage | undefined)[]): UsageTotals {
  const measured = turns.filter((u): u is AIUsage => u !== undefined)
  if (measured.length === 0) return { inputTokens: null, outputTokens: null }

  return {
    inputTokens: measured.reduce((total, u) => total + u.inputTokens, 0),
    outputTokens: measured.reduce((total, u) => total + u.outputTokens, 0),
  }
}
