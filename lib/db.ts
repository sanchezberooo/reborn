import { supabase } from './supabase'
import type { BeroProfile } from './memory'
import type { ModuleItem, ActionType } from './modules'
import { DEFAULT_MODULES, loadModules, saveModules } from './modules'

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

  if (!data) return (await import('./memory')).DEFAULT_PROFILE
  return {
    name: data.name ?? 'Bero',
    age: data.age ?? 18,
    location: data.location ?? 'İstanbul',
    goal: data.goal ?? 'Tam burslu CS okumak - ABD/Kanada/Avrupa',
    ielts_target: data.ielts_target ?? '7.0+',
    ielts_date: data.ielts_date ?? 'Eylül 2026',
    project: data.project ?? 'Reborn - AI Life OS',
    application_deadline: data.application_deadline ?? 'Kasım 2026',
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
      await dbInitModules(userId).catch(() => {})
    }
  } catch {}

  return loadModules()
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
  await supabase.from('modules').insert(rows)
}

export async function dbExecuteAction(action: ActionType): Promise<ModuleItem[]> {
  const userId = uid()
  const now = new Date().toISOString()

  switch (action.type) {
    case 'ADD_MODULE': {
      const { id, name, icon, color, data } = action.payload
      await supabase.from('modules').upsert({
        id, user_id: userId, name, icon, color, data: data ?? {}, updated_at: now,
      })
      break
    }
    case 'REMOVE_MODULE': {
      await supabase.from('modules')
        .delete()
        .eq('user_id', userId)
        .eq('id', action.payload.id)
      break
    }
    case 'UPDATE_MODULE_DATA': {
      const { data: row } = await supabase
        .from('modules')
        .select('data')
        .eq('user_id', userId)
        .eq('id', action.payload.id)
        .single()

      const merged = { ...(row?.data ?? {}), ...action.payload.patch }
      await supabase.from('modules')
        .update({ data: merged, updated_at: now })
        .eq('user_id', userId)
        .eq('id', action.payload.id)
      break
    }
    case 'ADD_ITEM_TO_FIELD': {
      return dbAddItemToField(action.payload.id, action.payload.field, action.payload.item)
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

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function dbSaveMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const userId = uid()
  await supabase.from('messages').insert({ user_id: userId, session_id: sessionId, role, content })
}
