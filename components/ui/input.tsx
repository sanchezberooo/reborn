import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-9 w-full rounded-lg border border-border bg-surface px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className
      )}
      {...props}
    />
  )
}
