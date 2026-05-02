'use client'

import { cn } from '@/lib/utils'

interface SliderProps {
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
  className?: string
  disabled?: boolean
}

export function Slider({ value, defaultValue, min = 0, max = 100, step = 1, onValueChange, className, disabled }: SliderProps) {
  const current = value?.[0] ?? defaultValue?.[0] ?? 0
  const pct = ((current - min) / (max - min)) * 100

  return (
    <div className={cn('relative flex w-full touch-none select-none items-center', className)}>
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <div className="absolute h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        disabled={disabled}
        onChange={e => onValueChange?.([Number(e.target.value)])}
        className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <div
        className="absolute h-4 w-4 rounded-full border-2 border-primary bg-background shadow transition-colors"
        style={{ left: `calc(${pct}% - 8px)` }}
      />
    </div>
  )
}
