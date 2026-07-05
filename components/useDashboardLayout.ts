'use client'

// Dashboard kart düzeni (pin/span/arşiv) — v0 ModuleState desenini gerçek
// veriye bağlayan hook. useModuleSettings ile aynı desen: yükle, olay
// üzerinden değil doğrudan çağrıyla güncelle, sunucu yanıtından state'i tazele.

import { useState, useEffect, useCallback } from 'react'
import { dbLoadDashboardLayout, dbSetDashboardCardLayout } from '@/lib/db'
import type { DashboardLayout, DashboardCardLayout } from '@/lib/db'

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    dbLoadDashboardLayout()
      .then(setLayout)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const update = useCallback(async (cardId: string, patch: DashboardCardLayout) => {
    setLayout((prev) => ({ ...prev, [cardId]: { ...prev[cardId], ...patch } })) // optimistic
    const next = await dbSetDashboardCardLayout(cardId, patch).catch(() => null)
    if (next) setLayout(next)
  }, [])

  return { layout, loaded, update }
}
