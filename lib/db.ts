import { supabase } from './supabase'
import type { BeroProfile } from './memory'
import type { ModuleItem, ActionType } from './modules'
import { DEFAULT_MODULES, loadModules, saveModules, migrateModule } from './modules'

const BERO_ID = process.env.NEXT_PUBLIC_BERO_ID ?? '00000000-0000-0000-0000-000000000001'

function uid(): string {
  return BERO_ID
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function dbLoadProfile(): Promise<BeroProfile> {
  const userId = uid()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

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
  await supabase.from('profiles').upsert({ id: userId, ...profile, updated_at: new Date().toISOString() })
}

// ─── Memories ─────────────────────────────────────────────────────────────────

export async function dbLoadMemories(): Promise<import('./memory').Memory[]> {
  const userId = uid()
  const { data } = await supabase
    .from('memories')
    .select('id, summary, date')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []) as import('./memory').Memory[]
}

export async function dbSaveMemory(summary: string): Promise<void> {
  const userId = uid()
  const date = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  await supabase.from('memories').insert({ user_id: userId, summary, date })
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
  await supabase.from('conversations').upsert({ id: sessionId, title, messages })
}

export async function dbLoadConversations(): Promise<ConversationMeta[]> {
  const { data } = await supabase
    .from('conversations')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as ConversationMeta[]
}

export async function dbLoadConversation(id: string): Promise<ConversationMessage[] | null> {
  const { data } = await supabase
    .from('conversations')
    .select('messages')
    .eq('id', id)
    .single()
  return (data?.messages as ConversationMessage[]) ?? null
}

export async function dbDeleteConversation(id: string): Promise<void> {
  await supabase.from('conversations').delete().eq('id', id)
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export async function dbLoadModules(): Promise<ModuleItem[]> {
  const userId = uid()
  try {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!error && data && data.length > 0) {
      const mods = data.map((row) => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        data: row.data ?? {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
      saveModules(mods)
      return mods
    }

    if (!error && data && data.length === 0) {
      await dbInitModules(userId)
      // Re-fetch so caller gets the freshly seeded rows
      const { data: fresh } = await supabase
        .from('modules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
      if (fresh && fresh.length > 0) {
        const mods = fresh.map((row) => ({
          id: row.id,
          name: row.name,
          icon: row.icon,
          color: row.color,
          data: row.data ?? {},
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
        saveModules(mods)
        return mods
      }
    }
  } catch {}

  // Fallback: return localStorage and sync to Supabase in background
  const localMods = loadModules()
  dbSyncLocalModules(userId, localMods).catch(() => {})
  return localMods
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
  await supabase.from('modules').upsert(rows, { onConflict: 'id' })
}

async function dbSyncLocalModules(userId: string, mods: ModuleItem[]): Promise<void> {
  const rows = mods.map((m) => ({
    id: m.id,
    user_id: userId,
    name: m.name,
    icon: m.icon,
    color: m.color,
    data: m.data,
    updated_at: m.updatedAt,
  }))
  await supabase.from('modules').upsert(rows, { onConflict: 'id' })
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

    case 'REORDER_MODULES':
      // Order persisted in localStorage only — no Supabase column for position
      break

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

