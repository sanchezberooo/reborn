'use client'

import { createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

interface RadioGroupCtxType {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}

const RadioGroupCtx = createContext<RadioGroupCtxType | null>(null)

interface RadioGroupProps {
  value?: string
  onValueChange?: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}

export function RadioGroup({ value = '', onValueChange, disabled, children, className }: RadioGroupProps) {
  return (
    <RadioGroupCtx.Provider value={{ value, onChange: onValueChange ?? (() => {}), disabled }}>
      <div className={cn('grid gap-2', className)} role="radiogroup">
        {children}
      </div>
    </RadioGroupCtx.Provider>
  )
}

interface RadioGroupItemProps {
  value: string
  id?: string
  className?: string
  disabled?: boolean
}

export function RadioGroupItem({ value, id, className, disabled }: RadioGroupItemProps) {
  const ctx = useContext(RadioGroupCtx)!
  const checked = ctx.value === value
  const isDisabled = disabled || ctx.disabled
  return (
    <input
      type="radio"
      id={id}
      value={value}
      checked={checked}
      onChange={() => !isDisabled && ctx.onChange(value)}
      disabled={isDisabled}
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed',
        className
      )}
    />
  )
}
