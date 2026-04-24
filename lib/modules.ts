const MODULES_KEY = 'reborn:modules'

export interface ModuleItem {
  id: string
  name: string
  icon: string
  color: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type ActionType =
  | { type: 'ADD_MODULE'; payload: { id: string; name: string; icon: string; color: string; data?: Record<string, unknown> } }
  | { type: 'REMOVE_MODULE'; payload: { id: string } }
  | { type: 'UPDATE_MODULE_DATA'; payload: { id: string; patch: Record<string, unknown> } }

const DEFAULT_MODULES: ModuleItem[] = [
  {
    id: 'scholarship',
    name: 'Burs & Üniversite',
    icon: '🏫',
    color: '#c8a96e',
    data: { universities: [], scholarships: [], notes: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'english',
    name: 'İngilizce / IELTS',
    icon: '📚',
    color: '#6eb5c8',
    data: { level: 'B2', ielts_target: '7.0+', ielts_date: 'Eylül 2026', log: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'daily',
    name: 'Günlük',
    icon: '📓',
    color: '#c86e9a',
    data: { tasks: [], mood: '', notes: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'roadmap',
    name: 'Yol Haritası',
    icon: '🗺️',
    color: '#8ec86e',
    data: { milestones: [], current_focus: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'habits',
    name: 'Alışkanlık',
    icon: '🔥',
    color: '#c8956e',
    data: { habits: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'finance',
    name: 'Finans',
    icon: '💰',
    color: '#6ec8a9',
    data: { monthly_budget: 0, expenses: [], savings_goal: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'body',
    name: 'Beden',
    icon: '⚡',
    color: '#956ec8',
    data: { workouts: [], goals: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'discover',
    name: 'Keşif',
    icon: '🔭',
    color: '#c86e6e',
    data: { books: [], courses: [], notes: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function loadModules(): ModuleItem[] {
  const stored = safeGet<ModuleItem[] | null>(MODULES_KEY, null)
  if (!stored) {
    safeSet(MODULES_KEY, DEFAULT_MODULES)
    return DEFAULT_MODULES
  }
  return stored
}

export function saveModules(modules: ModuleItem[]) {
  safeSet(MODULES_KEY, modules)
}

export function executeAction(action: ActionType): ModuleItem[] {
  const modules = loadModules()
  const now = new Date().toISOString()

  switch (action.type) {
    case 'ADD_MODULE': {
      const exists = modules.some((m) => m.id === action.payload.id)
      if (exists) return modules
      const newModule: ModuleItem = {
        id: action.payload.id,
        name: action.payload.name,
        icon: action.payload.icon,
        color: action.payload.color,
        data: action.payload.data ?? {},
        createdAt: now,
        updatedAt: now,
      }
      const updated = [...modules, newModule]
      saveModules(updated)
      return updated
    }
    case 'REMOVE_MODULE': {
      const updated = modules.filter((m) => m.id !== action.payload.id)
      saveModules(updated)
      return updated
    }
    case 'UPDATE_MODULE_DATA': {
      const updated = modules.map((m) =>
        m.id === action.payload.id
          ? { ...m, data: { ...m.data, ...action.payload.patch }, updatedAt: now }
          : m
      )
      saveModules(updated)
      return updated
    }
    default:
      return modules
  }
}

export function getModuleById(id: string): ModuleItem | null {
  return loadModules().find((m) => m.id === id) ?? null
}

export function addItemToField(moduleId: string, field: string, item: unknown): ModuleItem[] {
  const modules = loadModules()
  const mod = modules.find((m) => m.id === moduleId)
  if (!mod) return modules
  const existing = (mod.data[field] as unknown[]) ?? []
  const patch = { [field]: [...existing, item] }
  return executeAction({ type: 'UPDATE_MODULE_DATA', payload: { id: moduleId, patch } })
}

export function removeItemFromField(moduleId: string, field: string, index: number): ModuleItem[] {
  const modules = loadModules()
  const mod = modules.find((m) => m.id === moduleId)
  if (!mod) return modules
  const existing = [...((mod.data[field] as unknown[]) ?? [])]
  existing.splice(index, 1)
  const patch = { [field]: existing }
  return executeAction({ type: 'UPDATE_MODULE_DATA', payload: { id: moduleId, patch } })
}

export function parseAction(text: string): { clean: string; action: ActionType | null } {
  const match = text.match(/<REBORN_ACTION>([\s\S]*?)<\/REBORN_ACTION>/)
  if (!match) return { clean: text, action: null }

  try {
    const action = JSON.parse(match[1]) as ActionType
    const clean = text.replace(/<REBORN_ACTION>[\s\S]*?<\/REBORN_ACTION>/, '').trim()
    return { clean, action }
  } catch {
    const clean = text.replace(/<REBORN_ACTION>[\s\S]*?<\/REBORN_ACTION>/, '').trim()
    return { clean, action: null }
  }
}
