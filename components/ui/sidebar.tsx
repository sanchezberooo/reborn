'use client'

import * as React from 'react'
import { PanelLeftIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── Context ──────────────────────────────────────────────────────────────────

type SidebarContextProps = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

export function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider.')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((v: boolean) => boolean)) => {
      const next = typeof value === 'function' ? value(open) : value
      setOpenProp ? setOpenProp(next) : _setOpen(next)
    },
    [open, setOpenProp],
  )
  const toggleSidebar = React.useCallback(() => setOpen((o) => !o), [setOpen])

  const ctx = React.useMemo<SidebarContextProps>(
    () => ({
      state: open ? 'expanded' : 'collapsed',
      open,
      setOpen,
      openMobile: false,
      setOpenMobile: () => {},
      isMobile: false,
      toggleSidebar,
    }),
    [open, setOpen, toggleSidebar],
  )

  return (
    <SidebarContext.Provider value={ctx}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            '--sidebar-width': '16rem',
            '--sidebar-width-icon': '3rem',
            ...style,
          } as React.CSSProperties
        }
        className={cn('flex h-full w-full min-h-0', className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right'
  variant?: 'sidebar' | 'floating' | 'inset'
  collapsible?: 'offcanvas' | 'icon' | 'none'
}) {
  const { state } = useSidebar()
  const collapsed = collapsible !== 'none' && state === 'collapsed'

  return (
    <div
      data-state={state}
      data-collapsible={collapsible}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
      className={cn(
        'bg-surface border-r border-border flex flex-col shrink-0 transition-[width] duration-200 ease-linear overflow-hidden',
        collapsed ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Trigger & Rail ───────────────────────────────────────────────────────────

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()
  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn('size-7', className)}
      onClick={(e) => {
        onClick?.(e)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

export function SidebarRail({ className, ...props }: React.ComponentProps<'button'>) {
  const { toggleSidebar } = useSidebar()
  return (
    <button
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      className={cn(
        'absolute inset-y-0 right-0 z-20 w-1 cursor-col-resize opacity-0 hover:opacity-100 hover:bg-border transition-opacity hidden sm:block',
        className,
      )}
      {...props}
    />
  )
}

// ─── Layout Parts ─────────────────────────────────────────────────────────────

export function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn('flex-1 min-w-0 flex flex-col overflow-hidden', className)}
      {...props}
    />
  )
}

export function SidebarInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="sidebar-input"
      className={cn('bg-background h-8 w-full rounded border border-border px-3 text-sm outline-none', className)}
      {...props}
    />
  )
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-header" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-footer" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
}

export function SidebarSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-separator" className={cn('bg-border mx-2 h-px my-1', className)} {...props} />
}

export function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden', className)}
      {...props}
    />
  )
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-group" className={cn('relative flex w-full min-w-0 flex-col p-2', className)} {...props} />
}

export function SidebarGroupLabel({
  className,
  asChild: _asChild,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const { state } = useSidebar()
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        'text-muted/70 flex h-8 shrink-0 items-center px-2 text-xs font-medium transition-opacity duration-200',
        state === 'collapsed' ? 'opacity-0 -mt-8 overflow-hidden' : 'opacity-100',
        className,
      )}
      {...props}
    />
  )
}

export function SidebarGroupAction({
  className,
  asChild: _asChild,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  return (
    <button
      data-slot="sidebar-group-action"
      className={cn('absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md', className)}
      {...props}
    />
  )
}

export function SidebarGroupContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sidebar-group-content" className={cn('w-full text-sm', className)} {...props} />
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="sidebar-menu" className={cn('flex w-full min-w-0 flex-col gap-1', className)} {...props} />
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-item" className={cn('group/menu-item relative', className)} {...props} />
}

export function SidebarMenuButton({
  asChild: _asChild,
  isActive = false,
  variant: _variant,
  size: _size,
  tooltip: _tooltip,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean
  isActive?: boolean
  variant?: string
  size?: string
  tooltip?: string | object
}) {
  const { state } = useSidebar()

  return (
    <button
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={cn(
        'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-2 py-2 text-left text-sm transition-colors',
        'hover:bg-gold/10 hover:text-gold focus-visible:outline-none',
        isActive ? 'bg-gold/15 text-gold font-medium' : 'text-muted',
        state === 'collapsed' && '[&>span]:hidden',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarMenuAction({
  className,
  asChild: _asChild,
  showOnHover,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean; showOnHover?: boolean }) {
  return (
    <button
      data-slot="sidebar-menu-action"
      className={cn(
        'absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md',
        showOnHover && 'opacity-0 group-hover/menu-item:opacity-100',
        className,
      )}
      {...props}
    />
  )
}

export function SidebarMenuBadge({ className, ...props }: React.ComponentProps<'div'>) {
  const { state } = useSidebar()
  if (state === 'collapsed') return null
  return (
    <div
      data-slot="sidebar-menu-badge"
      className={cn(
        'pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium select-none',
        className,
      )}
      {...props}
    />
  )
}

export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<'div'> & { showIcon?: boolean }) {
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      className={cn('flex h-8 items-center gap-2 rounded-md px-2 animate-pulse', className)}
      {...props}
    >
      {showIcon && <div className="size-4 rounded-md bg-surface-3" />}
      <div className="h-4 flex-1 rounded bg-surface-3" />
    </div>
  )
}

export function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn('mx-3.5 flex min-w-0 flex-col gap-1 border-l border-border px-2.5 py-0.5', className)}
      {...props}
    />
  )
}

export function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-sub-item" className={cn('relative', className)} {...props} />
}

export function SidebarMenuSubButton({
  asChild: _asChild,
  size = 'md',
  isActive = false,
  className,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean; size?: 'sm' | 'md'; isActive?: boolean }) {
  return (
    <a
      data-slot="sidebar-menu-sub-button"
      data-active={isActive}
      className={cn(
        'flex h-7 items-center gap-2 rounded-md px-2 text-sm text-muted hover:text-gold hover:bg-gold/10 transition-colors',
        isActive && 'text-gold bg-gold/15',
        size === 'sm' && 'text-xs',
        className,
      )}
      {...props}
    />
  )
}
