'use client'

import { useState } from 'react'
import { PenTool, ChevronRight, Lightbulb, Target, FileText, Mail, BookOpen, Image, FileEdit, Check, AlertCircle, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Level, WritingExercise } from '@/lib/english-types'
import { cn } from '@/lib/utils'

const writingExercises: WritingExercise[] = [
  {
    id: '1', type: 'email',
    prompt: 'Write an email to your friend telling them about your recent vacation. Include where you went, what you did, and what you enjoyed most.',
    promptTr: 'Arkadasina son tatilin hakkinda bir e-posta yaz. Nereye gittigini, ne yaptigini ve en cok neyi begendignizi anlat.',
    level: 'A2', wordLimit: { min: 80, max: 120 },
    tips: ['Start with a greeting (Dear, Hi, Hello)', 'Use past tense for describing what happened', 'Include specific details about places and activities', 'End with a question to keep the conversation going'],
    criteria: ['Appropriate greeting and closing', 'Clear organization', 'Use of past tense', 'Vocabulary variety'],
    sampleAnswer: `Hi Sarah,\n\nI hope you're doing well! I wanted to tell you about my amazing vacation last week.\n\nI went to Antalya with my family. We stayed at a beautiful hotel near the beach. Every morning, we swam in the sea and relaxed under the sun.\n\nMy favorite part was visiting the old town. The narrow streets and historic buildings were fascinating. We also tried delicious local food!\n\nI took so many photos! I'll show you when we meet. How was your week?\n\nTalk soon,\n[Your name]`
  },
  {
    id: '2', type: 'essay',
    prompt: 'Write a short essay about the advantages and disadvantages of social media. Give examples from your own experience or observations.',
    promptTr: 'Sosyal medyanin avantajlari ve dezavantajlari hakkinda kisa bir makale yaz.',
    level: 'B1', wordLimit: { min: 150, max: 200 },
    tips: ['Include an introduction, body paragraphs, and conclusion', 'Present both advantages and disadvantages fairly', 'Use linking words (However, Moreover, On the other hand)', 'Support your points with examples'],
    criteria: ['Clear structure', 'Balanced argument', 'Use of connectors', 'Personal examples']
  },
  {
    id: '3', type: 'description',
    prompt: 'Describe your ideal home. Include details about its location, size, rooms, and any special features you would want it to have.',
    promptTr: 'Hayalindeki evi anlat. Konumu, boyutu, odalari ve ozel ozellikleri hakkinda detaylar ver.',
    level: 'B1', wordLimit: { min: 120, max: 180 },
    tips: ['Use descriptive adjectives (spacious, cozy, modern)', 'Organize by room or feature', 'Include sensory details', 'Explain why certain features are important to you'],
    criteria: ['Vivid descriptions', 'Logical organization', 'Use of adjectives', 'Personal touches']
  },
  {
    id: '4', type: 'story',
    prompt: 'Write a short story that begins with: "The moment I opened the old box, everything changed..."',
    promptTr: 'Su cumleyle baslayan kisa bir hikaye yaz: "Eski kutuyu actigim an, her sey degisti..."',
    level: 'B2', wordLimit: { min: 200, max: 300 },
    tips: ['Create an interesting plot with a clear beginning, middle, and end', 'Develop at least one character', 'Use dialogue to make the story more engaging', 'Include descriptive language to set the scene'],
    criteria: ['Story structure', 'Character development', 'Use of dialogue', 'Creative plot']
  },
  {
    id: '5', type: 'summary',
    prompt: 'Read the following paragraph and write a summary in your own words: "Climate change is causing significant changes to our planet. Rising temperatures are melting polar ice caps, leading to higher sea levels. Extreme weather events like hurricanes, droughts, and floods are becoming more frequent. Scientists warn that without immediate action, these effects will worsen over the coming decades."',
    promptTr: 'Asagidaki paragrafi oku ve kendi kelimelernle bir ozet yaz.',
    level: 'B2', wordLimit: { min: 40, max: 60 },
    tips: ["Identify the main idea", "Use your own words - don't copy directly", 'Include only the most important points', 'Be concise'],
    criteria: ['Main idea captured', 'Paraphrasing', 'Conciseness', 'Accuracy']
  }
]

const typeIcons: Record<WritingExercise['type'], React.ComponentType<{ className?: string }>> = {
  essay: FileText, email: Mail, story: BookOpen, description: Image, summary: FileEdit
}

const typeLabels: Record<WritingExercise['type'], string> = {
  essay: 'Makale', email: 'E-posta', story: 'Hikaye', description: 'Betimleme', summary: 'Ozet'
}

export function WritingModule() {
  const [selectedLevel, setSelectedLevel] = useState<Level | 'all'>('all')
  const [selectedType, setSelectedType] = useState<WritingExercise['type'] | 'all'>('all')
  const [activeExercise, setActiveExercise] = useState<WritingExercise | null>(null)

  const filteredExercises = writingExercises.filter(e => {
    const matchesLevel = selectedLevel === 'all' || e.level === selectedLevel
    const matchesType = selectedType === 'all' || e.type === selectedType
    return matchesLevel && matchesType
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
          <h1 className="text-3xl font-bold text-foreground">Yazma Pratigi</h1>
          <p className="text-muted-foreground">Yazma becerilerini gelistir</p>
        </div>
      </div>
      {activeExercise ? (
        <WritingExerciseDetail exercise={activeExercise} onBack={() => setActiveExercise(null)} levelColor={levelColors[activeExercise.level]} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
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
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as WritingExercise['type'] | 'all')}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Turler</SelectItem>
                <SelectItem value="email">E-posta</SelectItem>
                <SelectItem value="essay">Makale</SelectItem>
                <SelectItem value="description">Betimleme</SelectItem>
                <SelectItem value="story">Hikaye</SelectItem>
                <SelectItem value="summary">Ozet</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{filteredExercises.length} egzersiz</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {filteredExercises.map((exercise) => {
              const TypeIcon = typeIcons[exercise.type]
              return (
                <Card key={exercise.id} className="cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50" onClick={() => setActiveExercise(exercise)}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge className={levelColors[exercise.level]}>{exercise.level}</Badge>
                      <Badge variant="outline" className="flex items-center gap-1"><TypeIcon className="h-3 w-3" />{typeLabels[exercise.type]}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20"><PenTool className="h-6 w-6 text-primary" /></div>
                      <div><h3 className="font-semibold">{typeLabels[exercise.type]}</h3><p className="text-sm text-muted-foreground">{exercise.wordLimit.min}-{exercise.wordLimit.max} kelime</p></div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{exercise.promptTr}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{exercise.tips.length} ipucu</span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function WritingExerciseDetail({ exercise, onBack, levelColor }: { exercise: WritingExercise; onBack: () => void; levelColor: string }) {
  const [userText, setUserText] = useState('')
  const [showTips, setShowTips] = useState(false)
  const [showSample, setShowSample] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const wordCount = userText.trim().split(/\s+/).filter(Boolean).length
  const isWithinLimit = wordCount >= exercise.wordLimit.min && wordCount <= exercise.wordLimit.max
  const TypeIcon = typeIcons[exercise.type]

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}><ChevronRight className="h-4 w-4 mr-2 rotate-180" />Geri Don</Button>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={levelColor}>{exercise.level}</Badge>
        <Badge variant="outline" className="flex items-center gap-1"><TypeIcon className="h-3 w-3" />{typeLabels[exercise.type]}</Badge>
        <span className="text-sm text-muted-foreground">{exercise.wordLimit.min}-{exercise.wordLimit.max} kelime</span>
      </div>
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3"><Target className="h-5 w-5 text-primary" /><span className="font-semibold">Gorev</span></div>
          <p className="text-foreground mb-3">{exercise.prompt}</p>
          <p className="text-muted-foreground text-sm">{exercise.promptTr}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between cursor-pointer" onClick={() => setShowTips(!showTips)}>
            <span className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-yellow-500" />Ipuclari</span>
            <ChevronRight className={cn('h-5 w-5 transition-transform', showTips && 'rotate-90')} />
          </CardTitle>
        </CardHeader>
        {showTips && <CardContent><ul className="space-y-2">{exercise.tips.map((tip, i) => <li key={i} className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /><span>{tip}</span></li>)}</ul></CardContent>}
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><PenTool className="h-5 w-5" />Yazini Yaz</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={userText} onChange={(e) => setUserText(e.target.value)} placeholder="Buraya yazmaya basla..." className="min-h-[300px] text-base leading-relaxed" disabled={submitted} />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <span className={cn('text-sm', isWithinLimit ? 'text-green-500' : 'text-muted-foreground')}>{wordCount} kelime</span>
              {wordCount > 0 && !isWithinLimit && (
                <span className="text-sm text-orange-500 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {wordCount < exercise.wordLimit.min ? `En az ${exercise.wordLimit.min - wordCount} kelime daha` : `${wordCount - exercise.wordLimit.max} kelime fazla`}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">Hedef: {exercise.wordLimit.min}-{exercise.wordLimit.max}</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Degerlendirme Kriterleri</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {exercise.criteria.map((criterion, i) => <div key={i} className="flex items-center gap-2 text-sm"><div className="h-2 w-2 rounded-full bg-primary" />{criterion}</div>)}
          </div>
        </CardContent>
      </Card>
      {!submitted ? (
        <Button onClick={() => setSubmitted(true)} disabled={wordCount < exercise.wordLimit.min} className="w-full"><Sparkles className="h-4 w-4 mr-2" />Gonder ve Degerlendir</Button>
      ) : (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4"><Check className="h-5 w-5 text-green-500" /><span className="font-semibold text-green-400">Yazin Gonderildi!</span></div>
            <p className="text-muted-foreground mb-4">Yazini basariyla gonderdin. Kriterleri kontrol ederek kendi degerlendirmeni yapabilirsin.</p>
            {exercise.sampleAnswer && (
              <Button variant="outline" onClick={() => setShowSample(!showSample)} className="w-full">{showSample ? 'Ornek Cevabi Gizle' : 'Ornek Cevabi Gor'}</Button>
            )}
          </CardContent>
        </Card>
      )}
      {showSample && exercise.sampleAnswer && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Ornek Cevap</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {exercise.sampleAnswer.split('\n\n').map((p, i) => <p key={i} className="text-foreground leading-relaxed whitespace-pre-wrap">{p}</p>)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
