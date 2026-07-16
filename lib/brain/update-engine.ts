// Brain Update Engine (Sprint 4) — yeni bilginin Brain'e YAZILMA kuralları:
// dedup, çakışma tespiti, merge/versiyonlama, otomatik ilişki, önem puanı.
// Tek giriş kapısı applyBrainUpdate'tir; karar hattı DETERMİNİSTİKTİR
// (benzerlik eşikleri) — LLM çağrısı yoktur, çağıran LLM'ler (Sanchez /
// Knowledge Agent, Sprint 5) bu kapıyı tool arkasından kullanacaktır.
//
// KARAR HATTI (embed bir kez hesaplanır, HNSW adayları bir kez çekilir):
//   1. En benzer AYNI TİPTEN aday ≥ DEDUP eşiği:
//      a. içerik normalize-eşitse  → CONFIRM: yeni node YOK; mevcut node'un
//         confidence_count'u artar, last_verified_at tazelenir (aynı bilginin
//         tekrar gelmesi doğrulamadır — kopya değil).
//      b. içerik farklıysa         → SUPERSEDE (merge stratejisi): yeni node
//         yaratılır, eski 'eskimiş' olur, yeni→eski supersedes kenarı kurulur.
//         MERGE = "yeni içerik esas, eski versiyon zincirde" — iki metni
//         deterministik birleştirmeye ÇALIŞILMAZ (kırpma/yapıştırma bilgi
//         bozar); zincir getVersionHistory ile her an okunur.
//   2. Eşik altı → CREATE: yeni node.
//   3. Her iki yolda da otomatik ilişki: autoLinkNode (hiçbir kayıt yalnız
//      yaşamamalı) — CONFIRM'de mevcut node yeniden bağlanmaz (bağları var).
//   4. Çakışma TESPİTİ karar değil GÖZLEMDİR (link-registry markContradiction
//      ilkesi): aynı tipten, çakışma bandında benzer ama içeriği farklı
//      adaylar conflictCandidates olarak DÖNDÜRÜLÜR; contradicts kenarını
//      kurmak çağıranın (insan / Knowledge Agent) bilinçli kararıdır.
//
// SCOPE DİSİPLİNİ: tip, scope'un envanterinde olmak zorunda (personal tipe
// agent scope verilemez, tersi de). Agent scope'ta 'signal' bu kapıdan
// YAZILAMAZ — sıcak katman girişi createSignal'dır (node-repository);
// bu kapı bilgi (soğuk katman) yazar ve status='aday' ile doğar (Agent
// Brain yaşam döngüsü korunur). Personal scope 'doğrulanmış' doğar (kullanıcı
// beyanı doğrulanmış sayılır — şema default'uyla aynı).

import 'server-only'
import {
  brainDeps, getNodesByIds, mapNodeRow, matchSimilarNodes, NODE_COLUMNS,
} from './db'
import { getNeighbors } from './graph'
import { autoLinkNode } from './memory-engine'
import { computeImportance } from './scoring'
import type { BrainNode, BrainScope, NodeStatus, NodeType } from './types'
import { AGENT_NODE_TYPES, PERSONAL_NODE_TYPES } from './types'

// ── Eşikler ─────────────────────────────────────────────────────────────────
// bge-m3 kosinüs bantları (canlı ölçümlerle uyumlu): ≥0.92 fiilen aynı bilgi;
// 0.75–0.92 aynı konu, muhtemel revizyon/çelişki bandı; 0.6–0.75 komşuluk.

export const DEDUP_THRESHOLD = 0.92
export const CONFLICT_BAND_MIN = 0.75
export const CANDIDATE_FETCH_LIMIT = 12

export interface BrainUpdateOptions {
  dedupThreshold?: number
  conflictBandMin?: number
  /** autoLinkNode'a geçer (test/kalibrasyon kanalı). */
  linkThreshold?: number
  linkTopK?: number
}

export interface BrainUpdateInput {
  userId: string
  scope: BrainScope
  type: NodeType
  content: string
  /** Verilmezse content'ten türetilir. */
  title?: string
  /** Statü override'ı — verilmezse scope varsayılanı (üst not). */
  status?: NodeStatus
  /** Yapılandırılmış zarf (migration 0011) — CREATE/SUPERSEDE'de yazılır;
   *  CONFIRM'de mevcut node'un zarfına DOKUNULMAZ (aynı bilginin tekrarı
   *  doğrulamadır, zarf revizyonu değil). Embedding'e girmez. */
  metadata?: Record<string, unknown>
}

export interface ConflictCandidate {
  nodeId: string
  title: string
  similarity: number
}

export interface BrainUpdateResult {
  action: 'created' | 'confirmed' | 'superseded'
  node: BrainNode
  /** action='superseded' ise eskitilen node. */
  supersededNodeId?: string
  autoLinked: { nodeId: string; similarity: number }[]
  conflictCandidates: ConflictCandidate[]
  /** Yazma anındaki önem puanı (saklanmaz — ranking anında yeniden hesaplanır). */
  importance: number
}

const TITLE_MAX = 80

function deriveTitle(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > TITLE_MAX ? `${flat.slice(0, TITLE_MAX)}…` : flat
}

/** İçerik eşitliği: boşluk/harf-büyüklüğü farkı revizyon sayılmaz. */
function normalizedEqual(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr')
  return norm(a) === norm(b)
}

function assertScopeType(scope: BrainScope, type: NodeType): void {
  if (scope === 'personal' && !(PERSONAL_NODE_TYPES as readonly string[]).includes(type)) {
    throw new Error(`applyBrainUpdate: '${type}' Personal Brain tipi değil (geçerli: ${PERSONAL_NODE_TYPES.join(', ')}).`)
  }
  if (scope === 'agent') {
    if (type === 'signal') {
      throw new Error("applyBrainUpdate: 'signal' bu kapıdan yazılamaz — sıcak katman girişi createSignal'dır (lib/brain/node-repository).")
    }
    if (!(AGENT_NODE_TYPES as readonly string[]).includes(type)) {
      throw new Error(`applyBrainUpdate: '${type}' Agent Brain tipi değil (geçerli: ${AGENT_NODE_TYPES.join(', ')}).`)
    }
  }
}

/**
 * Çakışma adayı süzme — SAF fonksiyon (env'siz test edilir): aynı tipten,
 * [conflictBandMin, dedupThreshold) bandında benzer, içeriği farklı adaylar.
 * Dedup'a giden aday (dedupTargetId) çakışma değildir — zaten çözülüyor.
 */
export function findConflictCandidates(
  candidates: { id: string; type: string; title: string; content: string | null; similarity: number }[],
  input: { type: NodeType; content: string },
  opts: { conflictBandMin?: number; dedupThreshold?: number; dedupTargetId?: string } = {},
): ConflictCandidate[] {
  const bandMin = opts.conflictBandMin ?? CONFLICT_BAND_MIN
  const bandMax = opts.dedupThreshold ?? DEDUP_THRESHOLD
  return candidates
    .filter((c) =>
      c.id !== opts.dedupTargetId
      && c.type === input.type
      && c.similarity >= bandMin
      && c.similarity < bandMax
      && !(c.content !== null && normalizedEqual(c.content, input.content)),
    )
    .map((c) => ({ nodeId: c.id, title: c.title, similarity: c.similarity }))
}

/** Yazma yolu: embedding hesaplanmış node insert'i (scope/layer/status açık). */
async function insertNode(
  input: BrainUpdateInput,
  title: string,
  embedding: number[],
): Promise<BrainNode> {
  const { supabase } = await brainDeps()
  const status: NodeStatus = input.status ?? (input.scope === 'personal' ? 'doğrulanmış' : 'aday')
  const { data, error } = await supabase
    .from('entities')
    .insert({
      user_id: input.userId,
      type: input.type,
      title,
      content: input.content,
      embedding,
      scope: input.scope,
      layer: 'cold', // working memory pencere kavramıdır, katman değil (types.ts)
      status,
      metadata: input.metadata ?? null,
    })
    .select(NODE_COLUMNS)
    .single()
  if (error) throw error
  return mapNodeRow(data as Record<string, unknown>)
}

/**
 * Brain Update Engine'in tek giriş kapısı — karar hattı dosya başında.
 * Dönen result şeffaftır: ne yapıldığı (action), neyin eskitildiği, nelere
 * bağlandığı ve nelerle çakışabileceği çağırana raporlanır.
 */
export async function applyBrainUpdate(
  input: BrainUpdateInput,
  opts: BrainUpdateOptions = {},
): Promise<BrainUpdateResult> {
  const content = input.content.trim()
  if (!content) throw new Error('applyBrainUpdate: content boş olamaz.')
  assertScopeType(input.scope, input.type)

  const dedupThreshold = opts.dedupThreshold ?? DEDUP_THRESHOLD
  const title = input.title?.trim() || deriveTitle(content)

  const { embedder } = await brainDeps()
  const [embedding] = await embedder.embed([`${title}\n\n${content}`])

  const rawCandidates = await matchSimilarNodes(input.userId, embedding, {
    scope: input.scope,
    limit: CANDIDATE_FETCH_LIMIT,
  })
  // Eskimiş adaylar karar hattına girmez: dedup hedefi olamazlar (yerlerini
  // alan node zaten adaylarda), çakışma adayı da sayılmazlar.
  const candidateNodes = await getNodesByIds(rawCandidates.map((c) => c.id), input.scope)
  const statusById = new Map(candidateNodes.map((n) => [n.id, n.status]))
  const candidates = rawCandidates.filter((c) => statusById.get(c.id) !== 'eskimiş')

  const top = candidates.find((c) => c.type === input.type)
  const isDuplicate = top !== undefined && top.similarity >= dedupThreshold

  let action: BrainUpdateResult['action']
  let node: BrainNode
  let supersededNodeId: string | undefined
  let autoLinked: { nodeId: string; similarity: number }[] = []

  if (isDuplicate && top.content !== null && normalizedEqual(top.content, content)) {
    // CONFIRM — aynı bilgi yeniden geldi: doğrulama sayılır.
    const { supabase } = await brainDeps()
    const existing = candidateNodes.find((n) => n.id === top.id)
    const { data, error } = await supabase
      .from('entities')
      .update({
        confidence_count: (existing?.confidenceCount ?? 0) + 1,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', top.id)
      .eq('scope', input.scope)
      .select(NODE_COLUMNS)
      .single()
    if (error) throw error
    action = 'confirmed'
    node = mapNodeRow(data as Record<string, unknown>)
  } else if (isDuplicate) {
    // SUPERSEDE — aynı bilginin yeni versiyonu: eski eskir, zincir kurulur.
    node = await insertNode(input, title, embedding)
    const { supersede } = await import('./link-registry')
    await supersede(top.id, node.id)
    supersededNodeId = top.id
    action = 'superseded'
    autoLinked = (await autoLinkNode(node.id, { threshold: opts.linkThreshold, topK: opts.linkTopK })).linkedTo
  } else {
    // CREATE — yeni bilgi.
    node = await insertNode(input, title, embedding)
    action = 'created'
    autoLinked = (await autoLinkNode(node.id, { threshold: opts.linkThreshold, topK: opts.linkTopK })).linkedTo
  }

  const conflictCandidates = findConflictCandidates(candidates, { type: input.type, content }, {
    conflictBandMin: opts.conflictBandMin,
    dedupThreshold,
    dedupTargetId: isDuplicate ? top.id : undefined,
  })

  const importance = computeImportance({
    type: node.type,
    status: node.status,
    linkDegree: autoLinked.length,
    confidenceCount: node.confidenceCount,
  })

  return { action, node, supersededNodeId, autoLinked, conflictCandidates, importance }
}

// ── Versiyon geçmişi ────────────────────────────────────────────────────────

/**
 * Version History: supersedes zincirini iki yönde yürüyerek node'un tüm
 * versiyonlarını EN ESKİDEN EN YENİYE döner (verilen node dahil). Zincir
 * kenarları: yeni →(supersedes)→ eski. Dallanmaya karşı korumalı: her
 * yönde ilk kenar izlenir, ziyaret edilen tekrar yürünmez.
 */
export async function getVersionHistory(nodeId: string, scope: BrainScope): Promise<BrainNode[]> {
  const start = (await getNodesByIds([nodeId], scope))[0]
  if (!start) throw new Error(`getVersionHistory: node bulunamadı (${nodeId}).`)

  const visited = new Set<string>([start.id])
  const older: BrainNode[] = []
  const newer: BrainNode[] = []

  // Geriye: bu node'un eskittikleri (outgoing supersedes → daha eski).
  let cursor: BrainNode | undefined = start
  while (cursor) {
    const neighbors = await getNeighbors(cursor.id, { scope, kinds: ['supersedes'], direction: 'outgoing' })
    cursor = neighbors.map((n) => n.node).find((n) => !visited.has(n.id))
    if (cursor) {
      visited.add(cursor.id)
      older.push(cursor)
    }
  }
  // İleriye: bu node'u eskitenler (incoming supersedes → daha yeni).
  cursor = start
  while (cursor) {
    const neighbors = await getNeighbors(cursor.id, { scope, kinds: ['supersedes'], direction: 'incoming' })
    cursor = neighbors.map((n) => n.node).find((n) => !visited.has(n.id))
    if (cursor) {
      visited.add(cursor.id)
      newer.push(cursor)
    }
  }

  return [...older.reverse(), start, ...newer]
}
