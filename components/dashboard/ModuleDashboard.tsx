'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { dbLoadModules } from '@/lib/db'
import type { ModuleItem } from '@/lib/modules'
import ModuleWidget from './ModuleWidget'

const GRID_SIZE = 9

function EmptySlot({ index }: { index: number }) {
  return (
    <Link
      href="/"
      title="Sanchez'e söyle, modül eklesin"
      className="bg-surface border border-dashed border-border rounded-lg p-5 flex flex-col items-center justify-center gap-2 hover:border-gold/40 hover:bg-surface-2 transition-all duration-150 group min-h-[130px]"
    >
      <div className="w-9 h-9 rounded-xl border border-dashed border-border group-hover:border-gold/30 flex items-center justify-center transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/40 group-hover:text-muted transition-colors">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <p className="text-[11px] text-muted/40 group-hover:text-muted/60 text-center transition-colors leading-snug">
        Sanchez ile ekle
      </p>
    </Link>
  )
}

export default function ModuleDashboard() {
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      setModules(await dbLoadModules())
    } catch {} finally {
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
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-gold/50 animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const emptyCount = Math.max(0, GRID_SIZE - modules.length)
  const emptySlots = Array.from({ length: emptyCount }, (_, i) => i)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground mb-1">Dashboard</h1>
          <p className="text-sm text-muted">
            {modules.length > 0 ? `${modules.length} modül aktif` : 'Sanchez\'e söyle, modül eklesin.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {modules.map((mod) => (
            <ModuleWidget key={mod.id} module={mod} />
          ))}
          {emptySlots.map((i) => (
            <EmptySlot key={`empty-${i}`} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
