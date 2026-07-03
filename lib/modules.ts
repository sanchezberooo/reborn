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
  | { type: 'CREATE_MODULE';      payload: { id: string; name: string; icon: string; color: string; data?: Record<string, unknown> } }
  | { type: 'DELETE_MODULE';      payload: { id: string } }
  | { type: 'REMOVE_MODULE';      payload: { id: string } }
  | { type: 'UPDATE_MODULE_META'; payload: { id: string; name?: string; icon?: string; color?: string } }
  | { type: 'REORDER_MODULES';    payload: { order: string[] } }
  // Data işlemleri
  | { type: 'UPDATE_MODULE';      payload: { id: string; patch: Record<string, unknown> } }
  | { type: 'ADD_FIELD';          payload: { id: string; field: string; value: unknown } }
  | { type: 'UPDATE_FIELD';       payload: { id: string; field: string; value: unknown } }
  | { type: 'ADD_ITEM_TO_FIELD';  payload: { id: string; field: string; item: unknown } }
  | { type: 'APPEND_TO_FIELD';    payload: { id: string; field: string; item: unknown } }
  | { type: 'REMOVE_ITEM';        payload: { id: string; field: string; name: string } }
  | { type: 'CLEAR_FIELD';        payload: { id: string; field: string } }

const TS = new Date().toISOString()

export const DEFAULT_MODULES: ModuleItem[] = [
  {
    id: 'scholarship',
    name: 'Burs & Üniversite',
    icon: '🏫',
    color: '#c8a96e', // gold
    data: {
      universities: [],
      essays: [],
      deadlines: [],
      portfolio: [],
      requirements: {},
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'english',
    name: 'İngilizce / IELTS',
    icon: '📚',
    color: '#8b5cf6',
    data: {
      ielts_target: '7.0+',
      ielts_date: 'Eylül 2026',
      current_level: 'B1',
      target_level: 'C1',
      study_streak: 0,
      word_topics: ['Education', 'Technology', 'Environment', 'Health', 'Society', 'Business'],
      words: [
        { word: 'perseverance', meaning_tr: 'Azim',         example: 'Her great achievement requires perseverance.',      status: 'new' },
        { word: 'ambition',     meaning_tr: 'Hırs / İddia', example: 'His ambition drove him to succeed.',               status: 'new' },
        { word: 'resilience',   meaning_tr: 'Dayanıklılık', example: 'Resilience is key to overcoming challenges.',      status: 'new' },
        { word: 'opportunity',  meaning_tr: 'Fırsat',       example: 'This is a great opportunity for growth.',          status: 'new' },
        { word: 'achievement',  meaning_tr: 'Başarı',       example: 'Hard work leads to achievement.',                  status: 'new' },
      ],
      sentence_patterns: [
        { pattern: 'However, ...',                meaning_tr: 'Ancak, bununla birlikte...', examples: ['However, the results showed significant improvement.', 'The plan failed; however, we adapted quickly.'] },
        { pattern: 'In addition to this, ...',    meaning_tr: 'Bunun yanı sıra...',         examples: ['In addition to this, the study revealed new insights.', 'In addition to this, we need to consider the costs.'] },
        { pattern: 'Despite the fact that ...',   meaning_tr: '...olmasına rağmen...',      examples: ['Despite the fact that resources were limited, they succeeded.', 'Despite the fact that it was difficult, he persevered.'] },
        { pattern: 'It is worth noting that ...', meaning_tr: 'Şunu belirtmek gerekir ki...', examples: ['It is worth noting that this trend has continued for years.', 'It is worth noting that exceptions do exist.'] },
        { pattern: 'As a result of ...',          meaning_tr: '...sonucunda...',             examples: ['As a result of the investment, profits increased.', 'As a result of hard work, she achieved her goal.'] },
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
    color: '#f59e0b',
    data: {
      entries: [],
      today: {},
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'roadmap',
    name: 'Yol Haritası',
    icon: '🗺️',
    color: '#06b6d4',
    data: {
      milestones: [],
      current_focus: '',
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'habits',
    name: 'Alışkanlık',
    icon: '🔥',
    color: '#ef4444',
    data: {
      habits: [],
      logs: [],
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'finance',
    name: 'Finans',
    icon: '💰',
    color: '#22c55e',
    data: {
      income: [],
      expenses: [],
      subscriptions: [],
      receivables: [],
      payables: [],
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'body',
    name: 'Beden',
    icon: '⚡',
    color: '#3b82f6',
    data: {
      workouts: [],
      nutrition: [],
      supplements: [],
      measurements: [],
    },
    createdAt: TS,
    updatedAt: TS,
  },
  {
    id: 'discover',
    name: 'Keşif',
    icon: '🔭',
    color: '#f97316',
    data: {
      books: [],
      courses: [],
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
  for (const [key, defVal] of Object.entries(def.data)) {
    const existing = module.data[key]
    if (existing === undefined || existing === null) {
      data[key] = defVal
    } else if (Array.isArray(existing) && existing.length === 0 && Array.isArray(defVal) && defVal.length > 0) {
      data[key] = defVal
    } else {
      data[key] = existing
    }
  }
  for (const [key, val] of Object.entries(module.data)) {
    if (!(key in def.data)) data[key] = val
  }
  return { ...module, data }
}

export function migrateModules(modules: ModuleItem[]): ModuleItem[] {
  return modules.map(migrateModule)
}
