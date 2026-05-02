'use client'

import { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

interface TabsCtxType {
  value: string
  onValueChange: (v: string) => void
}

const TabsCtx = createContext<TabsCtxType | null>(null)

interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ value, defaultValue, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? '')
  const isControlled = value !== undefined
  const current = isControlled ? value! : internal
  const onChange = isControlled ? (onValueChange ?? (() => {})) : setInternal

  return (
    <TabsCtx.Provider value={{ value: current, onValueChange: onChange }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsCtx.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('inline-flex items-center rounded-lg bg-secondary p-1 gap-1', className)}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(TabsCtx)!
  const active = ctx.value === value
  return (
    <button
      type="button"
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus:outline-none disabled:pointer-events-none disabled:opacity-50',
        active ? 'bg-surface-3 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(TabsCtx)!
  if (ctx.value !== value) return null
  return <div className={cn('mt-2', className)}>{children}</div>
}
