'use client'

import { useState, useEffect } from 'react'
import { loadModules } from '@/lib/modules'
import type { ModuleItem } from '@/lib/modules'
import ModuleWidget from './ModuleWidget'

export default function ModuleDashboard() {
  const [modules, setModules] = useState<ModuleItem[]>([])

  function refresh() {
    setModules(loadModules())
  }

  useEffect(() => {
    refresh()
    // Sanchez bir modül değiştirince chat'ten event gelir
    window.addEventListener('reborn:modules-updated', refresh)
    return () => window.removeEventListener('reborn:modules-updated', refresh)
  }, [])

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground mb-1">
              Dashboard
            </h1>
            <p className="text-sm text-muted">
              {modules.length} modül aktif — Sanchez'e söyle, genişletsin.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {modules.map((mod) => (
            <ModuleWidget key={mod.id} module={mod} />
          ))}
        </div>

        {modules.length === 0 && (
          <div className="text-center py-16 text-muted text-sm">
            Henüz modül yok. Sanchez'e &quot;modül ekle&quot; de.
          </div>
        )}
      </div>
    </div>
  )
}
