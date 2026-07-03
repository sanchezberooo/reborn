import { describe, expect, it } from 'vitest'
import { DEFAULT_MODULES, migrateModule } from './modules'
import type { ModuleItem } from './modules'

describe('migrateModule', () => {
  it('bilinmeyen modül id\'sini değiştirmeden döner', () => {
    const custom: ModuleItem = {
      id: 'unknown-module',
      name: 'Özel',
      icon: '❓',
      color: '#000',
      data: { foo: 'bar' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(migrateModule(custom)).toEqual(custom)
  })

  it('eksik alanları DEFAULT_MODULES şablonundan doldurur, mevcut değerleri korur', () => {
    const englishDefault = DEFAULT_MODULES.find((m) => m.id === 'english')!
    const partial: ModuleItem = {
      ...englishDefault,
      data: {
        ielts_target: '8.0', // kullanıcı değeri korunmalı
        // 'words' alanı eksik → default'tan gelmeli
      },
    }
    const migrated = migrateModule(partial)
    expect(migrated.data.ielts_target).toBe('8.0')
    expect(migrated.data.words).toEqual(englishDefault.data.words)
  })

  it('boş dizi olan alanı, default doluysa default ile doldurur', () => {
    const englishDefault = DEFAULT_MODULES.find((m) => m.id === 'english')!
    const partial: ModuleItem = {
      ...englishDefault,
      data: { ...englishDefault.data, words: [] },
    }
    const migrated = migrateModule(partial)
    expect(migrated.data.words).toEqual(englishDefault.data.words)
  })

  it('şablonda olmayan ekstra kullanıcı alanlarını korur', () => {
    const englishDefault = DEFAULT_MODULES.find((m) => m.id === 'english')!
    const partial: ModuleItem = {
      ...englishDefault,
      data: { ...englishDefault.data, custom_field: 'kullanıcı verisi' },
    }
    const migrated = migrateModule(partial)
    expect(migrated.data.custom_field).toBe('kullanıcı verisi')
  })
})
