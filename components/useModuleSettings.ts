'use client'

// Modül çerçevesi v1 — görünürlük tercihini okuyan/yazan ortak hook.
// Header sekmeleri, dashboard kartları ve ModuleGate aynı kaynaktan
// beslenir; değişiklik olay otobüsüyle (MODULE_SETTINGS_EVENT) yayılır.

import { useState, useEffect, useCallback } from 'react'
import { dbLoadModuleSettings, dbSetModuleEnabled } from '@/lib/db'
import { MODULE_SETTINGS_EVENT, type ModuleSettings } from '@/lib/module-registry'

export function useModuleSettings() {
  const [settings, setSettings] = useState<ModuleSettings>({})
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const s = await dbLoadModuleSettings().catch(() => ({}) as ModuleSettings)
    setSettings(s)
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener(MODULE_SETTINGS_EVENT, refresh)
    return () => window.removeEventListener(MODULE_SETTINGS_EVENT, refresh)
  }, [refresh])

  const setEnabled = useCallback(async (moduleId: string, enabled: boolean) => {
    const next = await dbSetModuleEnabled(moduleId, enabled)
    setSettings(next)
    window.dispatchEvent(new CustomEvent(MODULE_SETTINGS_EVENT))
  }, [])

  return { settings, loaded, setEnabled }
}
