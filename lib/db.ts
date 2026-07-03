import { getSupabaseBrowser } from './supabase'
import { invalidateRetrievalCache } from './ai/retrieval-cache'
import type { BeroProfile } from './memory'
import type { ModuleItem, ActionType } from './modules'
import { DEFAULT_MODULES, migrateModule } from './modules'

function db() {
  return getSupabaseBrowser()
}

let _userId: string | null = null

async function uid(): Promise<string> {
  if (_userId) return _userId
  const { data } = await db().from('profiles').select('id').limit(1).single()
  if (!data?.id) throw new Error('No profile found — POST /api/setup to seed.')
  _userId = data.id as string
  return _userId
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function dbLoadProfile(): Promise<BeroProfile> {
  const userId = await uid()
  const { data, error } = await db()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  const defaults = (await import('./memory')).DEFAULT_PROFILE
  if (!data) return defaults
  return {
    name:                 data.name                 ?? defaults.name,
    age:                  data.age                  ?? defaults.age,
    location:             data.location             ?? defaults.location,
    goal:                 data.goal                 ?? defaults.goal,
    ielts_target:         data.ielts_target         ?? defaults.ielts_target,
    ielts_exam:           data.ielts_exam           ?? data.ielts_date ?? defaults.ielts_exam,
    project:              data.project              ?? defaults.project,
    application_deadline: data.application_deadline ?? defaults.application_deadline,
    universities:         data.universities         ?? defaults.universities,
    strengths:            data.strengths            ?? defaults.strengths,
    weaknesses:           data.weaknesses           ?? defaults.weaknesses,
  }
}

export async function dbSaveProfile(profile: Partial<BeroProfile>): Promise<void> {
  const userId = await uid()
  const { error } = await db()
    .from('profiles')
    .upsert({ id: userId, ...profile, updated_at: new Date().toISOString() })
  if (error) throw error
}

// ─── Memories ─────────────────────────────────────────────────────────────────

export async function dbLoadMemories(): Promise<import('./memory').Memory[]> {
  const userId = await uid()
  const { data, error } = await db()
    .from('memories')
    .select('id, summary, date')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) throw error
  return (data ?? []) as import('./memory').Memory[]
}

export async function dbSaveMemory(summary: string): Promise<void> {
  const userId = await uid()
  const date = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const { error } = await db().from('memories').insert({ user_id: userId, summary, date })
  if (error) throw error
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface ConversationMeta {
  id: string
  title: string
  created_at: string
}

export type ConversationMessage = { role: string; content: string }

export async function dbSaveConversation(
  sessionId: string,
  title: string,
  messages: ConversationMessage[]
): Promise<void> {
  const userId = await uid()
  const { error } = await db().from('conversations').upsert(
    { id: sessionId, title, messages, user_id: userId, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
  if (error) throw error
}

export async function dbLoadConversations(): Promise<ConversationMeta[]> {
  const userId = await uid()
  const { data, error } = await db()
    .from('conversations')
    .select('id, title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as ConversationMeta[]
}

export async function dbLoadConversation(id: string): Promise<ConversationMessage[] | null> {
  const { data, error } = await db()
    .from('conversations')
    .select('messages')
    .eq('id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return (data?.messages as ConversationMessage[]) ?? null
}

export async function dbDeleteConversation(id: string): Promise<void> {
  const { error } = await db().from('conversations').delete().eq('id', id)
  if (error) throw error
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export interface Habit {
  id: string
  name: string
  emoji: string
  order_index: number
  active: boolean
}

export async function dbLoadHabits(): Promise<Habit[]> {
  const userId = await uid()
  const { data, error } = await db()
    .from('habits')
    .select('id, name, emoji, order_index, active')
    .eq('user_id', userId)
    .eq('active', true)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []) as Habit[]
}

// ─── Habit Logs ───────────────────────────────────────────────────────────────

export type HabitLogStore = Record<string, boolean>

export async function dbLoadHabitLogs(): Promise<HabitLogStore> {
  const userId = await uid()
  const { data, error } = await db()
    .from('habit_logs')
    .select('date, habit_id, completed')
    .eq('user_id', userId)

  if (error) throw error

  const out: HabitLogStore = {}
  ;(data ?? []).forEach((r) => { if (r.completed) out[`${r.date}|${r.habit_id}`] = true })
  return out
}

export async function dbToggleHabitLog(date: string, habitId: string, on: boolean): Promise<void> {
  const userId = await uid()
  if (on) {
    const { error } = await db().from('habit_logs').upsert(
      { user_id: userId, date, habit_id: habitId, completed: true },
      { onConflict: 'user_id,date,habit_id' },
    )
    if (error) throw error
  } else {
    const { error } = await db().from('habit_logs')
      .delete()
      .eq('user_id', userId)
      .eq('date', date)
      .eq('habit_id', habitId)
    if (error) throw error
  }
}

// ─── Module Order ─────────────────────────────────────────────────────────────

function applyDbOrder(modules: ModuleItem[], order: string[]): ModuleItem[] {
  if (!order || order.length === 0) return modules
  const map = new Map(modules.map((m) => [m.id, m]))
  const sorted = order.map((id) => map.get(id)).filter(Boolean) as ModuleItem[]
  const inOrder = new Set(order)
  const rest = modules.filter((m) => !inOrder.has(m.id))
  return [...sorted, ...rest]
}

async function dbLoadModuleOrder(): Promise<string[]> {
  const userId = await uid()
  const { data, error } = await db()
    .from('modules_order')
    .select('order_data')
    .eq('user_id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return (data?.order_data as string[]) ?? []
}

export async function dbSaveModuleOrder(order: string[]): Promise<void> {
  const userId = await uid()
  const { error } = await db()
    .from('modules_order')
    .upsert({ user_id: userId, order_data: order }, { onConflict: 'user_id' })
  if (error) throw error
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export async function dbLoadModules(): Promise<ModuleItem[]> {
  const userId = await uid()
  const [{ data, error }, order] = await Promise.all([
    db().from('modules').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    dbLoadModuleOrder().catch(() => [] as string[]),
  ])

  if (error) throw error

  if (data && data.length > 0) {
    const mods = data.map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      data: row.data ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    return applyDbOrder(mods, order)
  }

  await dbInitModules(userId)
  const { data: fresh, error: freshError } = await db()
    .from('modules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (freshError) throw freshError

  const mods = (fresh ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    data: row.data ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
  return applyDbOrder(mods, order)
}

async function dbInitModules(userId: string): Promise<void> {
  const rows = DEFAULT_MODULES.map((m) => ({
    id: m.id,
    user_id: userId,
    name: m.name,
    icon: m.icon,
    color: m.color,
    data: m.data,
  }))
  const { error } = await db().from('modules').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function dbMigrateModules(): Promise<void> {
  const userId = await uid()
  const now = new Date().toISOString()
  const { data, error } = await db()
    .from('modules')
    .select('*')
    .eq('user_id', userId)
  if (error || !data) return

  const rows = data.map((row) => {
    const current: ModuleItem = {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      data: row.data ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
    const migrated = migrateModule(current)
    return {
      id: migrated.id,
      user_id: userId,
      name: migrated.name,
      icon: migrated.icon,
      color: migrated.color,
      data: migrated.data,
      updated_at: now,
    }
  })

  await db().from('modules').upsert(rows, { onConflict: 'id' })
}

function dbNameOf(item: unknown): string {
  if (item !== null && typeof item === 'object') {
    const o = item as Record<string, unknown>
    return String(o.name ?? o.title ?? o.label ?? '').toLowerCase().trim()
  }
  return String(item).toLowerCase().trim()
}

async function dbGetModuleData(userId: string, id: string): Promise<Record<string, unknown>> {
  const { data: row } = await db()
    .from('modules')
    .select('data')
    .eq('user_id', userId)
    .eq('id', id)
    .single()
  return (row?.data as Record<string, unknown>) ?? {}
}

async function dbPatchModuleData(
  userId: string,
  id: string,
  patch: Record<string, unknown>,
  now: string,
  existing?: Record<string, unknown>
): Promise<void> {
  const base = existing ?? await dbGetModuleData(userId, id)
  await db().from('modules')
    .update({ data: { ...base, ...patch }, updated_at: now })
    .eq('user_id', userId)
    .eq('id', id)
}

export async function dbExecuteAction(action: ActionType): Promise<ModuleItem[]> {
  const userId = await uid()
  const now = new Date().toISOString()

  switch (action.type) {
    case 'CREATE_MODULE': {
      const { id, name, icon, color, data } = action.payload
      await db().from('modules').upsert(
        { id, user_id: userId, name, icon, color, data: data ?? {}, updated_at: now },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      break
    }

    case 'DELETE_MODULE':
    case 'REMOVE_MODULE': {
      await db().from('modules').delete().eq('user_id', userId).eq('id', action.payload.id)
      break
    }

    case 'UPDATE_MODULE_META': {
      const meta: Record<string, string> = { updated_at: now }
      if (action.payload.name  !== undefined) meta.name  = action.payload.name
      if (action.payload.icon  !== undefined) meta.icon  = action.payload.icon
      if (action.payload.color !== undefined) meta.color = action.payload.color
      await db().from('modules').update(meta).eq('user_id', userId).eq('id', action.payload.id)
      break
    }

    case 'REORDER_MODULES': {
      await dbSaveModuleOrder(action.payload.order)
      break
    }

    case 'UPDATE_MODULE': {
      const base = await dbGetModuleData(userId, action.payload.id)
      await dbPatchModuleData(userId, action.payload.id, action.payload.patch, now, base)
      break
    }

    case 'ADD_FIELD':
    case 'UPDATE_FIELD': {
      const base = await dbGetModuleData(userId, action.payload.id)
      await dbPatchModuleData(userId, action.payload.id, { [action.payload.field]: action.payload.value }, now, base)
      break
    }

    case 'ADD_ITEM_TO_FIELD': {
      const base = await dbGetModuleData(userId, action.payload.id)
      const existing = (base[action.payload.field] as unknown[]) ?? []
      const newName = dbNameOf(action.payload.item)
      if (newName && existing.some((i) => dbNameOf(i) === newName)) break
      await dbPatchModuleData(userId, action.payload.id, { [action.payload.field]: [...existing, action.payload.item] }, now, base)
      break
    }

    case 'APPEND_TO_FIELD': {
      const base = await dbGetModuleData(userId, action.payload.id)
      const existing = (base[action.payload.field] as unknown[]) ?? []
      await dbPatchModuleData(userId, action.payload.id, { [action.payload.field]: [...existing, action.payload.item] }, now, base)
      break
    }

    case 'REMOVE_ITEM': {
      const base = await dbGetModuleData(userId, action.payload.id)
      const existing = (base[action.payload.field] as unknown[]) ?? []
      const target = action.payload.name.toLowerCase().trim()
      const filtered = existing.filter((i) => dbNameOf(i) !== target)
      await dbPatchModuleData(userId, action.payload.id, { [action.payload.field]: filtered }, now, base)
      break
    }

    case 'CLEAR_FIELD': {
      const base = await dbGetModuleData(userId, action.payload.id)
      await dbPatchModuleData(userId, action.payload.id, { [action.payload.field]: [] }, now, base)
      break
    }
  }

  return dbLoadModules()
}

export async function dbAddItemToField(
  moduleId: string,
  field: string,
  item: unknown
): Promise<ModuleItem[]> {
  const userId = await uid()
  const { data: row } = await db()
    .from('modules')
    .select('data')
    .eq('user_id', userId)
    .eq('id', moduleId)
    .single()

  const existing = ((row?.data as Record<string, unknown>)?.[field] as unknown[]) ?? []
  const patch = { [field]: [...existing, item] }

  await db().from('modules')
    .update({ data: { ...(row?.data ?? {}), ...patch }, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', moduleId)

  return dbLoadModules()
}

export async function dbRemoveItemFromField(
  moduleId: string,
  field: string,
  index: number
): Promise<ModuleItem[]> {
  const userId = await uid()
  const { data: row } = await db()
    .from('modules')
    .select('data')
    .eq('user_id', userId)
    .eq('id', moduleId)
    .single()

  const existing = [...(((row?.data as Record<string, unknown>)?.[field] as unknown[]) ?? [])]
  existing.splice(index, 1)
  const patch = { [field]: existing }

  await db().from('modules')
    .update({ data: { ...(row?.data ?? {}), ...patch }, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', moduleId)

  return dbLoadModules()
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id?: string
  date: string
  mood: number
  day_score: number
  question_1: string
  answer_1: string
  question_2: string
  answer_2: string
  free_write: string
}

export interface JournalQuestion {
  id: string
  question: string
}

export async function dbLoadJournalQuestions(): Promise<JournalQuestion[]> {
  const { data, error } = await db()
    .from('journal_questions')
    .select('id, question')
    .order('id')
  if (error) throw error
  return (data ?? []) as JournalQuestion[]
}

export async function dbLoadJournalEntry(date: string): Promise<JournalEntry | null> {
  const userId = await uid()
  const { data, error } = await db()
    .from('journal_entries')
    .select('id, date, mood, day_score, question_1, answer_1, question_2, answer_2, free_write')
    .eq('user_id', userId)
    .eq('date', date)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null
  const d = data as Record<string, unknown>
  return { ...d, date: String(d.date).slice(0, 10) } as unknown as JournalEntry
}

export async function dbSaveJournalEntry(entry: Omit<JournalEntry, 'id'>): Promise<void> {
  const userId = await uid()
  const { error } = await db().from('journal_entries').upsert(
    { ...entry, user_id: userId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,date' },
  )
  if (error) throw error
}

export async function dbLoadJournalDates(): Promise<string[]> {
  const userId = await uid()
  const { data, error } = await db()
    .from('journal_entries')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => String((r as Record<string, unknown>).date).slice(0, 10))
}

// ─── Essays ───────────────────────────────────────────────────────────────────

export type EssayStatus = 'brainstorm' | 'draft' | 'revision' | 'done'

export interface Essay {
  id: string
  title: string
  school: string | null
  prompt: string
  word_limit: number | null
  status: EssayStatus
  created_at: string
  updated_at: string
}

export interface EssayVersion {
  id: string
  essay_id: string
  version_number: number
  content: string
  created_at: string
}

export async function dbLoadEssays(): Promise<Essay[]> {
  const userId = await uid()
  const { data, error } = await db()
    .from('essays')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Essay[]
}

export async function dbCreateEssay(input: {
  title: string
  school?: string
  prompt: string
  word_limit?: number | null
}): Promise<Essay> {
  const userId = await uid()
  const { data, error } = await db()
    .from('essays')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as Essay
}

export async function dbUpdateEssayMeta(
  id: string,
  patch: Partial<Pick<Essay, 'title' | 'school' | 'prompt' | 'word_limit' | 'status'>>
): Promise<void> {
  const { error } = await db()
    .from('essays')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function dbDeleteEssay(id: string): Promise<void> {
  const { error } = await db().from('essays').delete().eq('id', id)
  if (error) throw error
}

export async function dbLoadEssayVersions(essayId: string): Promise<EssayVersion[]> {
  const { data, error } = await db()
    .from('essay_versions')
    .select('*')
    .eq('essay_id', essayId)
    .order('version_number', { ascending: false })
  if (error) throw error
  return (data ?? []) as EssayVersion[]
}

// Her kayıt yeni versiyon — mevcut en yüksek numaranın bir üstünü açar.
export async function dbSaveEssayVersion(essayId: string, content: string): Promise<EssayVersion> {
  const { data: last } = await db()
    .from('essay_versions')
    .select('version_number')
    .eq('essay_id', essayId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  const nextNumber = ((last?.version_number as number) ?? 0) + 1
  const { data, error } = await db()
    .from('essay_versions')
    .insert({ essay_id: essayId, version_number: nextNumber, content })
    .select()
    .single()
  if (error) throw error

  await db().from('essays')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', essayId)

  return data as EssayVersion
}

// ─── Calendar Events ──────────────────────────────────────────────────────────
// calendar_events tablosunda user_id kolonu yok (bkz. faz0-denetim-raporu.md §1.3) —
// bu yüzden diğer db.ts fonksiyonlarının aksine uid() filtresi uygulanmıyor.

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  category: string | null
}

export async function dbLoadCalendarEvents(start: string, end: string): Promise<CalendarEvent[] | null> {
  const { data } = await db()
    .from('calendar_events')
    .select('*')
    .gte('start_time', start)
    .lt('start_time', end)
  return (data as CalendarEvent[] | null) ?? null
}

export async function dbCreateCalendarEvent(input: {
  title: string
  description: string | null
  start_time: string
  end_time: string
  category: string
}): Promise<CalendarEvent | null> {
  const { data } = await db()
    .from('calendar_events')
    .insert(input)
    .select()
    .single()
  return (data as CalendarEvent | null) ?? null
}

export async function dbUpdateCalendarEventTime(id: string, startTime: string, endTime: string): Promise<void> {
  await db()
    .from('calendar_events')
    .update({ start_time: startTime, end_time: endTime })
    .eq('id', id)
}

export async function dbUpdateCalendarEventMeta(
  id: string,
  patch: { title: string; description: string | null; category: string }
): Promise<void> {
  await db().from('calendar_events').update(patch).eq('id', id)
}

export async function dbDeleteCalendarEvent(id: string): Promise<void> {
  await db().from('calendar_events').delete().eq('id', id)
}

// ─── Notion Sandbox (block_pages) ───────────────────────────────────────────────
// Tek deneysel sayfa: en son güncellenen block_pages satırı. user_id kolonu yok.

export async function dbLoadLatestBlockPage(): Promise<{ id: string; content: unknown } | null> {
  const { data } = await db()
    .from('block_pages')
    .select('id, content')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? { id: data.id as string, content: data.content } : null
}

export async function dbUpdateBlockPage(id: string, content: unknown): Promise<void> {
  await db()
    .from('block_pages')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)
}

export async function dbCreateBlockPage(content: unknown): Promise<string | null> {
  const { data } = await db()
    .from('block_pages')
    .insert({ content })
    .select('id')
    .single()
  return (data?.id as string) ?? null
}

export async function dbLoadRecentJournalEntries(limit = 5): Promise<JournalEntry[]> {
  const userId = await uid()
  const { data, error } = await db()
    .from('journal_entries')
    .select('id, date, mood, day_score, free_write')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => {
    const d = r as Record<string, unknown>
    return { ...d, date: String(d.date).slice(0, 10) }
  }) as unknown as JournalEntry[]
}

// ─── Entities & Links (Faz 1 — Unified Entity Core) ──────────────────────────
// entities/links yazma yolu (migration 0001). İki nedenle bu dosyanın diğer
// fonksiyonlarından farklı çalışır:
// 1) RLS: entities/links politikaları auth.uid() ister; gerçek Auth Faz 5'e
//    kadar kurulmadığından yazma service-role client ile SUNUCUDA yapılır
//    (chat route ve agents/runner'daki lazy-admin deseniyle aynı).
// 2) Embedding: LocalEmbeddingProvider (transformers.js + onnxruntime) yalnız
//    sunucuda anlamlı. Her iki bağımlılık da lazy import edilir ki bu dosya
//    istemci bundle'ında kalabilsin (dbLoadModules vb. istemciden kullanılıyor).
// user_id parametre olarak alınır: sunucuda browser-session'lı uid() yok;
// köprü senkronu ve fixture importu çağırdıkları bağlamın kimliğini geçer.

export type EntityType =
  | 'journal' | 'goal' | 'note' | 'project' | 'person'
  | 'task' | 'essay' | 'habit' | 'resource' | 'event'

export type LinkKind = 'semantic' | 'user' | 'wikilink'

export interface Entity {
  id: string
  user_id: string
  type: EntityType
  title: string
  content: string | null
  source_table: string | null
  source_id: string | null
  created_at: string
  updated_at: string
}

export interface EntityLink {
  id: string
  source_entity_id: string
  target_entity_id: string
  kind: LinkKind
  label: string | null
  strength: number | null
  created_at: string
}

async function entityDeps() {
  const [{ getSupabaseAdmin }, { getLocalEmbeddingProvider }] = await Promise.all([
    import('./supabase-admin'),
    import('./ai/local-embedding'),
  ])
  return { supabase: getSupabaseAdmin(), embedder: getLocalEmbeddingProvider() }
}

export interface CreateEntityInput {
  userId: string
  type: EntityType
  title: string
  content?: string
  /** Köprü satırı için silo referansı — ikisi birlikte verilir (şema CHECK'i). */
  sourceTable?: string
  sourceId?: string
  /** Fixture/test verisi için tarih override'ı; verilmezse DB default now(). */
  createdAt?: string
}

/** Entity yaratır; embedding'i (title + content) üzerinden hesaplayıp kaydeder. */
export async function createEntity(input: CreateEntityInput): Promise<Entity> {
  const { supabase, embedder } = await entityDeps()
  const embeddingText = input.content ? `${input.title}\n\n${input.content}` : input.title
  const [embedding] = await embedder.embed([embeddingText])

  const row: Record<string, unknown> = {
    user_id: input.userId,
    type: input.type,
    title: input.title,
    content: input.content ?? null,
    embedding,
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
  }
  if (input.createdAt) row.created_at = input.createdAt

  const { data, error } = await supabase
    .from('entities')
    .insert(row)
    .select('id, user_id, type, title, content, source_table, source_id, created_at, updated_at')
    .single()
  if (error) throw error

  invalidateRetrievalCache()
  return data as Entity
}

export interface CreateLinkInput {
  sourceEntityId: string
  targetEntityId: string
  kind: LinkKind
  label?: string
  /** Yalnız kind='semantic' için: benzerlik skoru [0, 1] (şema CHECK'i). */
  strength?: number
}

/** İki entity arasına kenar ekler; aynı (source, target, kind) varsa günceller. */
export async function createLink(input: CreateLinkInput): Promise<EntityLink> {
  if (input.kind !== 'semantic' && input.strength !== undefined) {
    throw new Error("createLink: strength yalnız kind='semantic' kenarlarda geçerli (şema CHECK'i).")
  }
  const { supabase } = await entityDeps()
  const { data, error } = await supabase
    .from('links')
    .upsert(
      {
        source_entity_id: input.sourceEntityId,
        target_entity_id: input.targetEntityId,
        kind: input.kind,
        label: input.label ?? null,
        strength: input.strength ?? null,
      },
      { onConflict: 'source_entity_id,target_entity_id,kind' },
    )
    .select('id, source_entity_id, target_entity_id, kind, label, strength, created_at')
    .single()
  if (error) throw error

  invalidateRetrievalCache()
  return data as EntityLink
}

/** Entity'yi siler (bağlı links satırları FK cascade ile düşer). */
export async function deleteEntity(id: string): Promise<void> {
  const { supabase } = await entityDeps()
  const { error } = await supabase.from('entities').delete().eq('id', id)
  if (error) throw error
  invalidateRetrievalCache()
}
