'use client'

// Modül çerçevesi v1 — route kapısı. Pathname bir modülün alanındaysa
// ve modül kapalıysa sayfa içeriği yerine kısa bir bilgi gösterir:
// kapalı modülün route'u da UI'dan kaybolur, yalnız menü öğesi değil.
// Veri katmanına dokunmaz — sayfa render edilmez, veri olduğu gibi durur.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { moduleForPath, isModuleEnabled } from '@/lib/module-registry'
import { useModuleSettings } from './useModuleSettings'

export default function ModuleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const mod = moduleForPath(pathname ?? '')
  const { settings, loaded, setEnabled } = useModuleSettings()

  if (!mod) return <>{children}</>
  // Tercih yüklenmeden modül sayfası gösterilmez (kapalı içeriğin flash'ı olmasın)
  if (!loaded) return null
  if (isModuleEnabled(settings, mod.id)) return <>{children}</>

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <p className="text-2xl mb-3">{mod.icon}</p>
        <p className="text-sm text-foreground font-medium mb-1">{mod.name} modülü kapalı</p>
        <p className="text-[12px] text-muted mb-5">
          Verin silinmedi — modülü açtığında her şey yerinde olacak.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setEnabled(mod.id, true).catch(() => {})}
            className="px-4 py-2 rounded-xl text-sm text-gold bg-gold/10 hover:bg-gold/20 transition-colors font-medium"
          >
            Modülü Aç
          </button>
          <Link href="/dashboard" className="text-[12px] text-muted hover:text-foreground transition-colors">
            Dashboard&apos;a dön
          </Link>
        </div>
      </div>
    </div>
  )
}
