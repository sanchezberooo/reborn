'use client'

// Uygulama iskeleti (UI v1) — üst sekme çubuğu kaldırıldı; sol ikon rayı
// (AppNav, 4 kalıcı bölüm) + içerik. Sanchez sayfasında sohbet listesi
// (Sidebar) rayın yanında ikinci sütun olarak açılır; diğer sayfalarda
// MiniChat köşede durur (tek muhatap ilkesi — Sanchez her yerden erişilir).

import { usePathname } from 'next/navigation'
import AppNav from './AppNav'
import Sidebar from './Sidebar'
import MiniChat from './chat/MiniChat'
import ModuleGate from './ModuleGate'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isSanchezPage = pathname === '/'

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <AppNav />
      {isSanchezPage && <Sidebar />}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ModuleGate>{children}</ModuleGate>
      </main>
      {!isSanchezPage && <MiniChat />}
    </div>
  )
}
