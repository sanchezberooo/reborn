import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Brain Engine testi (Sprint 4). İki katman (tasks/runtime test deseni):
// 1. Saf sözleşme testleri (env'siz her yerde koşar): hafıza sınıfı eşlemesi,
//    scoring matematiği, çakışma adayı süzmesi.
// 2. Canlı Supabase + lokal embedding testleri (env yoksa skip): update
//    engine karar hattı (create/confirm/supersede + versiyon zinciri +
//    otomatik bağ), graph engine (traversal + scope izolasyonu), memory
//    engine (timeline/working memory), search engine (üç mod), context
//    engine (kaynaklar + reasoning context).

import {
  AGENT_NODE_TYPES,
  MEMORY_CLASS_BY_TYPE,
  PERSONAL_NODE_TYPES,
} from './types'
import type { NodeType } from './types'
import {
  computeFreshness,
  computeImportance,
  decayedScore,
  DECAY_FLOOR,
  rankItems,
  STATUS_WEIGHT,
  TYPE_IMPORTANCE,
} from './scoring'
import { findConflictCandidates } from './update-engine'

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/** Bu testin sahibi sentinel — diğer setlerle (…000b-…0011) çakışmaz. */
const BRAIN_USER_ID = '00000000-0000-4000-a000-000000000012'

describe('hafıza sınıflaması — sözlük bütünlüğü', () => {
  it('her node tipi tam bir hafıza sınıfına eşlidir', () => {
    const allTypes = [...PERSONAL_NODE_TYPES, ...AGENT_NODE_TYPES] as NodeType[]
    for (const type of allTypes) {
      expect(['episodic', 'semantic']).toContain(MEMORY_CLASS_BY_TYPE[type])
    }
    // Eşleme fazlalık içermez: sözlükteki her anahtar envanterde vardır.
    for (const key of Object.keys(MEMORY_CLASS_BY_TYPE)) {
      expect(allTypes).toContain(key as NodeType)
    }
  })

  it('yaşantı kayıtları episodic, kimlik çekirdeği semantic', () => {
    expect(MEMORY_CLASS_BY_TYPE.journal).toBe('episodic')
    expect(MEMORY_CLASS_BY_TYPE.decision).toBe('episodic')
    expect(MEMORY_CLASS_BY_TYPE.identity).toBe('semantic')
    expect(MEMORY_CLASS_BY_TYPE.preference).toBe('semantic')
  })
})

describe('scoring engine — matematik sözleşmeleri', () => {
  it('tip ve statü ağırlıkları tüm sözlükleri kapsar ve [0,1] içindedir', () => {
    for (const weight of Object.values(TYPE_IMPORTANCE)) {
      expect(weight).toBeGreaterThan(0)
      expect(weight).toBeLessThanOrEqual(1)
    }
    expect(STATUS_WEIGHT['güvenilir']).toBe(1)
    expect(STATUS_WEIGHT['eskimiş']).toBeLessThan(STATUS_WEIGHT['gözlemlenen'])
  })

  it('importance bağ ve doğrulamayla monoton artar, 1i aşmaz', () => {
    const base = computeImportance({ type: 'note', status: 'doğrulanmış' })
    const linked = computeImportance({ type: 'note', status: 'doğrulanmış', linkDegree: 5 })
    const confirmed = computeImportance({ type: 'note', status: 'doğrulanmış', linkDegree: 5, confidenceCount: 3 })
    expect(linked).toBeGreaterThan(base)
    expect(confirmed).toBeGreaterThan(linked)
    expect(computeImportance({ type: 'identity', status: 'güvenilir', linkDegree: 999, confidenceCount: 999 })).toBeLessThanOrEqual(1)
  })

  it('freshness üstel söner; decay tabanın altına inmez (bilgi görünmez olmaz)', () => {
    const now = Date.now()
    const today = computeFreshness(new Date(now).toISOString(), now)
    const old = computeFreshness(new Date(now - 90 * 86_400_000).toISOString(), now)
    expect(today).toBeCloseTo(1, 2)
    expect(old).toBeLessThan(today)
    expect(decayedScore(0.8, 0)).toBeCloseTo(0.8 * DECAY_FLOOR, 5)
    expect(decayedScore(0.8, 1)).toBeCloseTo(0.8, 5)
  })

  it('rankItems: benzerlik esas sinyaldir; eşit benzerlikte önemli tip öne geçer', () => {
    const now = Date.now()
    const anchor = new Date(now).toISOString()
    const ranked = rankItems([
      { name: 'not', type: 'note' as const, status: 'doğrulanmış' as const, freshnessAnchor: anchor, similarity: 0.7 },
      { name: 'kimlik', type: 'identity' as const, status: 'doğrulanmış' as const, freshnessAnchor: anchor, similarity: 0.7 },
      { name: 'alakasız', type: 'identity' as const, status: 'doğrulanmış' as const, freshnessAnchor: anchor, similarity: 0.1 },
    ], now)
    expect(ranked.map((r) => r.name)).toEqual(['kimlik', 'not', 'alakasız'])
  })
})

describe('update engine — çakışma adayı süzmesi (saf)', () => {
  const input = { type: 'preference' as NodeType, content: 'Bero sabah çalışmayı tercih eder.' }

  it('yalnız aynı tipten, bant içinde, içeriği farklı adaylar döner', () => {
    const candidates = [
      { id: 'a', type: 'preference', title: 'bant içi', content: 'Bero akşam çalışmayı tercih eder.', similarity: 0.85 },
      { id: 'b', type: 'note', title: 'tip farklı', content: 'x', similarity: 0.85 },
      { id: 'c', type: 'preference', title: 'bant altı', content: 'y', similarity: 0.5 },
      { id: 'd', type: 'preference', title: 'dedup bölgesi', content: 'z', similarity: 0.95 },
      { id: 'e', type: 'preference', title: 'içerik aynı', content: 'Bero sabah çalışmayı  tercih eder.', similarity: 0.85 },
    ]
    const conflicts = findConflictCandidates(candidates, input)
    expect(conflicts.map((c) => c.nodeId)).toEqual(['a'])
  })

  it('dedup hedefi çakışma sayılmaz', () => {
    const candidates = [
      { id: 'a', type: 'preference', title: 't', content: 'farklı içerik', similarity: 0.9 },
    ]
    expect(findConflictCandidates(candidates, input, { dedupTargetId: 'a', dedupThreshold: 0.95 })).toEqual([])
  })
})

describe.skipIf(!hasEnv)('brain engine uçtan uca (canlı Supabase + lokal embedding)', () => {
  async function adminApi() {
    const { getSupabaseAdmin } = await import('../supabase-admin')
    return getSupabaseAdmin()
  }

  async function cleanup() {
    const supabase = await adminApi()
    // entities silinince links FK cascade ile düşer; goals uzantısı da cascade.
    await supabase.from('agent_tasks').delete().eq('user_id', BRAIN_USER_ID)
    await supabase.from('entities').delete().eq('user_id', BRAIN_USER_ID)
  }

  beforeAll(cleanup)
  afterAll(cleanup)

  it('update engine: create → confirm (doğrulama) → supersede (versiyon) zinciri', async () => {
    const { applyBrainUpdate, getVersionHistory } = await import('./update-engine')

    const created = await applyBrainUpdate({
      userId: BRAIN_USER_ID,
      scope: 'personal',
      type: 'preference',
      content: 'Bero derin çalışma bloklarını sabah 06:00-09:00 arasında yapmayı tercih ediyor.',
    })
    expect(created.action).toBe('created')
    expect(created.node.status).toBe('doğrulanmış')
    expect(created.importance).toBeGreaterThan(0)

    // Aynı bilgi tekrar gelirse: yeni node YOK, doğrulama sayılır.
    const confirmed = await applyBrainUpdate({
      userId: BRAIN_USER_ID,
      scope: 'personal',
      type: 'preference',
      content: 'Bero derin çalışma bloklarını sabah 06:00-09:00 arasında yapmayı tercih ediyor.',
    })
    expect(confirmed.action).toBe('confirmed')
    expect(confirmed.node.id).toBe(created.node.id)
    expect(confirmed.node.confidenceCount).toBe(created.node.confidenceCount + 1)

    // Revizyon gelirse: eski eskir, zincir kurulur.
    const superseded = await applyBrainUpdate({
      userId: BRAIN_USER_ID,
      scope: 'personal',
      type: 'preference',
      content: 'Bero derin çalışma bloklarını sabah 06:00-09:30 arasında yapmayı tercih ediyor.',
    })
    expect(superseded.action).toBe('superseded')
    expect(superseded.supersededNodeId).toBe(created.node.id)

    const { getScopedNode } = await import('./graph')
    const oldNode = await getScopedNode(created.node.id, 'personal')
    expect(oldNode?.status).toBe('eskimiş')

    const history = await getVersionHistory(superseded.node.id, 'personal')
    expect(history.map((n) => n.id)).toEqual([created.node.id, superseded.node.id])

    // Scope disiplini: personal scope'a agent tipi yazılamaz, signal kapı dışı.
    await expect(applyBrainUpdate({
      userId: BRAIN_USER_ID, scope: 'personal', type: 'fact', content: 'x',
    })).rejects.toThrow(/Personal Brain tipi değil/)
    await expect(applyBrainUpdate({
      userId: BRAIN_USER_ID, scope: 'agent', type: 'signal', content: 'x',
    })).rejects.toThrow(/createSignal/)
  }, 120_000)

  it('memory engine: otomatik bağ kurulur (hiçbir kayıt yalnız yaşamamalı) ve ilişkili hafıza iki kanaldan bulunur', async () => {
    const { applyBrainUpdate } = await import('./update-engine')
    const { relatedNodes } = await import('./graph')

    const first = await applyBrainUpdate({
      userId: BRAIN_USER_ID,
      scope: 'personal',
      type: 'note',
      content: 'IELTS writing pratiğinde Task 2 argüman kurgusu en zayıf halka.',
    })
    const second = await applyBrainUpdate({
      userId: BRAIN_USER_ID,
      scope: 'personal',
      type: 'note',
      content: 'IELTS writing çalışmasında paragraf geçişleri güçlendirilmeli.',
    }, { linkThreshold: 0.3 }) // eşik kalibrasyon kanalı: bağ garantilenir

    expect(second.action).toBe('created')
    expect(second.autoLinked.map((l) => l.nodeId)).toContain(first.node.id)

    const related = await relatedNodes(second.node.id, { scope: 'personal', minSimilarity: 0.3 })
    const found = related.find((r) => r.node.id === first.node.id)
    expect(found).toBeDefined()
    expect(found!.via).toContain('graph')
    expect(found!.via).toContain('semantic')
  }, 120_000)

  it('graph engine: BFS traversal derinlik sırasıyla bulur, scope sınırını aşmaz', async () => {
    const { applyBrainUpdate } = await import('./update-engine')
    const { createLink } = await import('../db-server')
    const { createSignal } = await import('./node-repository')
    const { traverse, getNeighbors } = await import('./graph')

    // a -user-> b -user-> c zinciri (autoLink gürültüsüz: alakasız içerikler).
    const a = await applyBrainUpdate({ userId: BRAIN_USER_ID, scope: 'personal', type: 'project', content: 'Reborn projesi: kişisel Life OS inşası.' })
    const b = await applyBrainUpdate({ userId: BRAIN_USER_ID, scope: 'personal', type: 'person', content: 'Mert: üniversiteden çalışma arkadaşı, İstanbul.' })
    const c = await applyBrainUpdate({ userId: BRAIN_USER_ID, scope: 'personal', type: 'event', content: 'Kadıköy kahve buluşması 12 Temmuz.' })
    await createLink({ sourceEntityId: a.node.id, targetEntityId: b.node.id, kind: 'user' })
    await createLink({ sourceEntityId: b.node.id, targetEntityId: c.node.id, kind: 'user' })

    // Scope sınırı: personal a'ya bağlı bir AGENT sinyali traversal'da görünmemeli.
    const signal = await createSignal('Graf izolasyon testi sinyali', 'test-agent', undefined, { userId: BRAIN_USER_ID })
    await createLink({ sourceEntityId: a.node.id, targetEntityId: signal.id, kind: 'user' })

    const walked = await traverse(a.node.id, { scope: 'personal', maxDepth: 2 })
    const byId = new Map(walked.map((n) => [n.node.id, n]))
    expect(byId.get(b.node.id)?.depth).toBe(1)
    expect(byId.get(c.node.id)?.depth).toBe(2)
    expect(byId.has(signal.id)).toBe(false)

    const neighbors = await getNeighbors(a.node.id, { scope: 'personal', kinds: ['user'] })
    expect(neighbors.map((n) => n.node.id)).toContain(b.node.id)
    expect(neighbors.map((n) => n.node.id)).not.toContain(signal.id)
  }, 120_000)

  it('memory engine: timeline yalnız episodic taşır, working memory yakın dokunuşları önem sırasıyla verir', async () => {
    const { applyBrainUpdate } = await import('./update-engine')
    const { getTimeline, getWorkingMemory } = await import('./memory-engine')

    const decision = await applyBrainUpdate({
      userId: BRAIN_USER_ID,
      scope: 'personal',
      type: 'decision',
      content: 'Karar: Kanada başvurularında ilk tercih Toronto olacak.',
    })

    const timeline = await getTimeline(BRAIN_USER_ID, { limit: 50 })
    const timelineIds = timeline.map((n) => n.id)
    expect(timelineIds).toContain(decision.node.id)
    for (const node of timeline) {
      expect(MEMORY_CLASS_BY_TYPE[node.type]).toBe('episodic')
    }
    // Decision History = timeline'ın 'decision' süzmesi.
    const decisions = await getTimeline(BRAIN_USER_ID, { types: ['decision'], limit: 10 })
    expect(decisions.map((n) => n.id)).toContain(decision.node.id)
    await expect(getTimeline(BRAIN_USER_ID, { types: ['identity'] })).rejects.toThrow(/episodic/)

    const working = await getWorkingMemory(BRAIN_USER_ID, { windowDays: 1, limit: 50 })
    expect(working.map((n) => n.id)).toContain(decision.node.id)
  }, 120_000)

  it('search engine: üç mod da çalışır, scope ayrımı korunur, eskimiş geriye düşer', async () => {
    const { searchBrain } = await import('./search')

    const query = 'derin çalışma bloğu tercihi sabah saatleri'
    const semantic = await searchBrain(query, { userId: BRAIN_USER_ID, scope: 'personal', mode: 'semantic' })
    expect(semantic.length).toBeGreaterThan(0)
    // Güncel tercih (09:30) eskimiş versiyonun (09:00) ÖNÜNDE sıralanmalı.
    const currentIdx = semantic.findIndex((r) => r.title.includes('09:30'))
    const staleIdx = semantic.findIndex((r) => r.status === 'eskimiş')
    expect(currentIdx).toBeGreaterThanOrEqual(0)
    if (staleIdx >= 0) expect(currentIdx).toBeLessThan(staleIdx)

    const hybrid = await searchBrain(query, { userId: BRAIN_USER_ID, scope: 'personal', mode: 'hybrid' })
    expect(hybrid.length).toBeGreaterThan(0)
    expect(hybrid[0].mode).toBe('hybrid')

    // Graph modu: proje tohumundan kenar komşuları gelir.
    const graph = await searchBrain('Reborn Life OS projesi', { userId: BRAIN_USER_ID, scope: 'personal', mode: 'graph' })
    expect(graph.length).toBeGreaterThan(0)

    // Scope ayrımı: personal aramada agent sinyali yok, agent aramada personal yok.
    const agentResults = await searchBrain('Graf izolasyon testi sinyali', { userId: BRAIN_USER_ID, scope: 'agent', mode: 'semantic' })
    for (const result of agentResults) {
      expect(result.type).toBe('signal')
    }
    for (const result of semantic) {
      expect(result.type).not.toBe('signal')
    }
  }, 120_000)

  it('context engine: kaynaklar gerçek veri toplar, reasoning context kimlik çekirdeğini sabitler', async () => {
    const { applyBrainUpdate } = await import('./update-engine')
    const { buildContext, buildReasoningContext, memorySource, openTasksSource } = await import('./context-engine')
    const { createTask } = await import('../tasks/repository')

    const identity = await applyBrainUpdate({
      userId: BRAIN_USER_ID,
      scope: 'personal',
      type: 'identity',
      content: 'Bero disiplinli bir kurucu olmak istiyor: sistem kuran, tamamlayan, teslim eden.',
    })
    await createTask(BRAIN_USER_ID, { title: 'Context engine test görevi', department: 'operations' })

    const items = await buildContext(
      { query: 'disiplinli kurucu kimliği', userId: BRAIN_USER_ID },
      { sources: [memorySource(), openTasksSource] },
    )
    expect(items.some((i) => i.source === 'memory')).toBe(true)
    expect(items.some((i) => i.source === 'open-tasks' && i.title.includes('Context engine test görevi'))).toBe(true)

    const reasoning = await buildReasoningContext('sabah rutini nasıl olmalı', BRAIN_USER_ID)
    expect(reasoning.pinned.map((n) => n.id)).toContain(identity.node.id)
    expect(reasoning.retrieved.length).toBeGreaterThan(0)
    expect(Array.isArray(reasoning.related)).toBe(true)
    expect(reasoning.recentEpisodes.length).toBeGreaterThan(0)
  }, 120_000)
})
