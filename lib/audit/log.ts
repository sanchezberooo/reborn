// Audit Log yazıcısı — her tool çağrısının yetki kararı ve izi
// (migration 0013). TEK YAZMA KAPISI: audit_log'a başka hiçbir yerden
// insert edilmez; append-only disiplini buradan korunur.
//
// ASLA FIRLATMAZ. Denetim yazımı, denetlenen işin başarısını etkilemez:
// insert başarısız olursa console.error yeterlidir, tool çalışması
// düşmez. (Tersi tasarım, DB'deki geçici bir sorunu tüm tool yoluna
// yayardı.)
//
// agent_logs'un YERİNİ ALMAZ: o "ajan ne yaptı"yı (aksiyon + kısaltılmış
// sonuç), bu tablo "izin verildi mi, ne kadar sürdü"yü cevaplar. İkisi
// bir süre yan yana yaşar (migration 0013 başlığı).

/** migration 0013 audit_log.status CHECK'i ile birebir. */
export type AuditStatus = 'allowed' | 'denied' | 'error'

export interface AuditEntry {
  userId?: string | null
  agentName?: string | null
  department?: string | null
  toolName: string
  status: AuditStatus
  /** Çözülen yetenek; tool yetenek sözlüğünde eşlenmemişse null. */
  capability?: string | null
  /** Yalnız status='denied' için — enforcement.ts ToolDenyReason değeri. */
  denyReason?: string | null
  durationMs?: number | null
  error?: unknown
  /** Girdi ANAHTARLARI — değerler asla yazılmaz (bkz. auditInputKeys). */
  inputKeys?: string[]
}

/** Hata metni sınırı — agent_logs'un 500 karakter deseniyle aynı: denetim
 *  satırı teşhis için yeterli olmalı, log deposunu şişirmemeli. */
const MAX_ERROR_LENGTH = 500

/** Anahtar sayısı sınırı: modelden gelen girdi keyfi büyük olabilir. */
const MAX_INPUT_KEYS = 50

/**
 * Girdinin YALNIZCA anahtar adlarını çıkarır — değerler hiçbir koşulda
 * denetim tablosuna girmez (kişisel veri, API cevabı, essay metni…).
 * Anahtar adları tool şemasından gelir (content, tags, title…) ve
 * kendi başlarına veri taşımaz.
 */
export function auditInputKeys(input: Record<string, unknown> | undefined): string[] {
  if (!input) return []
  return Object.keys(input).slice(0, MAX_INPUT_KEYS)
}

function toErrorText(error: unknown): string | null {
  if (error === undefined || error === null) return null
  const text = error instanceof Error ? error.message : String(error)
  return text.slice(0, MAX_ERROR_LENGTH)
}

/**
 * Denetim satırını yazar. Fırlatmaz — çağıran `await` edebilir ve hata
 * yolunu düşünmek zorunda kalmaz.
 *
 * `await` edilmesi bilinçlidir (fire-and-forget değil): red kararının
 * izi, reddin kendisinden önce diske düşmeli ve testler yarış koşulu
 * olmadan satırı görebilmeli. Bedeli tool çağrısı başına tek insert.
 *
 * workspace_id BU PAKETTE YAZILMAZ (migration 0013 notu): multi-tenant
 * günü için yer tutucudur, dolduran yol henüz yok.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
    const supabase = getSupabaseAdmin()

    const { error } = await supabase.from('audit_log').insert({
      user_id: entry.userId ?? null,
      agent_name: entry.agentName ?? null,
      department: entry.department ?? null,
      tool_name: entry.toolName,
      status: entry.status,
      capability: entry.capability ?? null,
      deny_reason: entry.denyReason ?? null,
      duration_ms: entry.durationMs ?? null,
      error: toErrorText(entry.error),
      input_keys: entry.inputKeys ?? null,
    })
    if (error) {
      console.error('[Reborn audit] satır yazılamadı:', error.message)
    }
  } catch (err) {
    console.error('[Reborn audit] yazıcı hatası:', err instanceof Error ? err.message : err)
  }
}
