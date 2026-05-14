'use client'

import { usePathname } from 'next/navigation'
import Header from './Header'
import LayoutBody from './LayoutBody'
import MiniChat from './chat/MiniChat'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login' || pathname.startsWith('/auth')
  const isSanchezPage = pathname === '/'

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col h-full">
      <Header />
      <LayoutBody>{children}</LayoutBody>
      {!isSanchezPage && <MiniChat />}
    </div>
  )
}
