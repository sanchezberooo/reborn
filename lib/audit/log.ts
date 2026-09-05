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
  /** Çağrı bir ajan çalıştırması içinde yapıldıysa o run'ın id'si
   *  (migration 0014). Sanchez'in sohbet içi çağrılarında null — onların
   *  agent_runs satırı yoktur. */
  runId?: string | null
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

/**
 * Denetim yazıcısını test koşusunda AÇAN bayrak. Bir test dosyası
 * yazıcının kendisini sınıyorsa (lib/audit/audit.test.ts,
 * lib/departments/enforcement.test.ts) en üstte
 * `process.env[AUDIT_IN_TESTS_ENV] = '1'` yapar — `AI_PROVIDER = 'mock'`
 * ile aynı desen. Vitest 4 her test dosyasını ayrı fork'ta koştuğu için
 * bayrak dosya-yereldir, komşu dosyalara sızmaz.
 */
export const AUDIT_IN_TESTS_ENV = 'REBORN_AUDIT_IN_TESTS'

/**
 * Test koşusu canlı denetim tablosunu KİRLETMEZ.
 *
 * NEDEN KAPATMAK, "testler kendi satırlarını silsin" DEĞİL: izin verilen
 * yolda denetim yazımı bilinçli olarak ateşle-unut'tur
 * (lib/agents/executor.ts) — insert, testin afterAll temizliğinden SONRA
 * düşebilir. Yani temizlik tabanlı çözüm yarış koşulludur ve satırları
 * ara ara yine de bırakır. Kapatma deterministiktir.
 *
 * Sızdıran testler audit'i sınayanlar değil (onlar zaten temizliyor);
 * altlarından geçen canlı testler: memory-loop, knowledge-agent,
 * report-mode, onboarding-flow, runtime, roster.
 *
 * ÜRETİM DAVRANIŞI DEĞİŞMEZ: process.env.VITEST yalnız Vitest koşusunda
 * tanımlıdır — `next build`, `next start` ve dev sunucusunda yoktur.
 */
function auditDisabled(): boolean {
  return Boolean(process.env.VITEST) && process.env[AUDIT_IN_TESTS_ENV] !== '1'
}

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
  if (auditDisabled()) return

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
    const supabase = getSupabaseAdmin()

    const { error } = await supabase.from('audit_log').insert({
      user_id: entry.userId ?? null,
      agent_name: entry.agentName ?? null,
      department: entry.department ?? null,
      run_id: entry.runId ?? null,
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
