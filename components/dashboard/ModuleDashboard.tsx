'use client'

import { useState, useEffect } from 'react'
import { dbLoadModules } from '@/lib/db'
import type { ModuleItem } from '@/lib/modules'
import ModuleWidget from './ModuleWidget'

export default function ModuleDashboard() {
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      setModules(await dbLoadModules())
    } catch {}
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    window.addEventListener('reborn:modules-updated', refresh)
    return () => window.removeEventListener('reborn:modules-updated', refresh)
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gold/50 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground mb-1">Dashboard</h1>
          <p className="text-sm text-muted">
            {modules.length > 0
              ? `${modules.length} modül aktif`
              : 'Sanchez\'e söyle, modül eklesin.'}
          </p>
        </div>

        {modules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <p className="text-sm text-muted">Henüz modül yok.</p>
            <p className="text-xs text-muted/60">Chat&apos;e git ve Sanchez&apos;e &quot;modül ekle&quot; de.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {modules.map((mod) => (
              <ModuleWidget key={mod.id} module={mod} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
