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
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  Flame,
  Zap,
  Clock,
  CheckCircle2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { modules, initialProgress, levelInfo, achievements } from '../lib/data'
import type { ModuleType } from '../lib/types'

interface DashboardProps {
  onModuleChange: (module: ModuleType) => void
}

const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  vocabulary: BookOpen,
  grammar: FileText,
  idioms: MessageSquare,
  patterns: Layers,
  reading: BookText,
  listening: Headphones,
  writing: PenTool,
  speaking: Mic,
}

const gradients: Record<string, string> = {
  vocabulary: 'from-blue-600 to-cyan-500',
  grammar: 'from-purple-600 to-pink-500',
  idioms: 'from-orange-600 to-red-500',
  patterns: 'from-green-600 to-emerald-500',
  reading: 'from-indigo-600 to-blue-500',
  listening: 'from-teal-600 to-cyan-500',
  writing: 'from-rose-600 to-pink-500',
  speaking: 'from-amber-600 to-orange-500',
}

export function Dashboard({ onModuleChange }: DashboardProps) {
  const progress = initialProgress
  const currentLevel = levelInfo[progress.level]
  const nextLevel = progress.level === 'C2' ? null : levelInfo[Object.keys(levelInfo)[Object.keys(levelInfo).indexOf(progress.level) + 1] as keyof typeof levelInfo]
  const xpForNextLevel = nextLevel ? nextLevel.xpRequired - progress.xp : 0
  const levelProgress = nextLevel 
    ? ((progress.xp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100 
    : 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hosgeldin!</h1>
          <p className="text-muted-foreground">Bugunku ogrenme hedeflerine devam et</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 border border-border">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="font-semibold">{progress.streak} Gun Seri</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 border border-border">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">{progress.xp.toLocaleString()} XP</span>
          </div>
        </div>
      </div>

      {/* Level Progress */}
      <Card className="bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${currentLevel.color}`}>
                <span className="text-lg font-bold text-white">{progress.level}</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{currentLevel.name}</h3>
                <p className="text-sm text-muted-foreground">{(currentLevel as any).nameTr ?? (currentLevel as any).nametr ?? ''}</p>
              </div>
            </div>
            {nextLevel && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Sonraki seviye icin</p>
                <p className="font-semibold text-foreground">{xpForNextLevel.toLocaleString()} XP</p>
              </div>
            )}
          </div>
          <Progress value={levelProgress} className="h-3" />
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/20">
                <BookOpen className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ogrenilen Kelime</p>
                <p className="text-2xl font-bold">{progress.wordsLearned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/20">
                <FileText className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gramer Kurali</p>
                <p className="text-2xl font-bold">{progress.grammarCompleted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/20">
                <MessageSquare className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ogrenilen Deyim</p>
                <p className="text-2xl font-bold">{progress.idiomsLearned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/20">
                <Target className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ortalama Skor</p>
                <p className="text-2xl font-bold">{progress.averageScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modules Grid */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Ogrenme Modulleri</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => {
            const Icon = moduleIcons[module.id]
            const gradient = gradients[module.id]
            return (
              <Card 
                key={module.id} 
                className="group cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10"
                onClick={() => onModuleChange(module.id)}
              >
                <CardContent className="pt-6">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {module.titleTr}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{module.title}</p>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Ilerleme</span>
                      <span className="font-medium">{module.progress}%</span>
                    </div>
                    <Progress value={module.progress} className="h-2" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {module.completedItems} / {module.totalItems} tamamlandı
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Achievements */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Basarimlar</h2>
          <Button variant="ghost" size="sm">
            Tumunu Gor
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {achievements.slice(0, 6).map((achievement) => (
            <Card key={achievement.id} className={achievement.unlockedAt ? 'border-primary/50' : 'opacity-60'}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${achievement.unlockedAt ? 'bg-primary' : 'bg-muted'}`}>
                    <Trophy className={`h-6 w-6 ${achievement.unlockedAt ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{achievement.title}</h4>
                    <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>{achievement.progress} / {achievement.target}</span>
                        {achievement.unlockedAt && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <Progress value={(achievement.progress / achievement.target) * 100} className="h-1.5" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Daily Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Gunluk Hedefler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">10 Yeni Kelime Ogren</p>
                  <p className="text-sm text-muted-foreground">7/10 tamamlandı</p>
                </div>
              </div>
              <Progress value={70} className="w-24 h-2" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                  <FileText className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium">1 Gramer Kuralı Tamamla</p>
                  <p className="text-sm text-muted-foreground">0/1 tamamlandı</p>
                </div>
              </div>
              <Progress value={0} className="w-24 h-2" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                  <Clock className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">15 Dakika Pratik Yap</p>
                  <p className="text-sm text-muted-foreground">10/15 dakika</p>
                </div>
              </div>
              <Progress value={66} className="w-24 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
