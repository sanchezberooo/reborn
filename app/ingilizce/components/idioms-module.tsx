'use client'

import { useState } from 'react'
import { 
  Search,
  BookmarkPlus,
  Check,
  ChevronRight,
  Lightbulb,
  History,
  MessageSquareQuote,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { sampleIdioms, samplePatterns, idiomCategories } from '../lib/data'
import type { Idiom, SentencePattern, Level } from '../lib/types'
import { cn } from '@/lib/utils'

type ContentType = 'idioms' | 'patterns'

export function IdiomsModule() {
  const [contentType, setContentType] = useState<ContentType>('idioms')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<Level | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [learnedItems, setLearnedItems] = useState<Set<string>>(new Set())
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  const filteredIdioms = sampleIdioms.filter(idiom => {
    const matchesSearch = idiom.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          idiom.turkish.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLevel = selectedLevel === 'all' || idiom.level === selectedLevel
    const matchesCategory = selectedCategory === 'all' || idiom.category === selectedCategory
    return matchesSearch && matchesLevel && matchesCategory
  })

  const filteredPatterns = samplePatterns.filter(pattern => {
    const matchesSearch = pattern.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pattern.meaning.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLevel = selectedLevel === 'all' || pattern.level === selectedLevel
    return matchesSearch && matchesLevel
  })

  const levelColors: Record<Level, string> = {
    'A1': 'bg-green-500/20 text-green-400 border-green-500/30',
    'A2': 'bg-lime-500/20 text-lime-400 border-lime-500/30',
    'B1': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'B2': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'C1': 'bg-red-500/20 text-red-400 border-red-500/30',
    'C2': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  }

  const handleMarkLearned = (id: string) => {
    setLearnedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Deyimler & Kaliplar</h1>
          <p className="text-muted-foreground">Ingilizce deyimleri ve cumle kaliplarini ogren</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm bg-green-500/20 text-green-400">
            {learnedItems.size} ogrenildi
          </Badge>
        </div>
      </div>

      {/* Content Type Tabs */}
      <Tabs value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="idioms">Deyimler ({filteredIdioms.length})</TabsTrigger>
          <TabsTrigger value="patterns">Kaliplar ({filteredPatterns.length})</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedLevel} onValueChange={(v) => setSelectedLevel(v as Level | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Seviye" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Seviyeler</SelectItem>
              <SelectItem value="A1">A1 - Baslangic</SelectItem>
              <SelectItem value="A2">A2 - Temel</SelectItem>
              <SelectItem value="B1">B1 - Orta</SelectItem>
              <SelectItem value="B2">B2 - Orta Ustu</SelectItem>
              <SelectItem value="C1">C1 - Ileri</SelectItem>
              <SelectItem value="C2">C2 - Uzman</SelectItem>
            </SelectContent>
          </Select>
          {contentType === 'idioms' && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Kategoriler</SelectItem>
                {idiomCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Idioms Content */}
        <TabsContent value="idioms" className="mt-6">
          <Tabs defaultValue="list">
            <TabsList className="mb-6">
              <TabsTrigger value="list">Liste</TabsTrigger>
              <TabsTrigger value="flashcard">Flashcard</TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              <div className="grid gap-4 md:grid-cols-2">
                {filteredIdioms.map((idiom) => (
                  <IdiomCard
                    key={idiom.id}
                    idiom={idiom}
                    isLearned={learnedItems.has(idiom.id)}
                    onMarkLearned={() => handleMarkLearned(idiom.id)}
                    levelColor={levelColors[idiom.level]}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="flashcard">
              {filteredIdioms.length > 0 ? (
                <IdiomFlashcard
                  idioms={filteredIdioms}
                  currentIndex={currentFlashcardIndex}
                  setCurrentIndex={setCurrentFlashcardIndex}
                  isFlipped={isFlipped}
                  setIsFlipped={setIsFlipped}
                  isLearned={(id) => learnedItems.has(id)}
                  onMarkLearned={handleMarkLearned}
                  levelColors={levelColors}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Filtreye uygun deyim bulunamadi</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Patterns Content */}
        <TabsContent value="patterns" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredPatterns.map((pattern) => (
              <PatternCard
                key={pattern.id}
                pattern={pattern}
                isLearned={learnedItems.has(`pattern-${pattern.id}`)}
                onMarkLearned={() => handleMarkLearned(`pattern-${pattern.id}`)}
                levelColor={levelColors[pattern.level]}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Flashcard CSS */}
      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  )
}

// Idiom Card Component
function IdiomCard({
  idiom,
  isLearned,
  onMarkLearned,
  levelColor
}: {
  idiom: Idiom
  isLearned: boolean
  onMarkLearned: () => void
  levelColor: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className={cn(
      "transition-all hover:shadow-lg hover:shadow-primary/5",
      isLearned && "border-green-500/50 bg-green-500/5"
    )}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <Badge className={levelColor}>{idiom.level}</Badge>
          <Badge variant="outline">{idiom.category}</Badge>
        </div>

        <h3 className="text-xl font-bold mb-2">{idiom.english}</h3>
        <p className="text-lg text-primary mb-2">{idiom.turkish}</p>
        
        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
          <MessageSquareQuote className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Literal: {idiom.literal}</p>
        </div>

        {expanded && (
          <div className="space-y-4 mt-4">
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Anlam
              </p>
              <p className="text-sm text-muted-foreground">{idiom.meaning}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Ornekler</p>
              <ul className="space-y-1">
                {idiom.examples.map((ex, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {ex}</li>
                ))}
              </ul>
            </div>

            {idiom.origin && (
              <div className="flex items-start gap-2 text-sm">
                <History className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">{idiom.origin}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Gizle' : 'Detaylar'}
            <ChevronRight className={cn("h-4 w-4 ml-1 transition-transform", expanded && "rotate-90")} />
          </Button>
          <Button
            variant={isLearned ? "default" : "outline"}
            size="sm"
            onClick={onMarkLearned}
          >
            {isLearned ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Idiom Flashcard Component
function IdiomFlashcard({
  idioms,
  currentIndex,
  setCurrentIndex,
  isFlipped,
  setIsFlipped,
  isLearned,
  onMarkLearned,
  levelColors
}: {
  idioms: Idiom[]
  currentIndex: number
  setCurrentIndex: (index: number) => void
  isFlipped: boolean
  setIsFlipped: (flipped: boolean) => void
  isLearned: (id: string) => boolean
  onMarkLearned: (id: string) => void
  levelColors: Record<Level, string>
}) {
  const currentIdiom = idioms[currentIndex]

  const handleNext = () => {
    setIsFlipped(false)
    setCurrentIndex((currentIndex + 1) % idioms.length)
  }

  const handlePrev = () => {
    setIsFlipped(false)
    setCurrentIndex((currentIndex - 1 + idioms.length) % idioms.length)
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-sm text-muted-foreground">
        {currentIndex + 1} / {idioms.length}
      </div>

      <div
        className="relative w-full max-w-lg h-96 cursor-pointer perspective-1000"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={cn(
          "absolute inset-0 transition-transform duration-500 transform-style-preserve-3d",
          isFlipped && "rotate-y-180"
        )}>
          {/* Front */}
          <Card className="absolute inset-0 flex flex-col items-center justify-center backface-hidden bg-gradient-to-br from-orange-500/10 to-red-500/10">
            <CardContent className="text-center p-8">
              <Badge className={cn("mb-4", levelColors[currentIdiom.level])}>
                {currentIdiom.level}
              </Badge>
              <h2 className="text-3xl font-bold mb-4">{currentIdiom.english}</h2>
              <p className="text-muted-foreground mb-2">Literal: {currentIdiom.literal}</p>
              <Badge variant="outline" className="mt-4">{currentIdiom.category}</Badge>
              <p className="mt-8 text-sm text-muted-foreground">Cevirmek icin tikla</p>
            </CardContent>
          </Card>

          {/* Back */}
          <Card className="absolute inset-0 flex flex-col items-center justify-center rotate-y-180 backface-hidden bg-gradient-to-br from-red-500/10 to-orange-500/10">
            <CardContent className="text-center p-8">
              <h2 className="text-2xl font-bold mb-4 text-primary">{currentIdiom.turkish}</h2>
              <div className="text-left max-w-sm">
                <p className="text-sm font-medium mb-2">Anlam:</p>
                <p className="text-sm text-muted-foreground mb-4">{currentIdiom.meaning}</p>
                <p className="text-sm font-medium mb-2">Ornek:</p>
                <p className="text-sm text-muted-foreground italic">{currentIdiom.examples[0]}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-6">
        <Button variant="outline" size="icon" onClick={handlePrev}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Button
          variant={isLearned(currentIdiom.id) ? "default" : "outline"}
          onClick={() => onMarkLearned(currentIdiom.id)}
        >
          {isLearned(currentIdiom.id) ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Ogrenildi
            </>
          ) : (
            <>
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Ogrendi Isaretle
            </>
          )}
        </Button>
        <Button variant="outline" size="icon" onClick={handleNext}>
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

// Pattern Card Component
function PatternCard({
  pattern,
  isLearned,
  onMarkLearned,
  levelColor
}: {
  pattern: SentencePattern
  isLearned: boolean
  onMarkLearned: () => void
  levelColor: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className={cn(
      "transition-all hover:shadow-lg hover:shadow-primary/5",
      isLearned && "border-green-500/50 bg-green-500/5"
    )}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <Badge className={levelColor}>{pattern.level}</Badge>
          <Badge variant="outline">{pattern.category}</Badge>
        </div>

        <div className="bg-primary/10 rounded-lg p-3 mb-4">
          <p className="font-mono text-lg text-primary font-semibold">{pattern.pattern}</p>
        </div>
        
        <p className="text-lg mb-3">{pattern.meaning}</p>

        {expanded && (
          <div className="space-y-4 mt-4">
            <div>
              <p className="text-sm font-medium mb-2">Kullanim</p>
              <p className="text-sm text-muted-foreground">{pattern.usage}</p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Ornekler</p>
              <div className="space-y-3">
                {pattern.examples.map((ex, i) => (
                  <div key={i} className="border-l-2 border-primary pl-3">
                    <p className="text-sm">{ex.english}</p>
                    <p className="text-sm text-muted-foreground">{ex.turkish}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Gizle' : 'Detaylar'}
            <ChevronRight className={cn("h-4 w-4 ml-1 transition-transform", expanded && "rotate-90")} />
          </Button>
          <Button
            variant={isLearned ? "default" : "outline"}
            size="sm"
            onClick={onMarkLearned}
          >
            {isLearned ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
