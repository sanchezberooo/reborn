'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { dbLoadModules, dbAddItemToField, dbRemoveItemFromField } from '@/lib/db'
import type { ModuleItem } from '@/lib/modules'

interface FieldConfig { key: string; label: string; placeholder: string }

function getFieldConfig(moduleId: string): FieldConfig {
  const map: Record<string, FieldConfig> = {
    scholarship: { key: 'universities',  label: 'Üniversiteler',    placeholder: 'MIT, Stanford, ETH Zürich...' },
    english:     { key: 'words',         label: 'Kelime Bankası',   placeholder: 'Yeni kelime ekle...' },
    daily:       { key: 'entries',       label: 'Günlük Kayıtlar',  placeholder: 'Bugünü yaz...' },
    roadmap:     { key: 'milestones',    label: 'Kilometre Taşları', placeholder: 'IELTS kaydı yaptır...' },
    habits:      { key: 'habits',        label: 'Alışkanlıklar',    placeholder: 'Sabah koşusu, kitap okuma...' },
    finance:     { key: 'expenses',      label: 'Harcamalar',       placeholder: 'Kurs ücreti — ₺500' },
    body:        { key: 'workouts',      label: 'Antrenmanlar',     placeholder: '5km koşu, 30dk yüzme...' },
    discover:    { key: 'items',         label: 'Keşifler',         placeholder: 'Kitap, kurs, kaynak...' },
  }
  return map[moduleId] ?? { key: 'items', label: 'Notlar', placeholder: 'Not ekle...' }
}

function getStringFields(module: ModuleItem): { label: string; value: string }[] {
  const skip = new Set(['items', 'notes', 'today', getFieldConfig(module.id).key])
  return Object.entries(module.data)
    .filter(([k, v]) => !skip.has(k) && typeof v === 'string' && v !== '')
    .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v as string }))
}

export default function ModuleDetail({ moduleId }: { moduleId: string }) {
  const router = useRouter()
  const [module, setModule] = useState<ModuleItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function reload() {
    try {
      const mods = await dbLoadModules()
      setModule(mods.find((m) => m.id === moduleId) ?? null)
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    window.addEventListener('reborn:modules-updated', reload)
    return () => window.removeEventListener('reborn:modules-updated', reload)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-gold animate-pulse" />
      </div>
    )
  }

  if (!module) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm gap-1">
        Modül bulunamadı.
        <button onClick={() => router.back()} className="text-gold hover:underline ml-1">Geri dön</button>
      </div>
    )
  }

  const field = getFieldConfig(module.id)
  const listItems = (module.data[field.key] as unknown[] | undefined) ?? []
  const stringFields = getStringFields(module)
  const notes = module.data.notes as string | undefined

  async function handleAdd() {
    const val = inputValue.trim()
    if (!val || saving) return
    setSaving(true)
    try {
      const updated = await dbAddItemToField(module!.id, field.key, val)
      setModule(updated.find((m) => m.id === moduleId) ?? null)
      setInputValue('')
      inputRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(index: number) {
    if (saving) return
    setSaving(true)
    try {
      const updated = await dbRemoveItemFromField(module!.id, field.key, index)
      setModule(updated.find((m) => m.id === moduleId) ?? null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Module content ─────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: module.color + '20' }}>
              {module.icon}
            </span>
            <h1 className="font-display text-lg font-semibold text-foreground">{module.name}</h1>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-w-xl mx-auto flex flex-col gap-6">

          {stringFields.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-4 flex flex-wrap gap-4">
              {stringFields.map((f) => (
                <div key={f.label}>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-0.5">{f.label}</p>
                  <p className="text-sm text-foreground font-medium">{f.value}</p>
                </div>
              ))}
            </div>
          )}

          {notes && (
            <div className="bg-surface border border-border rounded-2xl p-4">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Notlar</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider mb-3">{field.label}</p>
            {listItems.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm border border-dashed border-border rounded-2xl">
                Henüz bir şey yok. Aşağıdan ekle ya da Sanchez&apos;e söyle.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {listItems.map((item, i) => {
                  const isObj = item !== null && typeof item === 'object'
                  const obj = isObj ? (item as Record<string, unknown>) : null
                  const label = obj
                    ? String(obj.name ?? obj.title ?? obj.label ?? JSON.stringify(item))
                    : String(item)
                  const sub = obj
                    ? [obj.country, obj.notes, obj.date, obj.description]
                        .filter(Boolean).map(String).join(' · ')
                    : ''
                  return (
                    <li key={i} className="flex items-start gap-3 bg-surface border border-border rounded-xl px-4 py-3 group">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: module.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{label}</p>
                        {sub && <p className="text-xs text-muted mt-0.5 leading-snug">{sub}</p>}
                      </div>
                      <button
                        onClick={() => handleRemove(i)}
                        disabled={saving}
                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-all disabled:opacity-20 shrink-0 mt-0.5"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Add input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={field.placeholder}
              disabled={saving}
              className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-gold transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleAdd}
              disabled={!inputValue.trim() || saving}
              className="px-4 py-3 bg-gold text-background text-sm font-medium rounded-xl disabled:opacity-30 hover:opacity-80 transition-opacity"
            >
              {saving ? '...' : 'Ekle'}
            </button>
          </div>

          <p className="text-[10px] text-muted text-center pb-4">
            Son güncelleme:{' '}
            {new Date(module.updatedAt).toLocaleDateString('tr-TR', {
              day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      </div>

    </div>
  )
}
