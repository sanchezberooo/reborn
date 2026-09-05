import { afterAll, describe, expect, it, vi } from 'vitest'

// Runtime capability enforcement testi (Paket A / TASK A5).
//
// İKİ KATMAN, BİLİNÇLİ AYRI:
// 1. SAF karar hattı (canUseTool) — DB/env gerektirmez, CI'da HER ZAMAN
//    koşar. Yaptırımın asıl sözleşmesi burada korunur.
// 2. Yürütme entegrasyonu (serverExecuteTool) — canlı Supabase ister,
//    env-guard deseniyle skip edilir (lib/goals-sync.test.ts deseni).
//    Yalnız saf katmanın gösteremeyeceğini gösterir: reddedilen çağrının
//    tool gövdesini HİÇ çalıştırmadığı ve audit satırının düştüğü.

process.env.AI_PROVIDER = 'mock'
// Denetim yazıcısı test koşusunda varsayılan kapalı (lib/audit/log.ts);
// bu dosyanın 2. katmanı tam da audit satırının düştüğünü sınıyor — açılır.
process.env.REBORN_AUDIT_IN_TESTS = '1'

import { AGENTS, listAgents } from '../agents/registry'
import { canUseTool, ENFORCEMENT_EXEMPT_AGENT } from './enforcement'
import { TOOL_CAPABILITIES } from './registry'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — kullanılan sentinel'lerle çakışmayan yeni id. */
const ENFORCEMENT_USER_ID = '00000000-0000-4000-a000-000000000016'

// ── 1. Saf karar hattı — DB YOK, CI'da koşar ────────────────────────────────

describe('canUseTool — saf karar hattı', () => {
  it('izinli ajan + izinli tool → çalışır (yetenek ve departman çözülür)', () => {
    expect(canUseTool('knowledge-agent', 'brain_integrate')).toEqual({
      allowed: true,
      exempt: false,
      capability: 'brain.integrate',
      department: 'knowledge',
    })
  })

  it('izinli ajan + izinsiz tool → reddedilir (default-deny)', () => {
    // growth-agent gerçek bir ajan ve brain_integrate gerçek bir tool; ama
    // brain.integrate YALNIZ knowledge departmanında izinli.
    const decision = canUseTool('growth-agent', 'brain_integrate')
    expect(decision).toMatchObject({
      allowed: false,
      reason: 'capability-forbidden',
      capability: 'brain.integrate',
      department: 'growth',
    })
  })

  it('izin listesinde HİÇ geçmeyen yetenek de yasaktır (default-deny)', () => {
    // life-data.write hiçbir departmanın permissions listesinde yok —
    // "açıkça forbidden" değil, "hiç yazılmamış". Sonuç aynı olmalı.
    expect(canUseTool('growth-agent', 'save_memory')).toMatchObject({
      allowed: false,
      reason: 'capability-forbidden',
      capability: 'life-data.write',
    })
  })

  it("TOOL_CAPABILITIES'te olmayan tool → reddedilir", () => {
    expect(canUseTool('knowledge-agent', 'olmayan_tool')).toMatchObject({
      allowed: false,
      reason: 'unmapped-tool',
      capability: null,
    })
  })

  it('bilinmeyen callerAgent → reddedilir (kimliksiz de, sahte de)', () => {
    expect(canUseTool(undefined, 'read_memories')).toMatchObject({
      allowed: false, reason: 'unknown-agent',
    })
    expect(canUseTool('', 'read_memories')).toMatchObject({
      allowed: false, reason: 'unknown-agent',
    })
    expect(canUseTool('sahte-ajan', 'read_memories')).toMatchObject({
      allowed: false, reason: 'unknown-agent',
    })
  })

  it('muafiyet YALNIZ literal sanchez adına bağlı, "AGENTS\'ta yok"a değil', () => {
    expect(canUseTool(ENFORCEMENT_EXEMPT_AGENT, 'save_memory')).toMatchObject({
      allowed: true, exempt: true,
    })
    // AGENTS'ta olmayan başka bir ad muafiyete GENİŞLEMEZ:
    expect(AGENTS['sanchez']).toBeUndefined()
    expect(canUseTool('sanchez-2', 'save_memory')).toMatchObject({
      allowed: false, reason: 'unknown-agent',
    })
    expect(canUseTool('Sanchez', 'save_memory')).toMatchObject({
      allowed: false, reason: 'unknown-agent',
    })
  })

  it('sanchez muafiyeti eşlenmemiş tool için de geçerli (mevcut davranış korunur)', () => {
    expect(canUseTool('sanchez', 'olmayan_tool')).toMatchObject({
      allowed: true, exempt: true, capability: null,
    })
  })

  it('red mesajı izin haritasını SIZDIRMAZ', () => {
    const denied = canUseTool('growth-agent', 'save_memory')
    expect(denied.allowed).toBe(false)
    const message = (denied as { message: string }).message
    // Eksik yetenek ve tool adı söylenebilir:
    expect(message).toContain('save_memory')
    expect(message).toContain('life-data.write')
    // Ama izin tablosu / departman listesi / başka tool adları sızmamalı:
    expect(message).not.toContain('knowledge')
    expect(message).not.toContain('legacy')
    expect(message).not.toContain('read_memories')
    expect(message).not.toContain('brain.integrate')
  })

  it('REGRESYON: essay-brainstorm → read_memories + read_profile çalışmaya devam eder', () => {
    // legacy departmanı life-data.read + web.search taşır; paket bu ajanı
    // açıkça regresyon kontrolü olarak işaretliyor.
    expect(canUseTool('essay-brainstorm', 'read_memories')).toMatchObject({
      allowed: true, capability: 'life-data.read', department: 'legacy',
    })
    expect(canUseTool('essay-brainstorm', 'read_profile')).toMatchObject({ allowed: true })
  })

  it('REGRESYON: roster genelinde hiçbir ajanın fiili tool listesi kırılmadı', () => {
    // validateRoster zaten her ajanın tool'unun departmanında izinli
    // olmasını garanti ediyor; bu test aynı garantiyi ÇALIŞMA ZAMANI
    // kapısından geçirerek doğrular — enforcement mantığı registry ile
    // ayrışırsa burası kırmızıya döner.
    for (const agent of listAgents({ includeDeprecated: true })) {
      for (const toolName of agent.toolNames) {
        expect(
          { agent: agent.name, tool: toolName, decision: canUseTool(agent.name, toolName) },
        ).toMatchObject({ decision: { allowed: true } })
      }
    }
  })

  it('merkezi TOOLS listesindeki her tool bir yeteneğe eşli (kapı boşluğu yok)', () => {
    // Eşlenmemiş tool reddedildiği için, eşleme boşluğu = sessizce ölü tool.
    for (const toolName of Object.keys(TOOL_CAPABILITIES)) {
      expect(canUseTool('sanchez', toolName)).toMatchObject({ capability: TOOL_CAPABILITIES[toolName] })
    }
  })
})

// Aşağıdaki iki dal gerçek registry'lerle ULAŞILAMAZ (validateRoster buna
// izin vermiyor: hiçbir departman approval-required kullanmıyor, hiçbir
// ajan geçersiz departmana bağlı değil). Dallar yine de korunmalı —
// registry değişirse davranışın ne olacağı burada sabitlenir.
describe('canUseTool — registry ile ulaşılamayan dallar', () => {
  afterAll(() => {
    vi.doUnmock('./registry')
    vi.doUnmock('../agents/registry')
    vi.resetModules()
  })

  it('approval-required → reddedilir ve gerekçesi capability-forbidden’dan AYRI', async () => {
    vi.resetModules()
    vi.doMock('./registry', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./registry')>()
      return { ...actual, departmentEffect: () => 'approval-required' as const }
    })
    const { canUseTool: gated } = await import('./enforcement')

    const decision = gated('growth-agent', 'brain_get_node')
    expect(decision).toMatchObject({ allowed: false, reason: 'approval-required' })
    // Sessizce izin VERİLMEZ ve gerekçe ayırt edilebilir olmalı ki onay
    // katmanı geldiğinde bu satırlar ayıklanabilsin.
    expect((decision as { message: string }).message).toMatch(/onay/i)

    vi.doUnmock('./registry')
    vi.resetModules()
  })

  it('geçersiz departmanlı ajan → unknown-department', async () => {
    vi.resetModules()
    vi.doMock('../agents/registry', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../agents/registry')>()
      return {
        ...actual,
        getAgent: () => ({
          name: 'bozuk-ajan',
          displayName: 'Bozuk',
          persona: 'x',
          toolNames: ['read_memories'],
          moduleTarget: null,
          outputContract: '{}',
          department: 'olmayan-departman',
        }),
      }
    })
    const { canUseTool: gated } = await import('./enforcement')

    expect(gated('bozuk-ajan', 'read_memories')).toMatchObject({
      allowed: false, reason: 'unknown-department',
    })

    vi.doUnmock('../agents/registry')
    vi.resetModules()
  })
})

// ── 2. Yürütme entegrasyonu — canlı Supabase ister ─────────────────────────

describe.skipIf(!hasEnv)('serverExecuteTool — yaptırım + iz (canlı Supabase)', () => {
  afterAll(async () => {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    const supabase = getSupabaseAdmin()
    await supabase.from('audit_log').delete().eq('user_id', ENFORCEMENT_USER_ID)
    await supabase.from('memories').delete().eq('user_id', ENFORCEMENT_USER_ID)
  })

  it('reddedilen çağrı YAN ETKİ ÜRETMEZ ve denied satırı alanları dolu düşer', async () => {
    const { serverExecuteTool } = await import('../agents/executor')
    const { getSupabaseAdmin } = await import('../supabase-admin')
    const supabase = getSupabaseAdmin()

    // save_memory DB'ye yazan bir tool: reddedilirse memories satırı DOĞMAMALI.
    await expect(
      serverExecuteTool(
        'save_memory',
        { content: 'ENFORCEMENT-SIZINTI-KONTROL', importance: 5 },
        ENFORCEMENT_USER_ID,
        { callerAgent: 'growth-agent' },
      ),
    ).rejects.toThrow(/reddedildi/)

    const { data: leaked } = await supabase
      .from('memories').select('id').eq('user_id', ENFORCEMENT_USER_ID)
    expect(leaked ?? []).toHaveLength(0)

    const { data: rows } = await supabase
      .from('audit_log')
      .select('*')
      .eq('user_id', ENFORCEMENT_USER_ID)
      .eq('tool_name', 'save_memory')
      .order('created_at', { ascending: false })
      .limit(1)

    const row = rows?.[0]
    expect(row).toMatchObject({
      status: 'denied',
      deny_reason: 'capability-forbidden',
      capability: 'life-data.write',
      department: 'growth',
      agent_name: 'growth-agent',
      tool_name: 'save_memory',
    })
    // Girdi ANAHTARLARI yazılır, değerler ASLA:
    expect(row!.input_keys).toEqual(['content', 'importance'])
    expect(JSON.stringify(row)).not.toContain('ENFORCEMENT-SIZINTI-KONTROL')
    // workspace_id bu pakette doldurulmaz:
    expect(row!.workspace_id).toBeNull()
  })

  it('sanchez muaf AMA izsiz değil: çalışır ve audit satırı düşer', async () => {
    const { serverExecuteTool } = await import('../agents/executor')
    const { getSupabaseAdmin } = await import('../supabase-admin')
    const supabase = getSupabaseAdmin()

    // read_memories salt-okuma: muafiyeti yan etki üretmeden gösterir.
    const result = await serverExecuteTool(
      'read_memories', { limit: 1 }, ENFORCEMENT_USER_ID, { callerAgent: 'sanchez' },
    )
    expect(Array.isArray(result)).toBe(true)

    // İzin verilen yolda yazım ateşle-unut (sohbet sıcak yolu) — kısa bekle.
    const row = await waitForAuditRow(supabase, ENFORCEMENT_USER_ID, 'read_memories')
    expect(row).toMatchObject({
      status: 'allowed',
      agent_name: 'sanchez',
      tool_name: 'read_memories',
      capability: 'life-data.read',
      // Sanchez departmansızdır — muafiyet departman izniyle çözülmedi:
      department: null,
      deny_reason: null,
    })
    expect(typeof row.duration_ms).toBe('number')
  })

  it('bilinmeyen ajan yürütmede de reddedilir (kapı registry’ye bağlı)', async () => {
    const { serverExecuteTool } = await import('../agents/executor')
    await expect(
      serverExecuteTool('read_memories', {}, ENFORCEMENT_USER_ID, { callerAgent: 'sahte-ajan' }),
    ).rejects.toThrow(/reddedildi/)
  })
})

/** Ateşle-unut yazımı için kısa yoklama — yarış koşulu yerine açık bekleme. */
async function waitForAuditRow(
  supabase: ReturnType<typeof import('../supabase-admin').getSupabaseAdmin>,
  userId: string,
  toolName: string,
  timeoutMs = 8000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .eq('user_id', userId)
      .eq('tool_name', toolName)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data && data.length > 0) return data[0] as Record<string, unknown>
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`audit_log satırı ${timeoutMs}ms içinde düşmedi: ${toolName}`)
}
