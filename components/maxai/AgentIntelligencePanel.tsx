'use client'

// Agent Intelligence — "Agent Brain" ekranının yerini alan yüzey (Sprint 7).
// Bugün: kategori kartları (canlı/registry sayımlı) + graph placeholder.
// Yarın: Obsidian tarzı node grafiği — veri modeli lib/company/intelligence.ts
// sözleşmesinde hazır (kategori → entities.type eşlemesi), graph bağlandığında
// bu component'in yalnız placeholder bölümü değişir.
//
// Sayımlar: registry kategorileri senkron gerçek veridir; brain kategorileri
// /api/intelligence/stats'tan (scope='agent' tip sayımı) bir kez çekilir —
// canlı akış değil, sekme açılışı yeter (polling bilinçli yok: sayılar
// dakikalar içinde değişmez, Ofis'in 5 sn döngüsü buraya taşınmaz).

import { useEffect, useState } from 'react'
import {
  INTELLIGENCE_CATEGORIES,
  resolveCategoryCounts,
  type IntelligenceSource,
} from '@/lib/company/intelligence'
import { cn } from '@/lib/utils'

const SOURCE_META: Record<IntelligenceSource, { label: string; className: string }> = {
  registry: { label: 'Registry', className: 'bg-primary/15 text-primary' },
  brain: { label: 'Agent Brain', className: 'bg-success/15 text-success' },
  planned: { label: 'Planlandı', className: 'bg-secondary text-muted-foreground' },
}

export default function AgentIntelligencePanel() {
  // null = henüz yüklenmedi / uç hata verdi → brain kartları "—" gösterir.
  const [brainCounts, setBrainCounts] = useState<Record<string, number> | null>(null)
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/intelligence/stats')
      .then((r) => r.json())
      .then((data: { nodeCounts: Record<string, number> | null }) => {
        if (!alive) return
        if (data.nodeCounts) setBrainCounts(data.nodeCounts)
        else setStatsError(true)
      })
      .catch(() => { if (alive) setStatsError(true) })
    return () => { alive = false }
  }, [])

  const rows = resolveCategoryCounts(brainCounts ?? undefined)
  const totalNodes = brainCounts
    ? Object.values(brainCounts).reduce((sum, n) => sum + n, 0)
    : null

  return (
    <div className="no-scrollbar flex h-full flex-col gap-4 overflow-y-auto p-6">
      {/* özet şeridi */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Agent Intelligence</p>
          <p className="text-2xs text-muted-foreground">
            Şirketin bildiği her şey — {INTELLIGENCE_CATEGORIES.length} kategori
            {totalNodes !== null && <> · Agent Brain&apos;de {totalNodes} node</>}
            {statsError && <> · canlı sayım alınamadı</>}
          </p>
        </div>
      </div>

      {/* kategori kartları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {rows.map(({ category, count }) => {
          const source = SOURCE_META[category.source]
          return (
            <div
              key={category.id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{category.label}</p>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-3xs font-medium', source.className)}>
                  {source.label}
                </span>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {count ?? '—'}
              </p>
              <p className="text-2xs leading-relaxed text-muted-foreground">{category.description}</p>
            </div>
          )
        })}
      </div>

      {/* graph placeholder — gelecekte Obsidian tarzı node grafiği */}
      <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-sm font-medium text-foreground">Intelligence Graph</p>
        <p className="max-w-md text-2xs leading-relaxed text-muted-foreground">
          Obsidian tarzı bilgi grafiği burada yaşayacak: kategoriler yukarıdaki
          sözleşmeyle Agent Brain node tiplerine bağlı — graph geldiğinde veri
          modeli değişmeyecek, yalnız bu alan dolacak.
        </p>
      </div>
    </div>
  )
}
