const PROFILE_KEY = 'reborn:profile'
const MEMORIES_KEY = 'reborn:memories'

export interface BeroProfile {
  name: string
  age: number
  location: string
  goal: string
  ielts_target: string
  ielts_date: string
  project: string
  application_deadline: string
}

export interface Memory {
  id: string
  date: string
  summary: string
}

export const DEFAULT_PROFILE: BeroProfile = {
  name: 'Bero',
  age: 18,
  location: 'İstanbul',
  goal: 'Tam burslu CS okumak - ABD/Kanada/Avrupa',
  ielts_target: '7.0+',
  ielts_date: 'Eylül 2026',
  project: 'Reborn - AI Life OS',
  application_deadline: 'Kasım 2026',
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

export function loadProfile(): BeroProfile {
  return safeGet(PROFILE_KEY, DEFAULT_PROFILE)
}

export function saveProfile(profile: BeroProfile) {
  safeSet(PROFILE_KEY, profile)
}

export function loadMemories(): Memory[] {
  return safeGet<Memory[]>(MEMORIES_KEY, [])
}

export function saveMemory(summary: string) {
  const memories = loadMemories()
  const newMemory: Memory = {
    id: Math.random().toString(36).slice(2, 9),
    date: new Date().toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    summary,
  }
  // En fazla 20 özet sakla, en yeniler başta
  safeSet(MEMORIES_KEY, [newMemory, ...memories].slice(0, 20))
}

export function clearMemories() {
  safeSet(MEMORIES_KEY, [])
}
