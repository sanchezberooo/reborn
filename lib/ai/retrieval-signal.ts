// Retrieval aktivite sinyali (MAXAİ Ofis Brain küresi için) — süreç içi
// timestamp store. buildChatContext hybridRetrieve'i çağırırken işaretler;
// GET /api/brain/activity okur, ofis sahnesi 5 sn'lik polling döngüsünde
// kürenin "aktif/sakin" modunu buna göre seçer.
//
// globalThis üzerinde tutulur: Next.js dev modunda route bundle'ları aynı
// modülü ayrı instance'lar olarak yükleyebilir; global kayıt (Prisma
// singleton deseni) yazan route ile okuyan route'un aynı değeri görmesini
// garantiler. Kalıcılık gerekmez — sinyalin ömrü ~10 sn, süreç yeniden
// başlarsa sıfırlanması doğru davranıştır.

declare global {
  // eslint-disable-next-line no-var
  var __rebornLastRetrievalAt: number | undefined
}

/** Hibrit retrieval çağrısı başlarken işaretle. */
export function markRetrievalActive(): void {
  globalThis.__rebornLastRetrievalAt = Date.now()
}

/** Son retrieval'ın epoch ms zamanı; süreç ömründe hiç olmadıysa null. */
export function getLastRetrievalAt(): number | null {
  return globalThis.__rebornLastRetrievalAt ?? null
}
