'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  loadModules,
  addItemToField,
  removeItemFromField,
} from '@/lib/modules'
import type { ModuleItem } from '@/lib/modules'

interface FieldConfig {
  key: string
  label: string
  placeholder: string
}

function getFieldConfig(moduleId: string): FieldConfig {
  const map: Record<string, FieldConfig> = {
    scholarship: { key: 'universities', label: 'Üniversiteler', placeholder: 'MIT, Stanford, ETH Zürich...' },
    english:     { key: 'log',          label: 'Pratik Kayıtları', placeholder: 'Bugün ne çalıştın?' },
    daily:       { key: 'tasks',        label: 'Görevler', placeholder: 'Yeni görev ekle...' },
    roadmap:     { key: 'milestones',   label: 'Kilometre Taşları', placeholder: 'IELTS kaydı yaptır...' },
    habits:      { key: 'habits',       label: 'Alışkanlıklar', placeholder: 'Sabah koşusu, kitap okuma...' },
    finance:     { key: 'expenses',     label: 'Harcamalar', placeholder: 'Kurs ücreti — ₺500' },
    body:        { key: 'workouts',     label: 'Antrenmanlar', placeholder: '5km koşu, 30dk yüzme...' },
    discover:    { key: 'items',        label: 'Keşifler', placeholder: 'Kitap, kurs, kaynak...' },
  }
  return map[moduleId] ?? { key: 'items', label: 'Notlar', placeholder: 'Not ekle...' }
}

function getStringFields(module: ModuleItem): { label: string; value: string }[] {
  const skip = new Set(['items', 'notes', getFieldConfig(module.id).key])
  return Object.entries(module.data)
    .filter(([k, v]) => !skip.has(k) && typeof v === 'string' && v !== '')
    .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v as string }))
}

export default function ModuleDetail({ moduleId }: { moduleId: string }) {
  const router = useRouter()
  const [module, setModule] = useState<ModuleItem | null>(null)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function reload() {
    const mods = loadModules()
    setModule(mods.find((m) => m.id === moduleId) ?? null)
  }

  useEffect(() => {
    reload()
    window.addEventListener('reborn:modules-updated', reload)
    return () => window.removeEventListener('reborn:modules-updated', reload)
  }, [moduleId])

  if (!module) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Modül bulunamadı.{' '}
        <Link href="/dashboard" className="text-gold ml-1 hover:underline">
          Geri dön
        </Link>
      </div>
    )
  }

  const field = getFieldConfig(module.id)
  const listItems = (module.data[field.key] as string[] | undefined) ?? []
  const stringFields = getStringFields(module)
  const notes = module.data.notes as string | undefined

  function handleAdd() {
    const val = inputValue.trim()
    if (!val || !module) return
    const updated = addItemToField(module.id, field.key, val)
    setModule(updated.find((m) => m.id === moduleId) ?? null)
    setInputValue('')
    inputRef.current?.focus()
  }

  function handleRemove(index: number) {
    if (!module) return
    const updated = removeItemFromField(module.id, field.key, index)
    setModule(updated.find((m) => m.id === moduleId) ?? null)
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
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
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: module.color + '20' }}
          >
            {module.icon}
          </span>
          <h1 className="font-display text-lg font-semibold text-foreground">
            {module.name}
          </h1>
        </div>
        <Link
          href={`/?module=${module.id}`}
          className="ml-auto flex items-center gap-1.5 text-xs border border-gold/40 text-gold rounded-lg px-3 py-1.5 hover:bg-gold/10 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Sanchez ile konuş
        </Link>
      </div>

      {/* Content */}
      <div className="px-6 py-6 max-w-xl mx-auto flex flex-col gap-6">

        {/* String fields (level, ielts_target, vb.) */}
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

        {/* Notes */}
        {notes && (
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Notlar</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {/* List items */}
        <div>
          <p className="text-[10px] text-muted uppercase tracking-wider mb-3">{field.label}</p>

          {listItems.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm border border-dashed border-border rounded-2xl">
              Henüz bir şey yok. Aşağıdan ekle ya da Sanchez&apos;e söyle.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {listItems.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 group"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: module.color }}
                  />
                  <span className="flex-1 text-sm text-foreground">{item}</span>
                  <button
                    onClick={() => handleRemove(i)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
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
            className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-gold transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            className="px-4 py-3 bg-gold text-background text-sm font-medium rounded-xl disabled:opacity-30 hover:opacity-80 transition-opacity"
          >
            Ekle
          </button>
        </div>

        {/* Last updated */}
        <p className="text-[10px] text-muted text-center pb-2">
          Son güncelleme:{' '}
          {new Date(module.updatedAt).toLocaleDateString('tr-TR', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}
