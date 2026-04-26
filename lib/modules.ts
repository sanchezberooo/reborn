const MODULES_KEY = 'reborn:modules'
const MODULES_ORDER_KEY = 'reborn:modules-order'

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
  // Modül CRUD
  | { type: 'CREATE_MODULE';     payload: { id: string; name: string; icon: string; color: string; data?: Record<string, unknown> } }
  | { type: 'DELETE_MODULE';     payload: { id: string } }
  | { type: 'REMOVE_MODULE';     payload: { id: string } }          // alias for DELETE_MODULE
  | { type: 'UPDATE_MODULE_META'; payload: { id: string; name?: string; icon?: string; color?: string } }
  | { type: 'REORDER_MODULES';   payload: { order: string[] } }
  // Data işlemleri
  | { type: 'UPDATE_MODULE';     payload: { id: string; patch: Record<string, unknown> } }
  | { type: 'ADD_FIELD';         payload: { id: string; field: string; value: unknown } }
  | { type: 'UPDATE_FIELD';      payload: { id: string; field: string; value: unknown } }
  | { type: 'ADD_ITEM_TO_FIELD'; payload: { id: string; field: string; item: unknown } }  // dup check
  | { type: 'APPEND_TO_FIELD';   payload: { id: string; field: string; item: unknown } }  // no dup check
  | { type: 'REMOVE_ITEM';       payload: { id: string; field: string; name: string } }
  | { type: 'CLEAR_FIELD';       payload: { id: string; field: string } }

const TS = new Date().toISOString()

export const DEFAULT_MODULES: ModuleItem[] = [
  {
    id: 'scholarship',
    name: 'Burs & Üniversite',
    icon: '🏫',
    color: '#c8a96e',
    data: {
      universities: [],   // {name, country, deadline, acceptance_rate, scholarship, notes}
      essays: [],         // {title, draft, version, feedback, status}
      deadlines: [],      // {university, date, type}
      portfolio: [],      // {title, description, file}
      requirements: {},   // {ielts, gpa, sat, other}
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'english',
    name: 'İngilizce / IELTS',
    icon: '📚',
    color: '#6eb5c8',
    data: {
      ielts_target: '7.0+',
      ielts_date: 'Eylül 2026',
      current_level: 'B1',
      target_level: 'C1',
      study_streak: 0,
      word_topics: ['Education', 'Technology', 'Environment', 'Health', 'Society', 'Business'],
      words: [
        { word: 'perseverance', meaning_tr: 'Azim',          example: 'Her great achievement requires perseverance.',      status: 'new' },
        { word: 'ambition',     meaning_tr: 'Hırs / İddia',  example: 'His ambition drove him to succeed.',               status: 'new' },
        { word: 'resilience',   meaning_tr: 'Dayanıklılık',  example: 'Resilience is key to overcoming challenges.',      status: 'new' },
        { word: 'opportunity',  meaning_tr: 'Fırsat',        example: 'This is a great opportunity for growth.',          status: 'new' },
        { word: 'achievement',  meaning_tr: 'Başarı',        example: 'Hard work leads to achievement.',                  status: 'new' },
      ],
      sentence_patterns: [
        { pattern: 'However, ...',                 meaning_tr: 'Ancak, bununla birlikte...', examples: ['However, the results showed significant improvement.', 'The plan failed; however, we adapted quickly.'] },
        { pattern: 'In addition to this, ...',     meaning_tr: 'Bunun yanı sıra...',         examples: ['In addition to this, the study revealed new insights.', 'In addition to this, we need to consider the costs.'] },
        { pattern: 'Despite the fact that ...',    meaning_tr: '...olmasına rağmen...',      examples: ['Despite the fact that resources were limited, they succeeded.', 'Despite the fact that it was difficult, he persevered.'] },
        { pattern: 'It is worth noting that ...',  meaning_tr: 'Şunu belirtmek gerekir ki...', examples: ['It is worth noting that this trend has continued for years.', 'It is worth noting that exceptions do exist.'] },
        { pattern: 'As a result of ...',           meaning_tr: '...sonucunda...',             examples: ['As a result of the investment, profits increased.', 'As a result of hard work, she achieved her goal.'] },
      ],
      writing_archive: [],
      shadowing_log: [],
      grammar_topics: [],
      mock_tests: [],
      resources: [],
      daily_log: [],
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'daily',
    name: 'Günlük',
    icon: '📓',
    color: '#c86e9a',
    data: {
      entries: [], // {date, mood, summary, tasks, free_write}
      today: {},
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'roadmap',
    name: 'Yol Haritası',
    icon: '🗺️',
    color: '#8ec86e',
    data: {
      milestones: [],   // {title, date, status, notes}
      current_focus: '',
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'habits',
    name: 'Alışkanlık',
    icon: '🔥',
    color: '#c8956e',
    data: {
      habits: [], // {name, category, frequency, color}
      logs: [],   // {date, habit_id, completed}
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'finance',
    name: 'Finans',
    icon: '💰',
    color: '#6ec8a9',
    data: {
      income: [],        // {date, amount, source, notes}
      expenses: [],      // {date, amount, category, notes}
      subscriptions: [], // {name, amount, frequency, next_payment}
      receivables: [],   // {from, amount, date, status}
      payables: [],      // {to, amount, date, status}
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'body',
    name: 'Beden',
    icon: '⚡',
    color: '#956ec8',
    data: {
      workouts: [],     // {date, type, exercises, duration, notes}
      nutrition: [],    // {date, meals, calories, water}
      supplements: [],  // {name, dose, frequency}
      measurements: [], // {date, weight, height, other}
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'discover',
    name: 'Keşif',
    icon: '🔭',
    color: '#c86e6e',
    data: {
      books: [],   // {title, author, status, notes}
      courses: [], // {name, platform, status, url}
      notes: '',
    },
    createdAt: TS,
    updatedAt: TS,
  },
]

export function migrateModule(module: ModuleItem): ModuleItem {
  const def = DEFAULT_MODULES.find((d) => d.id === module.id)
  if (!def) return module
  const data: Record<string, unknown> = {}
  // Fill defaults first, then overlay existing — but seed empty arrays from defaults
  for (const [key, defVal] of Object.entries(def.data)) {
    const existing = module.data[key]
    if (existing === undefined || existing === null) {
      data[key] = defVal
    } else if (Array.isArray(existing) && existing.length === 0 && Array.isArray(defVal) && defVal.length > 0) {
      data[key] = defVal // seed empty arrays with defaults
    } else {
      data[key] = existing
    }
  }
  // Preserve extra keys not in defaults
  for (const [key, val] of Object.entries(module.data)) {
    if (!(key in def.data)) data[key] = val
  }
  return { ...module, data }
}

export function migrateModules(modules: ModuleItem[]): ModuleItem[] {
  return modules.map(migrateModule)
}

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

function applyOrder(modules: ModuleItem[]): ModuleItem[] {
  const order = safeGet<string[] | null>(MODULES_ORDER_KEY, null)
  if (!order || order.length === 0) return modules
  const map = new Map(modules.map((m) => [m.id, m]))
  const sorted = order.map((id) => map.get(id)).filter(Boolean) as ModuleItem[]
  const inOrder = new Set(order)
  const rest = modules.filter((m) => !inOrder.has(m.id))
  return [...sorted, ...rest]
}

export function loadModules(): ModuleItem[] {
  const stored = safeGet<ModuleItem[] | null>(MODULES_KEY, null)
  if (!stored) {
    safeSet(MODULES_KEY, DEFAULT_MODULES)
    return DEFAULT_MODULES
  }
  const migrated = migrateModules(stored)
  const ordered = applyOrder(migrated)
  safeSet(MODULES_KEY, ordered)
  return ordered
}

export function saveModules(modules: ModuleItem[]) {
  safeSet(MODULES_KEY, modules)
}

function nameOf(item: unknown): string {
  if (item !== null && typeof item === 'object') {
    const o = item as Record<string, unknown>
    return String(o.name ?? o.title ?? o.label ?? '').toLowerCase().trim()
  }
  return String(item).toLowerCase().trim()
}

export function executeAction(action: ActionType): ModuleItem[] {
  const modules = loadModules()
  const now = new Date().toISOString()

  switch (action.type) {
    case 'CREATE_MODULE': {
      if (modules.some((m) => m.id === action.payload.id)) return modules
      const newMod: ModuleItem = {
        id: action.payload.id,
        name: action.payload.name,
        icon: action.payload.icon,
        color: action.payload.color,
        data: action.payload.data ?? {},
        createdAt: now,
        updatedAt: now,
      }
      const updated = [...modules, newMod]
      saveModules(updated)
      return updated
    }

    case 'DELETE_MODULE':
    case 'REMOVE_MODULE': {
      const updated = modules.filter((m) => m.id !== action.payload.id)
      saveModules(updated)
      return updated
    }

    case 'UPDATE_MODULE_META': {
      const updated = modules.map((m) =>
        m.id === action.payload.id
          ? {
              ...m,
              ...(action.payload.name  !== undefined && { name:  action.payload.name }),
              ...(action.payload.icon  !== undefined && { icon:  action.payload.icon }),
              ...(action.payload.color !== undefined && { color: action.payload.color }),
              updatedAt: now,
            }
          : m
      )
      saveModules(updated)
      return updated
    }

    case 'REORDER_MODULES': {
      safeSet(MODULES_ORDER_KEY, action.payload.order)
      const map = new Map(modules.map((m) => [m.id, m]))
      const sorted = action.payload.order.map((id) => map.get(id)).filter(Boolean) as ModuleItem[]
      const inOrder = new Set(action.payload.order)
      const rest = modules.filter((m) => !inOrder.has(m.id))
      const updated = [...sorted, ...rest]
      saveModules(updated)
      return updated
    }

    case 'UPDATE_MODULE': {
      const updated = modules.map((m) =>
        m.id === action.payload.id
          ? { ...m, data: { ...m.data, ...action.payload.patch }, updatedAt: now }
          : m
      )
      saveModules(updated)
      return updated
    }

    case 'ADD_FIELD':
    case 'UPDATE_FIELD': {
      const updated = modules.map((m) =>
        m.id === action.payload.id
          ? { ...m, data: { ...m.data, [action.payload.field]: action.payload.value }, updatedAt: now }
          : m
      )
      saveModules(updated)
      return updated
    }

    case 'ADD_ITEM_TO_FIELD': {
      const mod = modules.find((m) => m.id === action.payload.id)
      if (!mod) return modules
      const existing = (mod.data[action.payload.field] as unknown[]) ?? []
      const newName = nameOf(action.payload.item)
      if (newName && existing.some((i) => nameOf(i) === newName)) return modules
      const updated = modules.map((m) =>
        m.id === action.payload.id
          ? { ...m, data: { ...m.data, [action.payload.field]: [...existing, action.payload.item] }, updatedAt: now }
          : m
      )
      saveModules(updated)
      return updated
    }

    case 'APPEND_TO_FIELD': {
      const mod = modules.find((m) => m.id === action.payload.id)
      if (!mod) return modules
      const existing = (mod.data[action.payload.field] as unknown[]) ?? []
      const updated = modules.map((m) =>
        m.id === action.payload.id
          ? { ...m, data: { ...m.data, [action.payload.field]: [...existing, action.payload.item] }, updatedAt: now }
          : m
      )
      saveModules(updated)
      return updated
    }

    case 'REMOVE_ITEM': {
      const mod = modules.find((m) => m.id === action.payload.id)
      if (!mod) return modules
      const existing = (mod.data[action.payload.field] as unknown[]) ?? []
      const target = action.payload.name.toLowerCase().trim()
      const filtered = existing.filter((i) => nameOf(i) !== target)
      if (filtered.length === existing.length) return modules
      const updated = modules.map((m) =>
        m.id === action.payload.id
          ? { ...m, data: { ...m.data, [action.payload.field]: filtered }, updatedAt: now }
          : m
      )
      saveModules(updated)
      return updated
    }

    case 'CLEAR_FIELD': {
      const updated = modules.map((m) =>
        m.id === action.payload.id
          ? { ...m, data: { ...m.data, [action.payload.field]: [] }, updatedAt: now }
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
  return executeAction({ type: 'UPDATE_MODULE', payload: { id: moduleId, patch: { [field]: [...existing, item] } } })
}

export function removeItemFromField(moduleId: string, field: string, index: number): ModuleItem[] {
  const modules = loadModules()
  const mod = modules.find((m) => m.id === moduleId)
  if (!mod) return modules
  const existing = [...((mod.data[field] as unknown[]) ?? [])]
  existing.splice(index, 1)
  return executeAction({ type: 'UPDATE_MODULE', payload: { id: moduleId, patch: { [field]: existing } } })
}

export function parseAction(text: string): { clean: string; action: ActionType | null } {
  const match = text.match(/<REBORN_ACTION>([\s\S]*?)<\/REBORN_ACTION>/)
  if (!match) return { clean: text, action: null }
  try {
    const action = JSON.parse(match[1]) as ActionType
    const clean = text.replace(/<REBORN_ACTION>[\s\S]*?<\/REBORN_ACTION>/, '').trim()
    return { clean, action }
  } catch {
    return { clean: text.replace(/<REBORN_ACTION>[\s\S]*?<\/REBORN_ACTION>/, '').trim(), action: null }
  }
}
