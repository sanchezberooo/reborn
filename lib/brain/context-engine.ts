// Context Engine (Sprint 4) — Sanchez'e (ve gelecekte her tüketiciye)
// verilecek bağlamın TEK üretim yeri. İki kapı:
//   * buildContext           — kaynak-birleştirici: ContextSource listesi +
//                              karakter bütçesi → düz bağlam kalemleri.
//                              lib/ai/chat-context.ts buildChatContext artık
//                              buraya delege eder (davranış birebir korunur).
//   * buildReasoningContext  — yapılandırılmış muhakeme bağlamı: sabitlenmiş
//                              kimlik çekirdeği + getirilen hafıza + graf
//                              komşuluğu + yakın geçmiş. FAZ AI'da Sanchez'in
//                              system prompt'una bağlanacak sözleşme budur.
//
// KAYNAK MİMARİSİ (Sprint 4 Context Engine maddesi): her kaynak ContextSource
// sözleşmesini uygular ve GERÇEKTİR — bugün dört kaynak yaşıyor: hafıza
// (hibrit retrieval; scope'suz=iki Brain, scope'lu=tek Brain), açık iş
// emirleri (lib/tasks), aktif hedefler, timeline. Calendar/Department/Project
// gibi yeni kaynaklar aynı sözleşmeyle EKLENİR — buildContext ve tüketiciler
// değişmez. Hangi profil hangi kaynakları alır kararı ÇAĞIRANDADIR:
// SANCHEZ_CHAT_SOURCES bugünkü chat davranışını birebir taşır (yalnız
// hafıza); diğer kaynakları chat'e açmak FAZ AI kalibrasyon kararıdır,
// bu sprintin işi motorun kendisidir.

import 'server-only'
import { hybridRetrieve } from '../ai/retrieval'
import { listOpenTasks } from '../tasks/repository'
import { brainDeps, mapNodeRow, NODE_COLUMNS } from './db'
import { getNeighbors } from './graph'
import { getTimeline } from './memory-engine'
import { rankItems } from './scoring'
import type { RetrievedEntity } from '../ai/retrieval'
import type { BrainNode, BrainScope, NodeType } from './types'

// ── Sözleşme ────────────────────────────────────────────────────────────────

export interface ContextRequest {
  /** Retrieval sorgusu — genellikle kullanıcının son mesajı. */
  query: string
  userId: string
}

export interface ContextItem {
  /** Üreten kaynağın kimliği (şeffaflık + hata ayıklama). */
  source: string
  type: string
  title: string
  snippet: string | null
  createdAt: string
}

export interface ContextSource {
  /** kebab-case kaynak kimliği (örn 'memory', 'open-tasks'). */
  readonly id: string
  collect(req: ContextRequest, limit: number): Promise<ContextItem[]>
}

// ── Bütçe sabitleri — chat-context.ts'ten devralındı (davranış birebir) ─────

const SNIPPET_LENGTH = 280
const CONTEXT_CHAR_BUDGET = 8000
const LINE_OVERHEAD_CHARS = 24
const DEFAULT_SOURCE_LIMIT = 8

function toSnippet(content: string | null): string | null {
  if (!content) return null
  const flat = content.replace(/\s+/g, ' ').trim()
  if (!flat) return null
  return flat.length > SNIPPET_LENGTH ? `${flat.slice(0, SNIPPET_LENGTH)}…` : flat
}

// ── Kaynaklar (hepsi gerçek) ────────────────────────────────────────────────

/**
 * Hafıza kaynağı — hibrit retrieval (semantik + link grafı + recency).
 * scope verilmezse İKİ Brain'i de tarar: bugünkü Sanchez chat davranışı
 * budur (bilinçli — Sanchez tüm organizmanın tek muhatabıdır); scope'lu
 * kurulum tek Brain'e daraltır.
 */
export function memorySource(scope?: BrainScope): ContextSource {
  return {
    id: scope ? `${scope}-brain` : 'memory',
    async collect(req, limit) {
      const results = await hybridRetrieve(req.query, { userId: req.userId, limit, scope })
      return results.map((r: RetrievedEntity) => ({
        source: scope ? `${scope}-brain` : 'memory',
        type: r.type,
        title: r.title,
        snippet: toSnippet(r.content),
        createdAt: r.createdAt,
      }))
    },
  }
}

/** Açık iş emirleri (MAXAİ kuyruğu) — Sanchez'in "şirkette ne dönüyor"
 *  farkındalığının kaynağı. Sorgudan bağımsızdır: açık işler her bağlamda
 *  aynıdır; sıralama kuyruk düzenidir (öncelik + yaş repository'de). */
export const openTasksSource: ContextSource = {
  id: 'open-tasks',
  async collect(req, limit) {
    const tasks = await listOpenTasks(req.userId, limit)
    return tasks.map((task) => ({
      source: 'open-tasks',
      type: 'agent-task',
      title: `[${task.status}${task.department ? ` · ${task.department}` : ''}] ${task.title}`,
      snippet: toSnippet(task.description ?? (task.error ? `Hata: ${task.error}` : null)),
      createdAt: task.createdAt,
    }))
  },
}

/** Aktif hedefler — goals NATIVE modda entities'te yaşar (migration 0002);
 *  goals uzantısındaki status='active' filtresiyle. */
export const activeGoalsSource: ContextSource = {
  id: 'active-goals',
  async collect(req, limit) {
    const { supabase } = await brainDeps()
    const { data, error } = await supabase
      .from('entities')
      .select(`${NODE_COLUMNS}, goals!inner(status, target_date)`)
      .eq('user_id', req.userId)
      .eq('type', 'goal')
      .eq('goals.status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map((row) => {
      const node = mapNodeRow(row as Record<string, unknown>)
      const goal = (row as { goals?: { target_date?: string | null } }).goals
      return {
        source: 'active-goals',
        type: 'goal',
        title: goal?.target_date ? `${node.title} (hedef: ${goal.target_date})` : node.title,
        snippet: toSnippet(node.content),
        createdAt: node.createdAt,
      }
    })
  },
}

/** Yakın geçmiş — episodic timeline'ın kaynak yüzü (Memory Engine). */
export const recentTimelineSource: ContextSource = {
  id: 'recent-timeline',
  async collect(req, limit) {
    const episodes = await getTimeline(req.userId, { scope: 'personal', limit })
    return episodes.map((node) => ({
      source: 'recent-timeline',
      type: node.type,
      title: node.title,
      snippet: toSnippet(node.content),
      createdAt: node.createdAt,
    }))
  },
}

/** Sanchez chat'in bugünkü bağlam profili — YALNIZ hafıza kaynağı, scope'suz
 *  (davranış Sprint 4 öncesiyle birebir; genişletme FAZ AI kararı). */
export const SANCHEZ_CHAT_SOURCES: ContextSource[] = [memorySource()]

// ── Birleştirici ────────────────────────────────────────────────────────────

export interface BuildContextOptions {
  sources: ContextSource[]
  /** Kaynak başına kalem limiti (varsayılan 8 — chat davranışı). */
  perSourceLimit?: number
  /** Toplam karakter bütçesi (varsayılan ~2000 token ≈ 8000 karakter). */
  charBudget?: number
}

/**
 * Kaynaklardan paralel toplar, kaynak sırasını koruyarak bütçeyi uygular:
 * kaynakların listedeki sırası öncelik sırasıdır (ilk kaynak bütçeden önce
 * yer alır), kaynak İÇİ sıra kaynağın kendi sıralamasıdır (retrieval skoru /
 * kuyruk düzeni). Bütçe formülü chat-context'in tarihsel formülüdür —
 * başlık + snippet + satır yükü.
 */
export async function buildContext(
  req: ContextRequest,
  opts: BuildContextOptions,
): Promise<ContextItem[]> {
  const perSourceLimit = opts.perSourceLimit ?? DEFAULT_SOURCE_LIMIT
  const charBudget = opts.charBudget ?? CONTEXT_CHAR_BUDGET

  const collected = await Promise.all(
    opts.sources.map(async (source) => {
      try {
        return await source.collect(req, perSourceLimit)
      } catch (err) {
        // Tek kaynağın hatası bağlamın tamamını düşürmez (chat-context ilkesi).
        console.error(`[Reborn Brain] context kaynağı '${source.id}' hatası:`, err)
        return []
      }
    }),
  )

  const items: ContextItem[] = []
  let used = 0
  for (const sourceItems of collected) {
    for (const item of sourceItems) {
      const cost = item.title.length + (item.snippet?.length ?? 0) + LINE_OVERHEAD_CHARS
      if (used + cost > charBudget) break
      used += cost
      items.push(item)
    }
  }
  return items
}

// ── Reasoning Context Builder ───────────────────────────────────────────────

/** Kimlik çekirdeği tipleri: her muhakeme bağlamına sorgudan bağımsız girer
 *  ("kim olmak istiyorsun" sorusunun cevabı retrieval şansına bırakılmaz). */
const PINNED_TYPES: readonly NodeType[] = ['identity', 'preference']
const PINNED_LIMIT = 5
const REASONING_RETRIEVE_LIMIT = 8
const RELATED_PER_SEED = 3
const RECENT_EPISODES_LIMIT = 5

export interface ReasoningContext {
  /** Kimlik çekirdeği (identity + preference) — önem sırasıyla. */
  pinned: BrainNode[]
  /** Sorguya göre getirilen hafıza (hibrit). */
  retrieved: RetrievedEntity[]
  /** En güçlü getirilenlerin graf komşuları ("bununla bağlantılı ne var"). */
  related: { seedId: string; node: BrainNode }[]
  /** Yakın episodic geçmiş (timeline penceresi). */
  recentEpisodes: BrainNode[]
}

/**
 * Yapılandırılmış muhakeme bağlamı — dört katman tek çağrıda. Tüketicisi
 * bugün test + gelecekte Sanchez system prompt'u (FAZ AI); yapı o günün
 * sözleşmesi olarak sabitlenir: katman ekleme geriye uyumludur.
 */
export async function buildReasoningContext(query: string, userId: string): Promise<ReasoningContext> {
  const { supabase } = await brainDeps()

  const [pinnedRows, retrieved, recentEpisodes] = await Promise.all([
    supabase
      .from('entities')
      .select(NODE_COLUMNS)
      .eq('user_id', userId)
      .eq('scope', 'personal')
      .in('type', [...PINNED_TYPES])
      .neq('status', 'eskimiş')
      .order('updated_at', { ascending: false })
      .limit(PINNED_LIMIT * 3),
    query.trim()
      ? hybridRetrieve(query, { userId, limit: REASONING_RETRIEVE_LIMIT })
      : Promise.resolve([]),
    getTimeline(userId, { scope: 'personal', limit: RECENT_EPISODES_LIMIT }),
  ])
  if (pinnedRows.error) throw pinnedRows.error

  const pinnedNodes = (pinnedRows.data ?? []).map((r) => mapNodeRow(r as Record<string, unknown>))
  const pinned = rankItems(pinnedNodes.map((node) => ({
    node,
    type: node.type,
    status: node.status,
    freshnessAnchor: node.updatedAt,
    confidenceCount: node.confidenceCount,
  }))).slice(0, PINNED_LIMIT).map((r) => r.node)

  // Graf genişletmesi: en güçlü 3 getirilenin 1-hop komşuları; getirilenlerle
  // ve birbirleriyle mükerrer komşular tekilleştirilir.
  const related: { seedId: string; node: BrainNode }[] = []
  const seen = new Set<string>(retrieved.map((r) => r.id))
  for (const seed of retrieved.slice(0, 3)) {
    const neighbors = await getNeighbors(seed.id, { scope: 'personal', limit: RELATED_PER_SEED })
    for (const neighbor of neighbors) {
      if (seen.has(neighbor.node.id)) continue
      seen.add(neighbor.node.id)
      related.push({ seedId: seed.id, node: neighbor.node })
    }
  }

  return { pinned, retrieved, related, recentEpisodes }
}
