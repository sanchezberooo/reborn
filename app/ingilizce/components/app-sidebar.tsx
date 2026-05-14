'use client'

import { 
  BookOpen, 
  FileText, 
  MessageSquare, 
  Layers, 
  BookText, 
  Headphones, 
  PenTool, 
  Mic,
  LayoutDashboard,
  Trophy,
  Settings,
  HelpCircle,
  Flame,
  Zap,
  GraduationCap
} from 'lucide-react'
import type { ModuleType } from '../lib/types'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'

interface AppSidebarProps {
  activeModule: ModuleType | 'dashboard'
  onModuleChange: (module: ModuleType | 'dashboard') => void
  streak: number
  xp: number
}

const moduleIcons = {
  vocabulary: BookOpen,
  grammar: FileText,
  idioms: MessageSquare,
  patterns: Layers,
  reading: BookText,
  listening: Headphones,
  writing: PenTool,
  speaking: Mic,
}

const modules = [
  { id: 'vocabulary' as const, label: 'Kelime Bankasi', labelEn: 'Vocabulary', level: 'A1-C2' },
  { id: 'grammar' as const, label: 'Gramer', labelEn: 'Grammar', level: 'A1-C2' },
  { id: 'idioms' as const, label: 'Deyimler', labelEn: 'Idioms', level: 'B1-C2' },
  { id: 'patterns' as const, label: 'Kaliplar', labelEn: 'Patterns', level: 'A2-C1' },
  { id: 'reading' as const, label: 'Okuma', labelEn: 'Reading', level: 'A1-C2' },
  { id: 'listening' as const, label: 'Dinleme', labelEn: 'Listening', level: 'A1-C2' },
  { id: 'writing' as const, label: 'Yazma', labelEn: 'Writing', level: 'A2-C2' },
  { id: 'speaking' as const, label: 'Konusma', labelEn: 'Speaking', level: 'A1-C2' },
]

export function AppSidebar({ activeModule, onModuleChange, streak, xp }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold text-sidebar-foreground">LinguaMaster</span>
            <span className="text-[10px] text-muted-foreground">Ingilizce Ogrenme</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Stats */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-around rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-semibold text-sidebar-foreground">{streak} gun</span>
            </div>
            <div className="h-4 w-px bg-sidebar-border" />
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs font-semibold text-sidebar-foreground">{xp.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} XP</span>
            </div>
          </div>
        </SidebarGroup>

        {/* Dashboard */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeModule === 'dashboard'}
                  onClick={() => onModuleChange('dashboard')}
                  tooltip="Ana Sayfa"
                  style={{ color: activeModule === 'dashboard' ? '#c8a96e' : '#ffffff' }}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Modules */}
        <SidebarGroup>
          <SidebarGroupLabel style={{ color: '#a0a0a0' }}>Moduller</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((module) => {
                const Icon = moduleIcons[module.id]
                const isActive = activeModule === module.id
                return (
                  <SidebarMenuItem key={module.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onModuleChange(module.id)}
                      tooltip={module.label}
                      style={{ color: isActive ? '#c8a96e' : '#ffffff' }}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{module.label}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge style={{ fontSize: 9, color: '#a0a0a0', background: 'transparent' }}>
                      {module.level}
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Basarimlar" style={{ color: '#ffffff' }}>
              <Trophy className="h-4 w-4" />
              <span>Basarımlar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
