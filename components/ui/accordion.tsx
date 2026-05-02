'use client'

import { useState, createContext, useContext } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const AccordionRootCtx = createContext<{ open: string; toggle: (v: string) => void } | null>(null)
const AccordionItemCtx = createContext<string>('')

export function Accordion({ collapsible = false, children, className }: {
  type?: 'single' | 'multiple'
  collapsible?: boolean
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState('')
  const toggle = (v: string) => setOpen(prev => prev === v ? (collapsible ? '' : prev) : v)
  return (
    <AccordionRootCtx.Provider value={{ open, toggle }}>
      <div className={cn('', className)}>{children}</div>
    </AccordionRootCtx.Provider>
  )
}

export function AccordionItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <AccordionItemCtx.Provider value={value}>
      <div className={cn('border-b border-border', className)}>{children}</div>
    </AccordionItemCtx.Provider>
  )
}

export function AccordionTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  const root = useContext(AccordionRootCtx)
  const value = useContext(AccordionItemCtx)
  const isOpen = root?.open === value
  return (
    <button
      type="button"
      onClick={() => root?.toggle(value)}
      className={cn('flex w-full items-center justify-between py-4 text-sm font-medium transition-all hover:underline', className)}
    >
      {children}
      <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')} />
    </button>
  )
}

export function AccordionContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const root = useContext(AccordionRootCtx)
  const value = useContext(AccordionItemCtx)
  if (!root || root.open !== value) return null
  return <div className={cn('pb-4 text-sm', className)}>{children}</div>
}
