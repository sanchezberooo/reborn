'use client'

import { useState } from 'react'
import { 
  Search, 
  Volume2, 
  BookmarkPlus, 
  Check, 
  X, 
  ChevronRight,
  Filter,
  RotateCcw,
  Lightbulb,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { sampleWords, wordCategories } from '../lib/data'
import type { Word, Level } from '../lib/types'
import { cn } from '@/lib/utils'

type ViewMode = 'list' | 'flashcard' | 'learn'

export function VocabularyModule() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<Level | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set())

  const filteredWords = sampleWords.filter(word => {
    const matchesSearch = word.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          word.turkish.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLevel = selectedLevel === 'all' || word.level === selectedLevel
    const matchesCategory = selectedCategory === 'all' || word.category === selectedCategory
    return matchesSearch && matchesLevel && matchesCategory
  })

  const handleNextCard = () => {
    setIsFlipped(false)
    setCurrentCardIndex((prev) => (prev + 1) % filteredWords.length)
  }

  const handlePrevCard = () => {
    setIsFlipped(false)
    setCurrentCardIndex((prev) => (prev - 1 + filteredWords.length) % filteredWords.length)
  }

  const handleMarkLearned = (wordId: string) => {
    setLearnedWords(prev => {
      const newSet = new Set(prev)
      if (newSet.has(wordId)) {
        newSet.delete(wordId)
      } else {
        newSet.add(wordId)
      }
      return newSet
    })
  }

  const speakWord = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    speechSynthesis.speak(utterance)
  }

  const levelColors: Record<Level, string> = {
    'A1': 'bg-green-500/20 text-green-400 border-green-500/30',
    'A2': 'bg-lime-500/20 text-lime-400 border-lime-500/30',
    'B1': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'B2': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'C1': 'bg-red-500/20 text-red-400 border-red-500/30',
    'C2': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kelime Bankasi</h1>
          <p className="text-muted-foreground">Kelime dagarcigini gelistir</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {filteredWords.length} kelime
          </Badge>
          <Badge variant="outline" className="text-sm bg-green-500/20 text-green-400">
            {learnedWords.size} ogrenildi
          </Badge>
        </div>
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="flashcard">Flashcard</TabsTrigger>
          <TabsTrigger value="learn">Ogren</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Kelime ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedLevel} onValueChange={(v) => setSelectedLevel(v as Level | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Seviye" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Seviyeler</SelectItem>
              <SelectItem value="A1">A1 - Baslangic</SelectItem>
              <SelectItem value="A2">A2 - Temel</SelectItem>
              <SelectItem value="B1">B1 - Orta</SelectItem>
              <SelectItem value="B2">B2 - Orta Üstü</SelectItem>
              <SelectItem value="C1">C1 - Ileri</SelectItem>
              <SelectItem value="C2">C2 - Uzman</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Kategoriler</SelectItem>
              {wordCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List View */}
        <TabsContent value="list" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWords.map((word) => (
              <WordCard 
                key={word.id} 
                word={word} 
                isLearned={learnedWords.has(word.id)}
                onMarkLearned={() => handleMarkLearned(word.id)}
                onSpeak={() => speakWord(word.english)}
                levelColor={levelColors[word.level]}
              />
            ))}
          </div>
        </TabsContent>

        {/* Flashcard View */}
        <TabsContent value="flashcard" className="mt-6">
          {filteredWords.length > 0 ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 text-sm text-muted-foreground">
                {currentCardIndex + 1} / {filteredWords.length}
              </div>
              
              <div 
                className="relative w-full max-w-lg h-80 cursor-pointer perspective-1000"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div className={cn(
                  "absolute inset-0 transition-transform duration-500 transform-style-preserve-3d",
                  isFlipped && "rotate-y-180"
                )}>
                  {/* Front */}
                  <Card className="absolute inset-0 flex flex-col items-center justify-center backface-hidden bg-gradient-to-br from-primary/10 to-accent/10">
                    <CardContent className="text-center">
                      <Badge className={cn("mb-4", levelColors[filteredWords[currentCardIndex].level])}>
                        {filteredWords[currentCardIndex].level}
                      </Badge>
                      <h2 className="text-4xl font-bold mb-2">{filteredWords[currentCardIndex].english}</h2>
                      <p className="text-lg text-muted-foreground">{filteredWords[currentCardIndex].pronunciation}</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-4"
                        onClick={(e) => {
                          e.stopPropagation()
                          speakWord(filteredWords[currentCardIndex].english)
                        }}
                      >
                        <Volume2 className="h-5 w-5 mr-2" />
                        Dinle
                      </Button>
                      <p className="mt-6 text-sm text-muted-foreground">Cevirmek icin tikla</p>
                    </CardContent>
                  </Card>
                  
                  {/* Back */}
                  <Card className="absolute inset-0 flex flex-col items-center justify-center rotate-y-180 backface-hidden bg-gradient-to-br from-accent/10 to-primary/10">
                    <CardContent className="text-center">
                      <Badge className="mb-4" variant="outline">
                        {filteredWords[currentCardIndex].partOfSpeech}
                      </Badge>
                      <h2 className="text-3xl font-bold mb-4">{filteredWords[currentCardIndex].turkish}</h2>
                      <div className="text-left max-w-sm">
                        <p className="text-sm font-medium mb-2">Ornekler:</p>
                        <ul className="space-y-1">
                          {filteredWords[currentCardIndex].examples.slice(0, 2).map((ex, i) => (
                            <li key={i} className="text-sm text-muted-foreground">• {ex}</li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-6">
                <Button variant="outline" size="icon" onClick={handlePrevCard}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Button 
                  variant={learnedWords.has(filteredWords[currentCardIndex].id) ? "default" : "outline"}
                  onClick={() => handleMarkLearned(filteredWords[currentCardIndex].id)}
                >
                  {learnedWords.has(filteredWords[currentCardIndex].id) ? (
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
                <Button variant="outline" size="icon" onClick={handleNextCard}>
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Filtreye uygun kelime bulunamadi</p>
            </div>
          )}
        </TabsContent>

        {/* Learn Mode */}
        <TabsContent value="learn" className="mt-6">
          <LearnMode 
            words={filteredWords} 
            onComplete={(results) => {
              results.correct.forEach(id => {
                setLearnedWords(prev => new Set([...prev, id]))
              })
            }}
          />
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

// Word Card Component
function WordCard({ 
  word, 
  isLearned, 
  onMarkLearned, 
  onSpeak,
  levelColor 
}: { 
  word: Word
  isLearned: boolean
  onMarkLearned: () => void
  onSpeak: () => void
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
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold">{word.english}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSpeak}>
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{word.pronunciation}</p>
          </div>
          <Badge className={levelColor}>{word.level}</Badge>
        </div>
        
        <p className="text-lg mb-2">{word.turkish}</p>
        <Badge variant="outline" className="text-xs">{word.partOfSpeech}</Badge>

        {expanded && (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Ornekler:</p>
              <ul className="space-y-1">
                {word.examples.map((ex, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {ex}</li>
                ))}
              </ul>
            </div>
            {word.synonyms && word.synonyms.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Es anlamlilar:</p>
                <div className="flex flex-wrap gap-1">
                  {word.synonyms.map((syn, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{syn}</Badge>
                  ))}
                </div>
              </div>
            )}
            {word.antonyms && word.antonyms.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Zit anlamlilar:</p>
                <div className="flex flex-wrap gap-1">
                  {word.antonyms.map((ant, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{ant}</Badge>
                  ))}
                </div>
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

// Learn Mode Component
function LearnMode({ 
  words, 
  onComplete 
}: { 
  words: Word[]
  onComplete: (results: { correct: string[], incorrect: string[] }) => void
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [results, setResults] = useState<{ correct: string[], incorrect: string[] }>({ correct: [], incorrect: [] })
  const [showResults, setShowResults] = useState(false)

  if (words.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Filtreye uygun kelime bulunamadi</p>
      </div>
    )
  }

  const currentWord = words[currentIndex]
  
  // Generate options including the correct answer and 3 random wrong answers
  const generateOptions = () => {
    const correctAnswer = currentWord.turkish
    const wrongAnswers = words
      .filter(w => w.id !== currentWord.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => w.turkish)
    
    return [...wrongAnswers, correctAnswer].sort(() => Math.random() - 0.5)
  }

  const [options] = useState(generateOptions)

  const handleAnswer = (answer: string) => {
    if (selectedAnswer) return
    
    setSelectedAnswer(answer)
    const correct = answer === currentWord.turkish
    setIsCorrect(correct)

    if (correct) {
      setResults(prev => ({ ...prev, correct: [...prev.correct, currentWord.id] }))
    } else {
      setResults(prev => ({ ...prev, incorrect: [...prev.incorrect, currentWord.id] }))
    }
  }

  const handleNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedAnswer(null)
      setIsCorrect(null)
    } else {
      setShowResults(true)
      onComplete(results)
    }
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setResults({ correct: [], incorrect: [] })
    setShowResults(false)
  }

  if (showResults) {
    const score = (results.correct.length / words.length) * 100
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Sonuclar</h2>
          <div className="mb-6">
            <div className="text-5xl font-bold mb-2">{Math.round(score)}%</div>
            <Progress value={score} className="h-3 mb-4" />
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{results.correct.length}</div>
                <div className="text-sm text-muted-foreground">Dogru</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{results.incorrect.length}</div>
                <div className="text-sm text-muted-foreground">Yanlis</div>
              </div>
            </div>
          </div>
          <Button onClick={handleRestart}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Tekrar Calis
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Soru {currentIndex + 1} / {words.length}
        </span>
        <Progress value={((currentIndex + 1) / words.length) * 100} className="w-32 h-2" />
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 text-center">
          <Badge className="mb-4" variant="outline">{currentWord.level}</Badge>
          <h2 className="text-3xl font-bold mb-2">{currentWord.english}</h2>
          <p className="text-muted-foreground">{currentWord.pronunciation}</p>
          <p className="mt-2 text-sm text-muted-foreground italic">
            {currentWord.examples[0]}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-medium text-center mb-4">Dogru anlami secin:</p>
        {options.map((option, index) => (
          <Button
            key={index}
            variant="outline"
            className={cn(
              "w-full justify-start text-left h-auto py-4 px-4",
              selectedAnswer === option && isCorrect && "bg-green-500/20 border-green-500",
              selectedAnswer === option && !isCorrect && "bg-red-500/20 border-red-500",
              selectedAnswer && option === currentWord.turkish && "bg-green-500/20 border-green-500"
            )}
            onClick={() => handleAnswer(option)}
            disabled={!!selectedAnswer}
          >
            {option}
            {selectedAnswer === option && isCorrect && <Check className="h-5 w-5 ml-auto text-green-500" />}
            {selectedAnswer === option && !isCorrect && <X className="h-5 w-5 ml-auto text-red-500" />}
            {selectedAnswer && option === currentWord.turkish && selectedAnswer !== option && (
              <Check className="h-5 w-5 ml-auto text-green-500" />
            )}
          </Button>
        ))}
      </div>

      {selectedAnswer && (
        <div className="mt-6 text-center">
          <div className={cn(
            "mb-4 p-4 rounded-lg",
            isCorrect ? "bg-green-500/20" : "bg-red-500/20"
          )}>
            {isCorrect ? (
              <p className="text-green-400 font-medium">Dogru! Harika gidiyorsun.</p>
            ) : (
              <p className="text-red-400 font-medium">
                Yanlis. Dogru cevap: <span className="font-bold">{currentWord.turkish}</span>
              </p>
            )}
          </div>
          <Button onClick={handleNext}>
            {currentIndex < words.length - 1 ? 'Sonraki Soru' : 'Sonuclari Gor'}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}
