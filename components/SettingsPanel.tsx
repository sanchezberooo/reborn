'use client'

// Ayarlar paneli — sol alttaki profil avatarından açılır (roadmap §6.1:
// ayarlar için 5. sekme açılmaz). Modül görünürlük anahtarları (eskiden
// Dashboard'un altındaydı) ve Obsidian kasa senkronu burada yaşar.
// Veri katmanı aynı: useModuleSettings + POST /api/obsidian/sync.

import { useState } from 'react'
import { X, Settings, RefreshCw } from 'lucide-react'
import { MODULE_REGISTRY, isModuleEnabled } from '@/lib/module-registry'
import { useModuleSettings } from './useModuleSettings'
import { cn } from '@/lib/utils'

interface SyncResult {
  created: number
  updated: number
  deleted: number
  linked: number
}

function ObsidianSyncSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function sync() {
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch('/api/obsidian/sync', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      setResult(body as SyncResult)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kasa senkronu başarısız.')
      setStatus('error')
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Brain kaynakları
      </h3>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/40 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Obsidian kasasını senkronla</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {status === 'loading' && 'Senkronize ediliyor…'}
            {status === 'done' && result &&
              `${result.created} yeni · ${result.updated} güncellendi · ${result.deleted} silindi · ${result.linked} bağlantı`}
            {status === 'error' && error}
            {status === 'idle' &&
              "Notlar entity olarak içe aktarılır, [[wikilink]]'ler bağlantı grafına işlenir."}
          </p>
        </div>
        <button
          onClick={sync}
          disabled={status === 'loading'}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn('size-3.5', status === 'loading' && 'animate-spin')} />
          Senkronla
        </button>
      </div>
    </section>
  )
}

function ModuleToggles() {
  const { settings, loaded, setEnabled } = useModuleSettings()
  if (!loaded) return null

  return (
    <section>
      <h3 className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Modüller
      </h3>
      <p className="mb-3 text-2xs text-muted-foreground/70">
        Kapatılan modülün verisi silinmez, yalnız yüzeyden kalkar.
      </p>
      <div className="divide-y divide-border rounded-xl border border-border bg-background/40">
        {MODULE_REGISTRY.map((m) => {
          const on = isModuleEnabled(settings, m.id)
          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-base leading-none">{m.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{m.name}</p>
                <p className="text-2xs text-muted-foreground">
                  {on ? 'Açık' : 'Kapalı — verin korunuyor'}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={on}
                aria-label={`${m.name} modülü`}
                onClick={() => setEnabled(m.id, !on).catch(() => {})}
                className={cn(
                  'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                  on ? 'bg-primary' : 'bg-input',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-4 rounded-full transition-all',
                    on ? 'left-[18px] bg-primary-foreground' : 'left-0.5 bg-foreground/70',
                  )}
                />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="no-scrollbar relative z-10 flex w-full max-w-sm flex-col overflow-y-auto border-r border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">
              B
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Bero</h2>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Settings className="size-3" /> Ayarlar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-5">
          <ModuleToggles />
          <ObsidianSyncSection />
        </div>
      </aside>
    </div>
  )
}
