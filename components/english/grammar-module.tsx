'use client'

import { useState } from 'react'
import { ChevronRight, Check, X, Lightbulb, AlertTriangle, BookOpen, Target, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { sampleGrammarRules, grammarCategories } from '@/lib/english-data'
import type { GrammarRule, Level } from '@/lib/english-types'
import { cn } from '@/lib/utils'

export function GrammarModule() {
  const [selectedLevel, setSelectedLevel] = useState<Level | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeRule, setActiveRule] = useState<GrammarRule | null>(null)
  const [viewMode, setViewMode] = useState<'rules' | 'practice'>('rules')

  const filteredRules = sampleGrammarRules.filter(rule => {
    const matchesLevel = selectedLevel === 'all' || rule.level === selectedLevel
    const matchesCategory = selectedCategory === 'all' || rule.category === selectedCategory
    return matchesLevel && matchesCategory
  })

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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gramer Kurallari</h1>
          <p className="text-muted-foreground">Ingilizce gramer yapilarini ogren</p>
        </div>
        <Badge variant="outline" className="text-sm">{filteredRules.length} kural</Badge>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'rules' | 'practice')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="rules">Kurallar</TabsTrigger>
          <TabsTrigger value="practice">Pratik</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
          <Select value={selectedLevel} onValueChange={(v) => setSelectedLevel(v as Level | 'all')}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Seviye" /></SelectTrigger>
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
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum Kategoriler</SelectItem>
              {grammarCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="rules" className="mt-6">
          {activeRule ? (
            <GrammarRuleDetail rule={activeRule} onBack={() => setActiveRule(null)} levelColor={levelColors[activeRule.level]} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredRules.map((rule) => (
                <Card key={rule.id} className="cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50" onClick={() => setActiveRule(rule)}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge className={levelColors[rule.level]}>{rule.level}</Badge>
                      <Badge variant="outline">{rule.category}</Badge>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{rule.title}</h3>
                    <p className="text-muted-foreground mb-3">{rule.titleTr}</p>
                    <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                      <p className="font-mono text-sm text-primary">{rule.formula}</p>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{rule.explanationTr}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-muted-foreground">{rule.examples.length} ornek, {rule.exercises.length} egzersiz</span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="practice" className="mt-6">
          <GrammarPractice rules={filteredRules} levelColors={levelColors} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GrammarRuleDetail({ rule, onBack, levelColor }: { rule: GrammarRule; onBack: () => void; levelColor: string }) {
  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-4"><ChevronRight className="h-4 w-4 mr-2 rotate-180" />Geri Don</Button>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge className={levelColor}>{rule.level}</Badge>
        <Badge variant="outline">{rule.category}</Badge>
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-2">{rule.title}</h1>
        <p className="text-xl text-muted-foreground">{rule.titleTr}</p>
      </div>
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3"><Target className="h-5 w-5 text-primary" /><span className="font-semibold">Formul</span></div>
          <p className="font-mono text-lg text-primary">{rule.formula}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Aciklama</CardTitle></CardHeader>
        <CardContent>
          <p className="text-foreground mb-4">{rule.explanation}</p>
          <p className="text-muted-foreground">{rule.explanationTr}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" />Ornekler</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rule.examples.map((example, i) => (
              <div key={i} className="border-l-2 border-primary pl-4">
                <p className="text-lg">
                  {example.highlight ? (
                    <>{example.english.split(example.highlight)[0]}<span className="bg-primary/30 px-1 rounded font-semibold">{example.highlight}</span>{example.english.split(example.highlight)[1]}</>
                  ) : example.english}
                </p>
                <p className="text-muted-foreground">{example.turkish}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {rule.commonMistakes && rule.commonMistakes.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Sik Yapilan Hatalar</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rule.commonMistakes.map((mistake, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2"><X className="h-4 w-4 text-destructive" /><span className="line-through text-destructive">{mistake.wrong}</span></div>
                  <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /><span className="text-green-400">{mistake.correct}</span></div>
                  <p className="text-sm text-muted-foreground pl-6">{mistake.explanation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Egzersizler</CardTitle></CardHeader>
        <CardContent><GrammarExercises exercises={rule.exercises} /></CardContent>
      </Card>
    </div>
  )
}

function GrammarExercises({ exercises }: { exercises: GrammarRule['exercises'] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  if (exercises.length === 0) return <p className="text-muted-foreground">Bu kural icin egzersiz bulunmuyor.</p>

  const currentExercise = exercises[currentIndex]

  const checkAnswer = () => {
    const correct = currentExercise.type === 'multiple-choice'
      ? selectedOption === currentExercise.answer
      : userAnswer.toLowerCase().trim() === currentExercise.answer.toLowerCase().trim()
    setIsCorrect(correct)
    setShowResult(true)
  }

  const nextExercise = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setUserAnswer('')
      setSelectedOption(null)
      setShowResult(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">Egzersiz {currentIndex + 1} / {exercises.length}</span>
        <Progress value={((currentIndex + 1) / exercises.length) * 100} className="w-32 h-2" />
      </div>
      <div className="bg-secondary/30 rounded-lg p-4">
        <p className="text-lg mb-4">{currentExercise.question}</p>
        {currentExercise.type === 'multiple-choice' && currentExercise.options && (
          <div className="space-y-2">
            {currentExercise.options.map((option, i) => (
              <Button key={i} variant="outline" className={cn('w-full justify-start', selectedOption === option && !showResult && 'border-primary', showResult && option === currentExercise.answer && 'bg-green-500/20 border-green-500', showResult && selectedOption === option && option !== currentExercise.answer && 'bg-red-500/20 border-red-500')} onClick={() => !showResult && setSelectedOption(option)} disabled={showResult}>{option}</Button>
            ))}
          </div>
        )}
        {(currentExercise.type === 'fill-blank' || currentExercise.type === 'transform') && (
          <Input value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder="Cevabinizi yazin..." disabled={showResult} className={cn(showResult && isCorrect && 'border-green-500 bg-green-500/10', showResult && !isCorrect && 'border-red-500 bg-red-500/10')} />
        )}
      </div>
      {showResult && (
        <div className={cn('p-4 rounded-lg', isCorrect ? 'bg-green-500/20' : 'bg-red-500/20')}>
          {isCorrect ? <p className="text-green-400 font-medium flex items-center gap-2"><Check className="h-5 w-5" />Dogru!</p> : (
            <div>
              <p className="text-red-400 font-medium flex items-center gap-2 mb-2"><X className="h-5 w-5" />Yanlis</p>
              <p className="text-sm">Dogru cevap: <span className="font-semibold text-green-400">{currentExercise.answer}</span></p>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-2">{currentExercise.explanation}</p>
        </div>
      )}
      <div className="flex gap-2">
        {!showResult ? (
          <Button onClick={checkAnswer} disabled={!userAnswer && !selectedOption} className="flex-1">Kontrol Et</Button>
        ) : currentIndex < exercises.length - 1 ? (
          <Button onClick={nextExercise} className="flex-1">Sonraki<ChevronRight className="h-4 w-4 ml-2" /></Button>
        ) : (
          <Button onClick={() => { setCurrentIndex(0); setUserAnswer(''); setSelectedOption(null); setShowResult(false) }} className="flex-1"><RotateCcw className="h-4 w-4 mr-2" />Tekrar Calis</Button>
        )}
      </div>
    </div>
  )
}

function GrammarPractice({ rules, levelColors }: { rules: GrammarRule[]; levelColors: Record<Level, string> }) {
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const allExercises = rules.flatMap((rule) => rule.exercises.map(ex => ({ ...ex, ruleTitle: rule.title, ruleLevel: rule.level })))

  if (allExercises.length === 0) return <div className="text-center py-12"><p className="text-muted-foreground">Secili filtrelere uygun egzersiz bulunamadi</p></div>

  const totalExercises = allExercises.length

  if (currentExerciseIndex >= totalExercises) {
    const pct = Math.round((score.correct / score.total) * 100)
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Pratik Tamamlandi!</h2>
          <div className="text-5xl font-bold mb-4">{pct}%</div>
          <Progress value={pct} className="h-3 mb-4" />
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center"><div className="text-2xl font-bold text-green-500">{score.correct}</div><div className="text-sm text-muted-foreground">Dogru</div></div>
            <div className="text-center"><div className="text-2xl font-bold text-red-500">{score.total - score.correct}</div><div className="text-sm text-muted-foreground">Yanlis</div></div>
          </div>
          <Button onClick={() => { setCurrentExerciseIndex(0); setUserAnswer(''); setSelectedOption(null); setShowResult(false); setScore({ correct: 0, total: 0 }) }}><RotateCcw className="h-4 w-4 mr-2" />Tekrar Calis</Button>
        </CardContent>
      </Card>
    )
  }

  const currentExercise = allExercises[currentExerciseIndex]

  const checkAnswer = () => {
    const correct = currentExercise.type === 'multiple-choice'
      ? selectedOption === currentExercise.answer
      : userAnswer.toLowerCase().trim() === currentExercise.answer.toLowerCase().trim()
    setIsCorrect(correct)
    setShowResult(true)
    setScore(prev => ({ correct: correct ? prev.correct + 1 : prev.correct, total: prev.total + 1 }))
  }

  const nextExercise = () => {
    setCurrentExerciseIndex(currentExerciseIndex + 1)
    setUserAnswer('')
    setSelectedOption(null)
    setShowResult(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge className={levelColors[currentExercise.ruleLevel as Level]}>{currentExercise.ruleLevel}</Badge>
          <span className="text-sm text-muted-foreground">{currentExercise.ruleTitle}</span>
        </div>
        <span className="text-sm text-muted-foreground">{currentExerciseIndex + 1} / {totalExercises}</span>
      </div>
      <Progress value={((currentExerciseIndex + 1) / totalExercises) * 100} className="h-2 mb-6" />
      <Card>
        <CardContent className="pt-6">
          <p className="text-lg mb-6">{currentExercise.question}</p>
          {currentExercise.type === 'multiple-choice' && currentExercise.options && (
            <div className="space-y-3">
              {currentExercise.options.map((option, i) => (
                <Button key={i} variant="outline" className={cn('w-full justify-start h-auto py-3 px-4', selectedOption === option && !showResult && 'border-primary bg-primary/10', showResult && option === currentExercise.answer && 'bg-green-500/20 border-green-500', showResult && selectedOption === option && option !== currentExercise.answer && 'bg-red-500/20 border-red-500')} onClick={() => !showResult && setSelectedOption(option)} disabled={showResult}>{option}</Button>
              ))}
            </div>
          )}
          {(currentExercise.type === 'fill-blank' || currentExercise.type === 'transform') && (
            <Input value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder="Cevabinizi yazin..." disabled={showResult} className={cn('text-lg py-6', showResult && isCorrect && 'border-green-500 bg-green-500/10', showResult && !isCorrect && 'border-red-500 bg-red-500/10')} onKeyDown={(e) => { if (e.key === 'Enter' && !showResult && userAnswer) checkAnswer() }} />
          )}
          {showResult && (
            <div className={cn('mt-6 p-4 rounded-lg', isCorrect ? 'bg-green-500/20' : 'bg-red-500/20')}>
              {isCorrect ? <p className="text-green-400 font-medium flex items-center gap-2"><Check className="h-5 w-5" />Mukemmel!</p> : (
                <div><p className="text-red-400 font-medium flex items-center gap-2 mb-2"><X className="h-5 w-5" />Yanlis cevap</p><p className="text-sm">Dogru cevap: <span className="font-semibold text-green-400">{currentExercise.answer}</span></p></div>
              )}
              <p className="text-sm text-muted-foreground mt-2">{currentExercise.explanation}</p>
            </div>
          )}
          <div className="flex gap-2 mt-6">
            {!showResult ? (
              <Button onClick={checkAnswer} disabled={!userAnswer && !selectedOption} className="flex-1">Kontrol Et</Button>
            ) : (
              <Button onClick={nextExercise} className="flex-1">{currentExerciseIndex < totalExercises - 1 ? 'Sonraki Soru' : 'Sonuclari Gor'}<ChevronRight className="h-4 w-4 ml-2" /></Button>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 text-center"><span className="text-sm text-muted-foreground">Skor: {score.correct} / {score.total}</span></div>
    </div>
  )
}
