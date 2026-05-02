import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-colors',
        className
      )}
      {...props}
    />
  )
}
