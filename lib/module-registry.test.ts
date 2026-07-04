import { describe, expect, it, vi } from 'vitest'
import {
  MODULE_REGISTRY,
  activeModules,
  applyModuleToggle,
  isModuleEnabled,
  moduleForPath,
} from './module-registry'

// Modül çerçevesi v1 (Faz 2, Görev 4) testleri. İki katman:
// 1) Saf registry/görünürlük mantığı (env'siz koşar).
// 2) dbSetModuleEnabled/dbLoadModuleSettings sözleşmesi — casus (spy)
//    Supabase istemcisiyle: modül kapatmak YALNIZ profiles.module_settings
//    yazar; entities/goals/journal_* tablolarına hiçbir op (özellikle
//    delete) gitmez. Roadmap Faz 2 kriteri: "Bir modül kapatıldığında
//    UI'dan kayboluyor, verisi korunuyor."

// ─── casus Supabase istemcisi ────────────────────────────────────────────────

const mock = vi.hoisted(() => {
  interface Op {
    table: string
    kind: 'select' | 'update' | 'insert' | 'upsert' | 'delete'
    payload?: unknown
    column?: string
  }
  const ops: Op[] = []
  const state = {
    moduleSettings: {} as Record<string, boolean>,
    settingsColumnMissing: false,
    // Sahte hafıza çekirdeği: journal + goal entity satırları. Toggle
    // akışının bunlara dokunMADIĞI referans eşitliğiyle doğrulanır.
    entities: [
      { id: 'e-journal', type: 'journal', title: 'Günlük 2026-07-01' },
      { id: 'e-goal', type: 'goal', title: 'IELTS 7.0+' },
    ],
  }

  function result(op: Op | null, table: string) {
    if (op?.kind === 'select' && table === 'profiles') {
      if (op.column === 'id') return { data: { id: 'test-user' }, error: null }
      if (op.column === 'module_settings') {
        if (state.settingsColumnMissing) {
          return {
            data: null,
            error: { code: '42703', message: 'column profiles.module_settings does not exist' },
          }
        }
        return { data: { module_settings: state.moduleSettings }, error: null }
      }
    }
    if (op?.kind === 'update' && table === 'profiles') {
      const payload = op.payload as { module_settings?: Record<string, boolean> }
      if (payload.module_settings) state.moduleSettings = payload.module_settings
      return { data: null, error: null }
    }
    return { data: null, error: null }
  }

  function builder(table: string) {
    let current: Op | null = null
    const push = (op: Op) => {
      current = op
      ops.push(op)
    }
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: (column: string) => (push({ table, kind: 'select', column }), b),
      update: (payload: unknown) => (push({ table, kind: 'update', payload }), b),
      insert: (payload: unknown) => (push({ table, kind: 'insert', payload }), b),
      upsert: (payload: unknown) => (push({ table, kind: 'upsert', payload }), b),
      delete: () => (push({ table, kind: 'delete' }), b),
      eq: () => b,
      limit: () => b,
      order: () => b,
      single: () => b,
      maybeSingle: () => b,
      then: (
        resolve: (v: unknown) => unknown,
        reject: (e: unknown) => unknown,
      ) => Promise.resolve(result(current, table)).then(resolve, reject),
    })
    return b
  }

  return { ops, state, client: { from: (table: string) => builder(table) } }
})

vi.mock('./supabase', () => ({
  getSupabaseBrowser: () => mock.client,
  supabase: mock.client,
}))

import { dbLoadModuleSettings, dbSetModuleEnabled } from './db'

// ─── saf registry/görünürlük mantığı ─────────────────────────────────────────

describe('MODULE_REGISTRY', () => {
  it("çerçevenin üyeleri journal, goals ve essay'dir, route'ları /dashboard altında tanımlı", () => {
    const ids = MODULE_REGISTRY.map((m) => m.id)
    expect(ids).toContain('journal')
    expect(ids).toContain('goals')
    expect(ids).toContain('essay')
    for (const m of MODULE_REGISTRY) {
      expect(m.route.startsWith('/dashboard/')).toBe(true)
      expect(m.name.length).toBeGreaterThan(0)
    }
  })
})

describe('görünürlük mantığı (saf)', () => {
  it('kayıt yoksa modül varsayılan AÇIK — boş {} = her şey açık', () => {
    expect(isModuleEnabled({}, 'journal')).toBe(true)
    expect(isModuleEnabled({}, 'goals')).toBe(true)
    expect(isModuleEnabled({}, 'gelecekte-eklenecek-modul')).toBe(true)
  })

  it('false override modülü kapatır, activeModules onu listeden düşürür', () => {
    const settings = { journal: false }
    expect(isModuleEnabled(settings, 'journal')).toBe(false)
    const active = activeModules(settings).map((m) => m.id)
    expect(active).not.toContain('journal')
    expect(active).toContain('goals')
  })

  it('applyModuleToggle: kapatmak false yazar, açmak anahtarı siler (normalize)', () => {
    const off = applyModuleToggle({}, 'goals', false)
    expect(off).toEqual({ goals: false })
    const on = applyModuleToggle(off, 'goals', true)
    expect(on).toEqual({})
    // saf: girdi mutasyona uğramaz
    expect(off).toEqual({ goals: false })
  })

  it('moduleForPath: route ve alt yolları eşleşir, komşu yollar eşleşmez', () => {
    expect(moduleForPath('/dashboard/gunluk')?.id).toBe('journal')
    expect(moduleForPath('/dashboard/gunluk/2026-07-03')?.id).toBe('journal')
    expect(moduleForPath('/dashboard/hedefler')?.id).toBe('goals')
    expect(moduleForPath('/dashboard/essay')?.id).toBe('essay')
    expect(moduleForPath('/dashboard/gunlukx')).toBeUndefined()
    // Dashboard'un kendisi hiçbir modülün alanı değil — kapalı modül
    // Dashboard'a erişimi engellemez, yalnız kendi alt-route'unu gizler.
    expect(moduleForPath('/dashboard')).toBeUndefined()
  })
})

// ─── veri korunumu sözleşmesi (casus istemci) ────────────────────────────────

describe('modül kapatma verisi korur (dbSetModuleEnabled sözleşmesi)', () => {
  it('kapatma YALNIZ profiles.module_settings yazar; hiçbir tabloda delete/veri işlemi yok', async () => {
    const entitiesBefore = mock.state.entities
    mock.ops.length = 0

    const next = await dbSetModuleEnabled('journal', false)
    expect(next).toEqual({ journal: false })
    expect(mock.state.moduleSettings).toEqual({ journal: false })

    // Tek yazma işlemi: profiles.update — payload'ı yalnız tercih + damga
    const writes = mock.ops.filter((o) => o.kind !== 'select')
    expect(writes).toHaveLength(1)
    expect(writes[0].table).toBe('profiles')
    expect(writes[0].kind).toBe('update')
    expect(Object.keys(writes[0].payload as object).sort()).toEqual([
      'module_settings',
      'updated_at',
    ])

    // Hafıza çekirdeğine ve modül verisine HİÇ dokunulmadı
    expect(mock.ops.some((o) => o.kind === 'delete')).toBe(false)
    const dataTables = ['entities', 'goals', 'links', 'journal_entries', 'memories']
    expect(mock.ops.some((o) => dataTables.includes(o.table))).toBe(false)

    // entities'teki journal/goal kayıtları aynen duruyor (silinme = gizlenme DEĞİL)
    expect(mock.state.entities).toBe(entitiesBefore)
    expect(mock.state.entities.map((e) => e.type).sort()).toEqual(['goal', 'journal'])
  })

  it('kapalı modül yalnız görünürlükten düşer: activeModules gizler, veri erişilebilir kalır', async () => {
    const settings = await dbLoadModuleSettings()
    expect(isModuleEnabled(settings, 'journal')).toBe(false)
    expect(activeModules(settings).map((m) => m.id)).toEqual(['goals', 'essay'])
    // Gizleme saf bir UI filtresi — entity satırları hâlâ yerinde
    expect(mock.state.entities.find((e) => e.type === 'journal')).toBeDefined()
  })

  it('yeniden açma tercihi normalize eder ({}) ve yine hiçbir delete üretmez', async () => {
    mock.ops.length = 0
    const next = await dbSetModuleEnabled('journal', true)
    expect(next).toEqual({})
    expect(mock.ops.some((o) => o.kind === 'delete')).toBe(false)
    expect(mock.state.entities).toHaveLength(2)
  })

  it('migration 0003 uygulanmadan (kolon yok) güvenli varsayılan: tümü açık', async () => {
    mock.state.settingsColumnMissing = true
    const settings = await dbLoadModuleSettings()
    expect(settings).toEqual({})
    expect(activeModules(settings).map((m) => m.id)).toEqual(['journal', 'goals', 'essay'])
    mock.state.settingsColumnMissing = false
  })
})
