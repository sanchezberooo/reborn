// Obsidian vault senkron uç noktası (Faz 2, Görev 5) — app/api/journal/route.ts
// deseniyle tutarlı: iş mantığı lib/db-server.ts'tedir (kasa okuma + entity/link
// upsert, embedding sunucuda). İdempotent: aynı kasa üzerinde tekrar tekrar
// çağrılabilir (upsert + eksik dosya silme deseni).

import { resolveSingleUserId, syncObsidianVault } from '@/lib/db-server'

export async function POST() {
  try {
    const userId = await resolveSingleUserId()
    const result = await syncObsidianVault(userId)
    return Response.json(result)
  } catch (error) {
    console.error('[api/obsidian/sync] POST hata:', error)
    const message = error instanceof Error ? error.message : 'Kasa senkronu başarısız.'
    // OBSIDIAN_VAULT_PATH eksikse istemci hatası (yapılandırma), aksi 500.
    const clientFault = message.startsWith('syncObsidianVault:')
    return Response.json(
      { error: clientFault ? message : 'Kasa senkronu başarısız.' },
      { status: clientFault ? 400 : 500 },
    )
  }
}
