'use client'

import { createContext, useContext, useState, useLayoutEffect, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectCtxType {
  value: string
  onChange: (v: string) => void
  open: boolean
  setOpen: (o: boolean) => void
  labels: Record<string, string>
  registerLabel: (v: string, l: string) => void
}

const SelectCtx = createContext<SelectCtxType | null>(null)

interface SelectProps {
  value?: string
  onValueChange?: (v: string) => void
  children: React.ReactNode
}

export function Select({ value = '', onValueChange, children }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [labels, setLabels] = useState<Record<string, string>>({})
  const ref = useRef<HTMLDivElement>(null)

  const registerLabel = (v: string, l: string) => {
    setLabels(prev => prev[v] === l ? prev : { ...prev, [v]: l })
  }

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <SelectCtx.Provider value={{ value, onChange: (v) => { onValueChange?.(v); setOpen(false) }, open, setOpen, labels, registerLabel }}>
      <div className="relative" ref={ref}>{children}</div>
    </SelectCtx.Provider>
  )
}

export function SelectTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  const ctx = useContext(SelectCtx)!
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        'flex h-9 items-center justify-between w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface text-foreground hover:bg-secondary transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
        className
      )}
    >
      {children}
      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
    </button>
  )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = useContext(SelectCtx)!
  const label = ctx.labels[ctx.value]
  return (
    <span className={label ? 'text-foreground' : 'text-muted-foreground'}>
      {label ?? placeholder ?? ''}
    </span>
  )
}

export function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const ctx = useContext(SelectCtx)!
  if (!ctx.open) return null
  return (
    <div className={cn('absolute z-50 w-full mt-1 rounded-lg border border-border bg-popover shadow-xl overflow-hidden', className)}>
      <div className="max-h-60 overflow-y-auto py-1">{children}</div>
    </div>
  )
}

export function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(SelectCtx)!
  useLayoutEffect(() => {
    if (typeof children === 'string') ctx.registerLabel(value, children)
  }, [value, children])
  return (
    <div
      className={cn(
        'px-3 py-2 text-sm cursor-pointer transition-colors',
        ctx.value === value ? 'bg-surface-3 text-primary' : 'text-foreground hover:bg-secondary',
        className
      )}
      onClick={() => ctx.onChange(value)}
    >
      {children}
    </div>
  )
}
