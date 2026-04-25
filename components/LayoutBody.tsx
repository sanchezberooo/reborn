'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function LayoutBody({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isChat = pathname === '/'

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {isChat && <Sidebar />}
      <main className="flex-1 min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
