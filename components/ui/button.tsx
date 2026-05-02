import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function Button({ className, variant = 'default', size = 'default', children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-primary text-primary-foreground hover:bg-gold-dim',
        variant === 'outline' && 'border border-border bg-transparent text-foreground hover:bg-secondary',
        variant === 'ghost' && 'bg-transparent text-foreground hover:bg-secondary',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-surface-3',
        variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:opacity-90',
        size === 'default' && 'h-9 px-4 py-2 text-sm',
        size === 'sm' && 'h-7 px-3 py-1 text-xs',
        size === 'lg' && 'h-11 px-6 py-3 text-base',
        size === 'icon' && 'h-9 w-9 p-0',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
