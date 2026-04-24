import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Reborn',
  description: 'AI-powered personal life operating system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className={`${inter.variable} ${playfair.variable} h-full`}>
      <body className="h-full bg-background text-foreground">
        <div className="flex h-full">
          {/* Sidebar — desktop */}
          <aside className="hidden md:flex w-16 flex-col items-center border-r border-border bg-surface py-6 gap-2 shrink-0">
            <Navigation orientation="vertical" />
          </aside>

          {/* Main content */}
          <div className="flex flex-col flex-1 min-w-0">
            <main className="flex-1 overflow-hidden">{children}</main>

            {/* Bottom nav — mobile */}
            <nav className="md:hidden border-t border-border bg-surface">
              <Navigation orientation="horizontal" />
            </nav>
          </div>
        </div>
      </body>
    </html>
  )
}
