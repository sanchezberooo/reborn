import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Agent Brain entegrasyon testi (CP3) — memory-loop.test.ts deseni: canlı
// Supabase + gerçek bge-m3; env yoksa skip. EK KOŞUL: migration 0005
// (scope/layer/status kolonları) canlıda uygulanmamışsa suite kendini atlar
// (aşağıdaki probe) — 'signal' tipi ve scope kolonu olmadan bu testler
// koşamaz, yanlış nedenle kızarmasın.
//
// KİMLİK VE TEMİZLİK: tüm kayıtlar sentinel kullanıcı BRAIN_USER_ID altında
// yaşar (resolveSingleUserId'nin döndürdüğü GERÇEK kullanıcı ASLA kullanılmaz
// — createSignal'e opts.userId ile geçilir, integrateNode kimliği sinyalden
// miras alır). beforeAll/afterAll sentinel kullanıcının TÜM entities
// satırlarını siler; links kenarları FK cascade ile düşer — canlı tabloda
// test artığı kalmaz.

import { createSignal, getNode, integrateNode, updateNodeStatus } from './node-repository'
import { getLinkedNodes, linkNodes, markContradiction, supersede } from './link-registry'
import { getNodesByLayer, getNodesByType, hybridRetrieveScoped } from './query'
import type { BrainNode, LinkType } from './types'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi — fixture (…0001), onboarding (…000b) ve memory-loop
 *  (…000c) setleriyle karışmasın. */
const BRAIN_USER_ID = '00000000-0000-4000-a000-00000000000d'

const SIGNAL_CONTENT =
  'Zümrüt sarmaşık API çağrıları gece yarısı deploy penceresinde zaman aşımına düşüyor — benzersiz brain test sinyali.'
const FACT_CONTENT =
  'Zümrüt sarmaşık API istemcisinin varsayılan zaman aşımı 30 saniyedir; gece deploy penceresinde 90 saniyeye çıkarılmalıdır.'
const FACT_V2_CONTENT =
  'Zümrüt sarmaşık API istemcisi v2 ile zaman aşımı sorunu kökten çözüldü; özel ayar gerekmez.'
const PERSONAL_CONTENT =
  'Turuncu fener alayı anılarımı sahil defterime yazdım — benzersiz personal brain test notu.'

async function adminApi() {
  const { getSupabaseAdmin } = await import('../supabase-admin')
  return getSupabaseAdmin()
}

// Migration 0005 probe'u: scope kolonu yoksa PostgREST hata döner → skip.
let hasMigration = false
if (hasEnv) {
  const supabase = await adminApi()
  const { error } = await supabase.from('entities').select('scope').limit(1)
  hasMigration = !error
  if (!hasMigration) {
    console.warn(
      '[brain.test] migration 0005 canlıda uygulanmamış (entities.scope yok) — suite atlanıyor. ' +
        'Uygula: supabase/migrations/0005_agent_brain.sql',
    )
  }
}

async function cleanup() {
  const supabase = await adminApi()
  // Entity silmek links kenarlarını FK cascade ile düşürür.
  await supabase.from('entities').delete().eq('user_id', BRAIN_USER_ID)
}

describe.skipIf(!hasEnv || !hasMigration)(
  'Agent Brain (canlı Supabase + bge-m3, sentinel kullanıcı)',
  () => {
    let signal: BrainNode
    let fact: BrainNode

    beforeAll(cleanup)
    afterAll(cleanup)

    it('createSignal: sıcak katmana scope=agent sinyal düşer (embedding dahil)', async () => {
      signal = await createSignal(SIGNAL_CONTENT, 'test-agent', 'brain.test.ts CP3', {
        userId: BRAIN_USER_ID,
      })
      expect(signal.scope).toBe('agent')
      expect(signal.layer).toBe('hot')
      expect(signal.type).toBe('signal')
      expect(signal.status).toBe('gözlemlenen')
      expect(signal.userId).toBe(BRAIN_USER_ID)
      expect(signal.title).toContain('test-agent')

      const supabase = await adminApi()
      const { data } = await supabase
        .from('entities')
        .select('embedding, content')
        .eq('id', signal.id)
        .single()
      expect(JSON.parse(data!.embedding as string) as number[]).toHaveLength(1024)
      expect(data!.content).toContain('[Bağlam]')
    }, 600_000) // ilk koşuda bge-m3 model yüklemesi burada ödenir

    it('integrateNode: sinyal soğuk bilgiye damıtılır, derived_from kenarı otomatik kurulur', async () => {
      fact = await integrateNode(signal.id, 'fact', FACT_CONTENT)
      expect(fact.scope).toBe('agent')
      expect(fact.layer).toBe('cold')
      expect(fact.type).toBe('fact')
      expect(fact.status).toBe('aday')
      expect(fact.userId).toBe(BRAIN_USER_ID) // kimlik sinyalden miras

      const linked = await getLinkedNodes(fact.id, 'derived_from')
      expect(linked).toHaveLength(1)
      expect(linked[0].direction).toBe('outgoing') // yeni → sinyal
      expect(linked[0].node.id).toBe(signal.id)
      expect(linked[0].link.type).toBe('derived_from')
    }, 120_000)

    it('integrateNode: soğuk katman tipi olmayan hedefi reddeder', async () => {
      await expect(
        // 'signal' sıcak katman tipidir — integrateNode hedefi olamaz.
        integrateNode(signal.id, 'signal' as Parameters<typeof integrateNode>[1], 'x'),
      ).rejects.toThrow(/soğuk katman tipi değil/)
    })

    it('linkNodes: 9 tanımlı tip dışını reddeder (DB\'ye inmeden)', async () => {
      await expect(
        linkNodes(signal.id, fact.id, 'friend_of' as LinkType),
      ).rejects.toThrow(/tanımlı bir ilişki tipi değil/)
      // Personal Brain kenar tipleri de bu registry'den geçemez:
      await expect(
        linkNodes(signal.id, fact.id, 'semantic' as LinkType),
      ).rejects.toThrow(/tanımlı bir ilişki tipi değil/)
    })

    it('updateNodeStatus: doğrulama geçişi confidence_count artırır', async () => {
      const before = fact.confidenceCount
      const updated = await updateNodeStatus(fact.id, 'doğrulanmış')
      expect(updated.status).toBe('doğrulanmış')
      expect(updated.confidenceCount).toBe(before + 1)
    })

    it('supersede: SİLMEZ — eski node status=eskimiş olur, supersedes kenarı kurulur', async () => {
      const factV2 = await integrateNode(signal.id, 'fact', FACT_V2_CONTENT)
      await supersede(fact.id, factV2.id)

      const old = await getNode(fact.id)
      expect(old).not.toBeNull() // silinmedi
      expect(old!.status).toBe('eskimiş')
      expect(old!.content).toBe(FACT_CONTENT) // içerik olduğu gibi duruyor

      const linked = await getLinkedNodes(factV2.id, 'supersedes')
      expect(linked.some((l) => l.node.id === fact.id && l.direction === 'outgoing')).toBe(true)

      // markContradiction da statülere dokunmadan kenar kurar:
      const edge = await markContradiction(fact.id, factV2.id)
      expect(edge.type).toBe('contradicts')
      expect((await getNode(factV2.id))!.status).toBe('aday')
    }, 120_000)

    it('SCOPE İZOLASYONU: agent node personal sorguda görünmez — ve tersi', async () => {
      // Aynı sentinel kullanıcıya bir de Personal Brain kaydı: createEntity
      // scope göndermez → migration DEFAULT'u 'personal' devreye girer
      // (mevcut yazma yollarının değişmeden personal kalmasının kanıtı).
      const { createEntity } = await import('../db-server')
      const personal = await createEntity({
        userId: BRAIN_USER_ID,
        type: 'note',
        title: 'Turuncu fener alayı',
        content: PERSONAL_CONTENT,
      })

      // personal filtresi: agent node'ları (signal + fact'ler) GÖRÜNMEMELİ.
      const personalHits = await hybridRetrieveScoped('zümrüt sarmaşık zaman aşımı', 'personal', {
        userId: BRAIN_USER_ID,
        limit: 20,
      })
      expect(personalHits.some((r) => r.id === signal.id || r.id === fact.id)).toBe(false)
      expect(personalHits.some((r) => r.id === personal.id)).toBe(true)

      // agent filtresi: personal note GÖRÜNMEMELİ, sinyal görünmeli.
      const agentHits = await hybridRetrieveScoped('zümrüt sarmaşık zaman aşımı', 'agent', {
        userId: BRAIN_USER_ID,
        limit: 20,
      })
      expect(agentHits.some((r) => r.id === personal.id)).toBe(false)
      expect(agentHits.some((r) => r.id === signal.id)).toBe(true)

      // Doğrudan sorgu katmanı da izole: 'note' personal tipli yaşadığı hâlde
      // scope='agent' filtresi yüzünden boş döner; signal/hot ise gelir.
      expect(await getNodesByType('note', undefined, { userId: BRAIN_USER_ID })).toHaveLength(0)
      const signals = await getNodesByType('signal', 'hot', { userId: BRAIN_USER_ID })
      expect(signals.some((n) => n.id === signal.id)).toBe(true)
      const hot = await getNodesByLayer('hot', { userId: BRAIN_USER_ID })
      expect(hot.some((n) => n.id === personal.id)).toBe(false)
    }, 120_000)
  },
)
