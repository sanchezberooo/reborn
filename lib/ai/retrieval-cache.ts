// Retrieval snapshot geçersizleme sayacı. Bilinçli olarak ayrı ve
// bağımlılıksız bir dosya: yazma yolu (lib/db.ts — istemci bundle'ına
// girer) ile okuma yolu (lib/ai/retrieval.ts — transformers.js ve admin
// client yükler, yalnız sunucu) birbirini statik import edemez; ikisinin
// paylaştığı tek şey bu sayaçtır. entities/links'e yazan veya silen her
// fonksiyon invalidateRetrievalCache() çağırır; retrieval snapshot'ı
// kendi sürümünü bu sayaçla karşılaştırıp bayatlamışsa yeniden yükler.

let version = 0

export function invalidateRetrievalCache(): void {
  version += 1
}

export function retrievalCacheVersion(): number {
  return version
}
