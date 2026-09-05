import { afterAll, describe, expect, it, vi } from 'vitest'

// Audit Log yazıcısı testi (Paket A / TASK A5).
//
// İki sözleşme korunur:
// 1. Yazıcı ASLA fırlatmaz — denetim yazımı, denetlenen işin başarısını
//    etkilemez. Bu, DB hatası GERÇEKTEN oluşturularak sınanır (geçersiz
//    uuid), mock'la taklit edilerek değil.
// 2. Satır alanları dolu ve GİRDİ DEĞERLERİ sızmıyor — yalnız anahtarlar.
//
// auditInputKeys saftır (DB yok) ve CI'da her zaman koşar; satır yazan
// testler env-guard'lıdır (lib/goals-sync.test.ts deseni).

process.env.AI_PROVIDER = 'mock'
// Yazıcı test koşusunda VARSAYILAN OLARAK KAPALIDIR (bkz. lib/audit/log.ts
// auditDisabled): canlı denetim tablosunu kirletmesin. Burası yazıcının
// KENDİSİNİ sınıyor — bu dosya için açılır. Vitest 4 dosya başına fork
// açtığından bayrak komşu test dosyalarına sızmaz.
process.env.REBORN_AUDIT_IN_TESTS = '1'

import { auditInputKeys, writeAuditLog } from './log'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — kullanılan sentinel'lerle çakışmayan yeni id. */
const AUDIT_USER_ID = '00000000-0000-4000-a000-000000000017'

describe('auditInputKeys — girdi değerleri sızmaz', () => {
  it('yalnız anahtar adlarını döndürür, değerleri ASLA', () => {
    const keys = auditInputKeys({
      content: 'çok gizli kişisel not',
      importance: 9,
      tags: ['sağlık', 'para'],
    })
    expect(keys).toEqual(['content', 'importance', 'tags'])
    expect(JSON.stringify(keys)).not.toContain('gizli')
    expect(JSON.stringify(keys)).not.toContain('sağlık')
  })

  it('girdi yoksa boş dizi', () => {
    expect(auditInputKeys(undefined)).toEqual([])
    expect(auditInputKeys({})).toEqual([])
  })

  it('anahtar sayısı sınırlanır (modelden keyfi büyük girdi gelebilir)', () => {
    const huge: Record<string, unknown> = {}
    for (let i = 0; i < 200; i++) huge[`k${i}`] = i
    expect(auditInputKeys(huge)).toHaveLength(50)
  })
})

describe.skipIf(!hasEnv)('writeAuditLog — canlı Supabase', () => {
  afterAll(async () => {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    await getSupabaseAdmin().from('audit_log').delete().eq('user_id', AUDIT_USER_ID)
  })

  it('allowed satırı alanları dolu yazılır', async () => {
    await writeAuditLog({
      userId: AUDIT_USER_ID,
      agentName: 'knowledge-agent',
      department: 'knowledge',
      toolName: 'brain_get_node',
      status: 'allowed',
      capability: 'brain.read',
      durationMs: 42,
      inputKeys: ['id'],
    })

    const { getSupabaseAdmin } = await import('../supabase-admin')
    const { data } = await getSupabaseAdmin()
      .from('audit_log').select('*')
      .eq('user_id', AUDIT_USER_ID).eq('tool_name', 'brain_get_node').limit(1)

    expect(data?.[0]).toMatchObject({
      agent_name: 'knowledge-agent',
      department: 'knowledge',
      status: 'allowed',
      capability: 'brain.read',
      duration_ms: 42,
      deny_reason: null,
      error: null,
    })
    expect(data?.[0].input_keys).toEqual(['id'])
    // workspace_id bu pakette doldurulmaz — multi-tenant yer tutucusu.
    expect(data?.[0].workspace_id).toBeNull()
  })

  it('denied satırı deny_reason ile yazılır', async () => {
    await writeAuditLog({
      userId: AUDIT_USER_ID,
      agentName: 'growth-agent',
      department: 'growth',
      toolName: 'brain_integrate',
      status: 'denied',
      capability: 'brain.integrate',
      denyReason: 'capability-forbidden',
      durationMs: 1,
      inputKeys: ['signalId'],
    })

    const { getSupabaseAdmin } = await import('../supabase-admin')
    const { data } = await getSupabaseAdmin()
      .from('audit_log').select('*')
      .eq('user_id', AUDIT_USER_ID).eq('tool_name', 'brain_integrate').limit(1)

    expect(data?.[0]).toMatchObject({
      status: 'denied',
      deny_reason: 'capability-forbidden',
      capability: 'brain.integrate',
    })
  })

  it('uzun hata metni kırpılır (log deposu şişmesin)', async () => {
    await writeAuditLog({
      userId: AUDIT_USER_ID,
      toolName: 'read_memories',
      status: 'error',
      error: new Error('x'.repeat(2000)),
    })

    const { getSupabaseAdmin } = await import('../supabase-admin')
    const { data } = await getSupabaseAdmin()
      .from('audit_log').select('error')
      .eq('user_id', AUDIT_USER_ID).eq('tool_name', 'read_memories').limit(1)

    expect(data?.[0].error).toHaveLength(500)
  })

  it('DB hatası FIRLATMAZ — yalnız console.error (denetlenen iş düşmemeli)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      // Geçersiz uuid → insert gerçekten hata döner (mock değil, gerçek hata).
      await expect(
        writeAuditLog({
          userId: 'gecersiz-uuid-degeri',
          toolName: 'read_memories',
          status: 'allowed',
        }),
      ).resolves.toBeUndefined()
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })
})

describe('denetim yazımı tool sonucunu değiştirmez', () => {
  afterAll(() => {
    vi.doUnmock('@/lib/audit/log')
    vi.resetModules()
  })

  it('yazıcı sözleşmesini bozup FIRLATSA bile güvenlik sonucu aynı kalır', async () => {
    // Yazıcının kendi sözleşmesi "asla fırlatma"; burada o sözleşme
    // BİLEREK bozulup executor'ın ikinci savunma hattı (safeAudit) sınanıyor.
    //
    // RED yolu seçildi (izinli yol değil): red kararı runTool'a hiç
    // ulaşmadan döndüğü için DB'ye dokunulmaz — test CI'da da koşar. Ve
    // sınadığı şey daha güçlü: denetim yazımı çökse bile çağrı yine de
    // REDDEDİLİYOR, yazıcı hatası güvenlik kararının yerine geçmiyor.
    vi.resetModules()
    vi.doMock('@/lib/audit/log', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./log')>()
      return {
        ...actual,
        writeAuditLog: async () => { throw new Error('denetim yazıcısı patladı') },
      }
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { serverExecuteTool } = await import('../agents/executor')
      // growth-agent'ın life-data.write yetkisi yok → reddedilmeli.
      await expect(
        serverExecuteTool('save_memory', { content: 'x' }, AUDIT_USER_ID, {
          callerAgent: 'growth-agent',
        }),
      ).rejects.toThrow(/reddedildi/) // yazıcı hatası DEĞİL, red mesajı

      // ...ve bu, hatanın yutulduğu için oldu: safeAudit'in catch'i koştu.
      expect(errorSpy).toHaveBeenCalledWith(
        '[Reborn audit] yazıcı sözleşmesi bozuldu:',
        expect.objectContaining({ message: 'denetim yazıcısı patladı' }),
      )
    } finally {
      errorSpy.mockRestore()
      vi.doUnmock('@/lib/audit/log')
      vi.resetModules()
    }
  })
})
