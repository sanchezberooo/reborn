import { supabase } from './supabase'
import type { BeroProfile } from './memory'
import type { ModuleItem, ActionType } from './modules'
import { DEFAULT_MODULES, migrateModule } from './modules'

const BERO_ID = process.env.NEXT_PUBLIC_BERO_ID ?? '00000000-0000-0000-0000-000000000001'

function uid(): string {
  return BERO_ID
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function dbLoadProfile(): Promise<BeroProfile> {
  const userId = uid()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  // PGRST116 = row not found — return defaults. Any other error = connection problem.
  if (error && error.code !== 'PGRST116') throw error

  const defaults = (await import('./memory')).DEFAULT_PROFILE
  if (!data) return defaults
  return {
    name: data.name ?? defaults.name,
    age: data.age ?? defaults.age,
    location: data.location ?? defaults.location,
    goal: data.goal ?? defaults.goal,
    ielts_target: data.ielts_target ?? defaults.ielts_target,
    ielts_exam: data.ielts_exam ?? data.ielts_date ?? defaults.ielts_exam,
    project: data.project ?? defaults.project,
    application_deadline: data.application_deadline ?? defaults.application_deadline,
    universities: data.universities ?? defaults.universities,
    strengths: data.strengths ?? defaults.strengths,
    weaknesses: data.weaknesses ?? defaults.weaknesses,
  }
}

export async function dbSaveProfile(profile: Partial<BeroProfile>): Promise<void> {
  const userId = uid()
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profile, updated_at: new Date().toISOString() })
  if (error) throw error
}

// ─── Memories ─────────────────────────────────────────────────────────────────

export async function dbLoadMemories(): Promise<import('./memory').Memory[]> {
  const userId = uid()
  const { data, error } = await supabase
    .from('memories')
    .select('id, summary, date')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) throw error
  return (data ?? []) as import('./memory').Memory[]
}

export async function dbSaveMemory(summary: string): Promise<void> {
  const userId = uid()
  const date = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const { error } = await supabase.from('memories').insert({ user_id: userId, summary, date })
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
  const { error } = await supabase.from('conversations').upsert({ id: sessionId, title, messages })
  if (error) throw error
}

export async function dbLoadConversations(): Promise<ConversationMeta[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as ConversationMeta[]
}

export async function dbLoadConversation(id: string): Promise<ConversationMessage[] | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('messages')
    .eq('id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return (data?.messages as ConversationMessage[]) ?? null
}

export async function dbDeleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id)
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
  const { data, error } = await supabase
    .from('habits')
    .select('id, name, emoji, order_index, active')
    .eq('active', true)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []) as Habit[]
}

// ─── Habit Logs ───────────────────────────────────────────────────────────────

export type HabitLogStore = Record<string, boolean> // `${YYYY-MM-DD}|${habitId}` → true

export async function dbLoadHabitLogs(): Promise<HabitLogStore> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('date, habit_id, completed')
    .eq('user_id', uid())

  if (error) throw error

  const out: HabitLogStore = {}
  ;(data ?? []).forEach((r) => { if (r.completed) out[`${r.date}|${r.habit_id}`] = true })
  return out
}

export async function dbToggleHabitLog(date: string, habitId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase.from('habit_logs').upsert(
      { user_id: uid(), date, habit_id: habitId, completed: true },
      { onConflict: 'user_id,date,habit_id' },
    )
    if (error) throw error
  } else {
    const { error } = await supabase.from('habit_logs')
      .delete()
      .eq('user_id', uid())
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
  const userId = uid()
  const { data, error } = await supabase
    .from('modules_order')
    .select('order_data')
    .eq('user_id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return (data?.order_data as string[]) ?? []
}

export async function dbSaveModuleOrder(order: string[]): Promise<void> {
  const userId = uid()
  const { error } = await supabase
    .from('modules_order')
    .upsert({ user_id: userId, order_data: order }, { onConflict: 'user_id' })
  if (error) throw error
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export async function dbLoadModules(): Promise<ModuleItem[]> {
  const userId = uid()
  const [{ data, error }, order] = await Promise.all([
    supabase.from('modules').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
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

  // Empty — seed defaults then re-fetch
  await dbInitModules(userId)
  const { data: fresh, error: freshError } = await supabase
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
  const { error } = await supabase.from('modules').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

// Merges missing default data keys into each module in Supabase without overwriting existing values
export async function dbMigrateModules(): Promise<void> {
  const userId = uid()
  const now = new Date().toISOString()
  const { data, error } = await supabase
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

  await supabase.from('modules').upsert(rows, { onConflict: 'id' })
}

function dbNameOf(item: unknown): string {
  if (item !== null && typeof item === 'object') {
    const o = item as Record<string, unknown>
    return String(o.name ?? o.title ?? o.label ?? '').toLowerCase().trim()
  }
  return String(item).toLowerCase().trim()
}

async function dbGetModuleData(userId: string, id: string): Promise<Record<string, unknown>> {
  const { data: row } = await supabase
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
  await supabase.from('modules')
    .update({ data: { ...base, ...patch }, updated_at: now })
    .eq('user_id', userId)
    .eq('id', id)
}

export async function dbExecuteAction(action: ActionType): Promise<ModuleItem[]> {
  const userId = uid()
  const now = new Date().toISOString()

  switch (action.type) {
    case 'CREATE_MODULE': {
      const { id, name, icon, color, data } = action.payload
      await supabase.from('modules').upsert(
        { id, user_id: userId, name, icon, color, data: data ?? {}, updated_at: now },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      break
    }

    case 'DELETE_MODULE':
    case 'REMOVE_MODULE': {
      await supabase.from('modules').delete().eq('user_id', userId).eq('id', action.payload.id)
      break
    }

    case 'UPDATE_MODULE_META': {
      const meta: Record<string, string> = { updated_at: now }
      if (action.payload.name  !== undefined) meta.name  = action.payload.name
      if (action.payload.icon  !== undefined) meta.icon  = action.payload.icon
      if (action.payload.color !== undefined) meta.color = action.payload.color
      await supabase.from('modules').update(meta).eq('user_id', userId).eq('id', action.payload.id)
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
  const userId = uid()
  const { data: row } = await supabase
    .from('modules')
    .select('data')
    .eq('user_id', userId)
    .eq('id', moduleId)
    .single()

  const existing = ((row?.data as Record<string, unknown>)?.[field] as unknown[]) ?? []
  const patch = { [field]: [...existing, item] }

  await supabase.from('modules')
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
  const userId = uid()
  const { data: row } = await supabase
    .from('modules')
    .select('data')
    .eq('user_id', userId)
    .eq('id', moduleId)
    .single()

  const existing = [...(((row?.data as Record<string, unknown>)?.[field] as unknown[]) ?? [])]
  existing.splice(index, 1)
  const patch = { [field]: existing }

  await supabase.from('modules')
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
  const { data, error } = await supabase
    .from('journal_questions')
    .select('id, question')
    .order('id')
  if (error) throw error
  return (data ?? []) as JournalQuestion[]
}

export async function dbLoadJournalEntry(date: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, date, mood, day_score, question_1, answer_1, question_2, answer_2, free_write')
    .eq('user_id', uid())
    .eq('date', date)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null
  const d = data as Record<string, unknown>
  return { ...d, date: String(d.date).slice(0, 10) } as unknown as JournalEntry
}

export async function dbSaveJournalEntry(entry: Omit<JournalEntry, 'id'>): Promise<void> {
  const { error } = await supabase.from('journal_entries').upsert(
    { ...entry, user_id: uid(), updated_at: new Date().toISOString() },
    { onConflict: 'user_id,date' },
  )
  if (error) throw error
}

export async function dbLoadJournalDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('date')
    .eq('user_id', uid())
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => String((r as Record<string, unknown>).date).slice(0, 10))
}

export async function dbLoadRecentJournalEntries(limit = 5): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, date, mood, day_score, free_write')
    .eq('user_id', uid())
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => {
    const d = r as Record<string, unknown>
    return { ...d, date: String(d.date).slice(0, 10) }
  }) as unknown as JournalEntry[]
}
