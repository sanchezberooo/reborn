'use client'

// Business Intelligence (Sprint 7) — her müşteri/iş kendi Brain'ine sahip
// olacak; bu sprintte yalnız liste. Veri lib/company/registry.ts BUSINESSES
// sözleşmesinden gelir (mock üretilmez); her kart ileride o işin kendi
// graph'ına açılacak — placeholder bölümü bunu söyler, davranış eklemez.

import { BUSINESSES } from '@/lib/company/registry'

export default function BusinessIntelligencePanel() {
  return (
    <div className="no-scrollbar flex h-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Business Intelligence</p>
          <p className="text-2xs text-muted-foreground">
            {BUSINESSES.length} iş · her biri ileride kendi Brain&apos;ine (scope) ve graph&apos;ına sahip olacak
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {BUSINESSES.map((business) => (
          <div
            key={business.id}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{business.name}</p>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-3xs font-medium text-muted-foreground">
                Planlandı
              </span>
            </div>
            <p className="text-2xs leading-relaxed text-muted-foreground">{business.description}</p>
            <div className="mt-auto flex min-h-[72px] items-center justify-center rounded-xl border border-dashed border-border bg-background/60">
              <p className="text-3xs text-muted-foreground/60">Business Brain graph — yakında</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
