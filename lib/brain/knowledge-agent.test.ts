import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Knowledge Agent Foundation entegrasyon testi (CP4) — brain.test.ts deseni:
// canlı Supabase + gerçek bge-m3; env yoksa skip, migration 0005 canlıda
// yoksa skip (probe). Üç grup: (1) executor seviyesi tool validasyonu —
// geçersiz targetType/linkType REDDİ, (2) brain_read_signals sözleşmesi,
// (3) uçtan uca akış: createSignal → runAgent(knowledge-agent, MockProvider
// deterministik "bu bir Fact'tir" senaryosu) → brain_integrate'in gerçekten
// çağrıldığı, yeni cold node + derived_from kenarının oluştuğu.
//
// KİMLİK VE TEMİZLİK: tüm kayıtlar sentinel KNOWLEDGE_USER_ID altında yaşar
// (…000e — brain.test'in …000d'siyle ve diğer setlerle çakışmaz).
// beforeAll/afterAll sentinelin entities (links FK cascade) ve agent_runs
// (agent_logs FK cascade) satırlarını siler — canlıda test artığı kalmaz.

// getAIProvider ilk çağrıda cache'ler — runAgent'tan önce mock'a sabitle.
process.env.AI_PROVIDER = 'mock'

import { createSignal, getNode } from './node-repository'
import { getLinkedNodes } from './link-registry'
import { buildKnowledgeAgentContext } from './context-builder'
import { serverExecuteTool } from '../agents/executor'
import { runAgent } from '../agents/runner'
import { KNOWLEDGE_FACT_CONTENT } from '../ai/mock'
import type { BrainNode } from './types'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — brain (…000d), memory-loop (…000c), onboarding (…000b)
 *  setleriyle çakışmayan yeni sentinel. */
const KNOWLEDGE_USER_ID = '00000000-0000-4000-a000-00000000000e'

const SIGNAL_A_CONTENT =
  'Gümüş baykuş kütüphanesi gece istekleri sınıra takılıyor — benzersiz knowledge-agent test sinyali A.'
const SIGNAL_B_CONTENT =
  'Gümüş baykuş istemcisinin yeniden deneme aralığı iki katına çıkarıldı — benzersiz knowledge-agent test sinyali B.'

async function adminApi() {
  const { getSupabaseAdmin } = await import('../supabase-admin')
  return getSupabaseAdmin()
}

// Migration 0005 probe'u (brain.test.ts deseni): scope kolonu yoksa skip.
let hasMigration = false
if (hasEnv) {
  const supabase = await adminApi()
  const { error } = await supabase.from('entities').select('scope').limit(1)
  hasMigration = !error
  if (!hasMigration) {
    console.warn(
      '[knowledge-agent.test] migration 0005 canlıda uygulanmamış (entities.scope yok) — suite atlanıyor.',
    )
  }
}

async function cleanup() {
  const supabase = await adminApi()
  // Entity silmek links kenarlarını, agent_runs silmek agent_logs satırlarını
  // FK cascade ile düşürür.
  await supabase.from('entities').delete().eq('user_id', KNOWLEDGE_USER_ID)
  await supabase.from('agent_runs').delete().eq('user_id', KNOWLEDGE_USER_ID)
}

describe.skipIf(!hasEnv || !hasMigration)(
  'Knowledge Agent Foundation (canlı Supabase + MockProvider, sentinel kullanıcı)',
  () => {
    let signalA: BrainNode
    let signalB: BrainNode

    beforeAll(async () => {
      await cleanup()
      // Sıra önemli: A önce yaratılır → "en eskiden yeniye" sözleşmesinde başta gelmeli.
      signalA = await createSignal(SIGNAL_A_CONTENT, 'knowledge-test', undefined, {
        userId: KNOWLEDGE_USER_ID,
      })
      signalB = await createSignal(SIGNAL_B_CONTENT, 'knowledge-test', undefined, {
        userId: KNOWLEDGE_USER_ID,
      })
    }, 600_000) // ilk koşuda bge-m3 model yüklemesi burada ödenir
    afterAll(cleanup)

    // ── 1. Tool validasyonu (executor seviyesinde RED — modele güvenilmez) ──

    it('brain_integrate: 7 tip dışındaki targetType reddedilir, node yazılmaz', async () => {
      const result = await serverExecuteTool(
        'brain_integrate',
        { signalId: signalA.id, targetType: 'opinion', content: 'x' },
        KNOWLEDGE_USER_ID,
      )
      expect(result).toMatchObject({ ok: false })
      expect(String((result as { error: string }).error)).toMatch(/reddedildi/)
      // Sinyale bağlı hiçbir derived_from kenarı doğmamış olmalı:
      expect(await getLinkedNodes(signalA.id, 'derived_from')).toHaveLength(0)
    })

    it('brain_integrate: UUID olmayan signalId ve boş content reddedilir', async () => {
      expect(
        await serverExecuteTool(
          'brain_integrate',
          { signalId: 'sinyal-1', targetType: 'fact', content: 'x' },
          KNOWLEDGE_USER_ID,
        ),
      ).toMatchObject({ ok: false })
      expect(
        await serverExecuteTool(
          'brain_integrate',
          { signalId: signalA.id, targetType: 'fact', content: '   ' },
          KNOWLEDGE_USER_ID,
        ),
      ).toMatchObject({ ok: false })
    })

    it('brain_link: 9 tip dışındaki linkType reddedilir (Personal Brain tipleri dahil)', async () => {
      const invalid = await serverExecuteTool(
        'brain_link',
        { fromId: signalA.id, toId: signalB.id, linkType: 'friend_of' },
        KNOWLEDGE_USER_ID,
      )
      expect(invalid).toMatchObject({ ok: false })
      expect(String((invalid as { error: string }).error)).toMatch(/reddedildi/)

      const semantic = await serverExecuteTool(
        'brain_link',
        { fromId: signalA.id, toId: signalB.id, linkType: 'semantic' },
        KNOWLEDGE_USER_ID,
      )
      expect(semantic).toMatchObject({ ok: false })
    })

    // ── 2. brain_read_signals sözleşmesi ──

    it("brain_read_signals: status='gözlemlenen' sinyalleri en eskiden yeniye döner, limit kırpılır", async () => {
      const signals = (await serverExecuteTool(
        'brain_read_signals',
        { limit: 999 }, // max 20'ye kırpılmalı — hata değil
        KNOWLEDGE_USER_ID,
      )) as BrainNode[]

      expect(Array.isArray(signals)).toBe(true)
      expect(signals.length).toBeLessThanOrEqual(20)
      const ids = signals.map((s) => s.id)
      expect(ids.indexOf(signalA.id)).toBeGreaterThanOrEqual(0)
      // En eski (A) en başta gelmeli — B'den önce:
      expect(ids.indexOf(signalA.id)).toBeLessThan(ids.indexOf(signalB.id))
      expect(signals.every((s) => s.status === 'gözlemlenen')).toBe(true)
    })

    // ── 3. Uçtan uca akış: sinyal → Knowledge Agent → cold node + kenar ──

    it('runAgent(knowledge-agent): mock "bu bir Fact\'tir" senaryosu brain_integrate\'i gerçekten çalıştırır', async () => {
      // Context builder en eski bekleyen sinyali (A) başa koyar; mock ilk
      // signalId'yi ayıklayıp fact olarak entegre eder.
      const ctx = await buildKnowledgeAgentContext(10, { userId: KNOWLEDGE_USER_ID })
      expect(ctx).toContain(signalA.id)

      const result = await runAgent('knowledge-agent', {}, KNOWLEDGE_USER_ID)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      // Çıktı sözleşmesi: processed[0] sinyal A'yı fact olarak raporlar.
      const output = result.output as {
        processed: { signalId: string; targetType: string; nodeId: string | null }[]
      }
      expect(output.processed).toHaveLength(1)
      expect(output.processed[0].signalId).toBe(signalA.id)
      expect(output.processed[0].targetType).toBe('fact')
      const nodeId = output.processed[0].nodeId
      expect(nodeId).toBeTruthy()

      // Yeni cold node gerçekten doğdu:
      const fact = await getNode(nodeId!)
      expect(fact).not.toBeNull()
      expect(fact!.type).toBe('fact')
      expect(fact!.layer).toBe('cold')
      expect(fact!.status).toBe('aday')
      expect(fact!.content).toBe(KNOWLEDGE_FACT_CONTENT)
      expect(fact!.userId).toBe(KNOWLEDGE_USER_ID) // kimlik sinyalden miras

      // derived_from kenarı kuruldu (yeni → sinyal) ve sinyal SİLİNMEDİ:
      const linked = await getLinkedNodes(nodeId!, 'derived_from')
      expect(
        linked.some((l) => l.direction === 'outgoing' && l.node.id === signalA.id),
      ).toBe(true)
      const signalAfter = await getNode(signalA.id)
      expect(signalAfter).not.toBeNull()
      expect(signalAfter!.status).toBe('gözlemlenen') // statüye dokunulmaz (Foundation kapsamı)

      // agent_runs satırı 'done' olarak kapandı (manuel tetikleme yolunun izi):
      const supabase = await adminApi()
      const { data: run } = await supabase
        .from('agent_runs')
        .select('status, agent_name')
        .eq('id', result.runId)
        .single()
      expect(run).toMatchObject({ status: 'done', agent_name: 'knowledge-agent' })
    }, 120_000)

    it('brain_get_node: var olan node döner, rastgele UUID null döner', async () => {
      const found = (await serverExecuteTool(
        'brain_get_node',
        { id: signalA.id },
        KNOWLEDGE_USER_ID,
      )) as BrainNode
      expect(found.id).toBe(signalA.id)

      expect(
        await serverExecuteTool(
          'brain_get_node',
          { id: '00000000-0000-4000-a000-0000000000aa' },
          KNOWLEDGE_USER_ID,
        ),
      ).toBeNull()
    })
  },
)
