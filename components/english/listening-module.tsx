'use client'

import { useState, useRef, useEffect } from 'react'
import { Headphones, Play, Pause, RotateCcw, Clock, ChevronRight, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Level } from '@/lib/english-types'
import { cn } from '@/lib/utils'

const listeningMaterials = [
  {
    id: '1', title: 'A Day in the Life',
    transcript: `Hello everyone! Today I want to tell you about my typical day.\n\nI usually wake up at 7 o'clock in the morning. First, I take a shower and brush my teeth. Then I have breakfast. I usually eat toast and drink coffee.\n\nI leave home at 8:30. I take the bus to work. It takes about 30 minutes. I work in an office. I answer emails and attend meetings.\n\nI have lunch at 12:30. I usually eat at a nearby restaurant with my colleagues. We talk about work and sometimes about our hobbies.\n\nI finish work at 5 o'clock. Sometimes I go to the gym. I like to exercise for about an hour. Then I go home.\n\nIn the evening, I cook dinner. I watch TV or read a book. I usually go to bed at 11 o'clock.`,
    level: 'A2' as Level, duration: 90,
    questions: [
      { question: 'What time does the speaker wake up?', options: ["6 o'clock", "7 o'clock", "8 o'clock", "9 o'clock"], answer: 1 },
      { question: 'How does the speaker go to work?', options: ['By car', 'By bus', 'On foot', 'By train'], answer: 1 },
      { question: 'What time does the speaker finish work?', options: ["4 o'clock", "5 o'clock", "6 o'clock", "7 o'clock"], answer: 1 }
    ]
  },
  {
    id: '2', title: 'Travel Story: Paris',
    transcript: `Last summer, I went on an amazing trip to Paris, France. It was my first time visiting Europe, and I was very excited.\n\nI stayed in a small hotel near the Eiffel Tower. The view from my window was incredible! Every morning, I could see the tower and watch the sunrise.\n\nOn my first day, I visited the Louvre Museum. It's one of the largest museums in the world. I saw the famous Mona Lisa painting. There were so many tourists taking photos!\n\nThe French food was absolutely delicious. I tried croissants, baguettes, and many different cheeses. My favorite was the chocolate mousse.\n\nI also took a boat tour on the Seine River. It was so romantic! I spent seven days in Paris, but it wasn't enough.`,
    level: 'B1' as Level, duration: 120,
    questions: [
      { question: 'Where did the speaker stay in Paris?', options: ['In a large hotel downtown', 'In a small hotel near the Eiffel Tower', 'In an apartment', 'With friends'], answer: 1 },
      { question: 'What famous painting did the speaker see?', options: ['The Starry Night', 'The Last Supper', 'Mona Lisa', 'The Scream'], answer: 2 },
      { question: 'How long did the speaker stay in Paris?', options: ['Five days', 'Seven days', 'Ten days', 'Two weeks'], answer: 1 }
    ]
  },
  {
    id: '3', title: 'Environmental Challenges',
    transcript: `Climate change is one of the most pressing issues facing our planet today. Scientists worldwide have been studying its effects for decades, and the evidence is overwhelming.\n\nGlobal temperatures have risen by approximately 1.1 degrees Celsius since the pre-industrial era. Arctic ice is melting at an alarming rate, sea levels are rising, and extreme weather events are becoming more frequent.\n\nThe primary cause of climate change is the emission of greenhouse gases, particularly carbon dioxide from burning fossil fuels.\n\nHowever, there are reasons for optimism. Renewable energy sources like solar and wind power are becoming more affordable. The decisions we make today will determine the world we leave for future generations.`,
    level: 'B2' as Level, duration: 150,
    questions: [
      { question: 'By how much have global temperatures risen since the pre-industrial era?', options: ['0.5 degrees', '1.1 degrees', '2 degrees', '3 degrees'], answer: 1 },
      { question: 'What is identified as the primary cause of climate change?', options: ['Natural climate cycles', 'Volcanic activity', 'Emission of greenhouse gases', 'Solar radiation'], answer: 2 },
      { question: 'What does the speaker say about renewable energy?', options: ['It is too expensive', 'It is becoming more affordable and efficient', 'It cannot solve the problem', 'It is not available yet'], answer: 1 }
    ]
  }
]

export function ListeningModule() {
  const [selectedLevel, setSelectedLevel] = useState<Level | 'all'>('all')
  const [activeMaterial, setActiveMaterial] = useState<typeof listeningMaterials[0] | null>(null)

  const filteredMaterials = listeningMaterials.filter(m => selectedLevel === 'all' || m.level === selectedLevel)

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
          <h1 className="text-3xl font-bold text-foreground">Dinleme Pratigi</h1>
          <p className="text-muted-foreground">Dinleme becerilerini gelistir</p>
        </div>
      </div>
      {activeMaterial ? (
        <ListeningDetail material={activeMaterial} onBack={() => setActiveMaterial(null)} levelColor={levelColors[activeMaterial.level]} />
      ) : (
        <>
          <div className="flex items-center gap-4">
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
            <Badge variant="outline">{filteredMaterials.length} kayit</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMaterials.map((material) => (
              <Card key={material.id} className="cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50" onClick={() => setActiveMaterial(material)}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <Badge className={levelColors[material.level]}>{material.level}</Badge>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-4 w-4" />{Math.floor(material.duration / 60)}:{(material.duration % 60).toString().padStart(2, '0')}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Headphones className="h-6 w-6 text-primary" /></div>
                    <h3 className="text-xl font-bold">{material.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{material.transcript.substring(0, 100)}...</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{material.questions.length} soru</span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ListeningDetail({ material, onBack, levelColor }: { material: typeof listeningMaterials[0]; onBack: () => void; levelColor: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showQuiz, setShowQuiz] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [quizComplete, setQuizComplete] = useState(false)

  const speakText = () => {
    if (isPlaying) { speechSynthesis.cancel(); setIsPlaying(false); return }
    const u = new SpeechSynthesisUtterance(material.transcript)
    u.lang = 'en-US'; u.rate = playbackSpeed
    u.onend = () => setIsPlaying(false)
    speechSynthesis.speak(u)
    setIsPlaying(true)
  }

  const stopSpeech = () => { speechSynthesis.cancel(); setIsPlaying(false) }

  useEffect(() => () => { speechSynthesis.cancel() }, [])

  const handleCheckAnswer = () => {
    setShowResult(true)
    if (selectedAnswer === material.questions[currentQuestion].answer) setScore(score + 1)
  }

  const handleNextQuestion = () => {
    if (currentQuestion < material.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1); setSelectedAnswer(null); setShowResult(false)
    } else setQuizComplete(true)
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => { stopSpeech(); onBack() }}><ChevronRight className="h-4 w-4 mr-2 rotate-180" />Geri Don</Button>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={levelColor}>{material.level}</Badge>
        <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" />{Math.floor(material.duration / 60)}:{(material.duration % 60).toString().padStart(2, '0')}</span>
      </div>
      <h1 className="text-3xl font-bold">{material.title}</h1>
      {!showQuiz ? (
        <>
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/20 mb-6"><Headphones className="h-12 w-12 text-primary" /></div>
                <div className="flex items-center gap-4 mb-6">
                  <Button size="lg" onClick={speakText} className="rounded-full h-14 w-14">
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Hiz:</span>
                  <div className="flex gap-2">
                    {[0.75, 1, 1.25, 1.5].map((speed) => (
                      <Button key={speed} variant={playbackSpeed === speed ? 'default' : 'outline'} size="sm" onClick={() => setPlaybackSpeed(speed)}>{speed}x</Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between cursor-pointer" onClick={() => setShowTranscript(!showTranscript)}>
                <span className="flex items-center gap-2">{showTranscript ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}Transcript</span>
                <ChevronRight className={cn('h-5 w-5 transition-transform', showTranscript && 'rotate-90')} />
              </CardTitle>
            </CardHeader>
            {showTranscript && (
              <CardContent>
                <div className="space-y-4">
                  {material.transcript.split('\n\n').map((p, i) => <p key={i} className="text-foreground leading-relaxed">{p}</p>)}
                </div>
              </CardContent>
            )}
          </Card>
          <Button onClick={() => { stopSpeech(); setShowQuiz(true) }} className="w-full">Anlama Testine Basla<ChevronRight className="h-4 w-4 ml-2" /></Button>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {!quizComplete ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm text-muted-foreground">Soru {currentQuestion + 1} / {material.questions.length}</span>
                  <Progress value={((currentQuestion + 1) / material.questions.length) * 100} className="w-32 h-2" />
                </div>
                <h3 className="text-xl font-semibold mb-6">{material.questions[currentQuestion].question}</h3>
                <div className="space-y-3">
                  {material.questions[currentQuestion].options.map((option, i) => (
                    <Button key={i} variant="outline" className={cn('w-full justify-start h-auto py-4 px-4 text-left', selectedAnswer === i && !showResult && 'border-primary bg-primary/10', showResult && i === material.questions[currentQuestion].answer && 'bg-green-500/20 border-green-500', showResult && selectedAnswer === i && i !== material.questions[currentQuestion].answer && 'bg-red-500/20 border-red-500')} onClick={() => !showResult && setSelectedAnswer(i)} disabled={showResult}>
                      {option}
                      {showResult && i === material.questions[currentQuestion].answer && <CheckCircle2 className="h-5 w-5 ml-auto text-green-500" />}
                      {showResult && selectedAnswer === i && i !== material.questions[currentQuestion].answer && <XCircle className="h-5 w-5 ml-auto text-red-500" />}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2 mt-6">
                  {!showResult ? (
                    <Button onClick={handleCheckAnswer} disabled={selectedAnswer === null} className="flex-1">Kontrol Et</Button>
                  ) : (
                    <Button onClick={handleNextQuestion} className="flex-1">{currentQuestion < material.questions.length - 1 ? 'Sonraki Soru' : 'Sonuclari Gor'}<ChevronRight className="h-4 w-4 ml-2" /></Button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Test Tamamlandi!</h2>
                <div className="text-5xl font-bold mb-4">{Math.round((score / material.questions.length) * 100)}%</div>
                <Progress value={(score / material.questions.length) * 100} className="h-3 mb-6" />
                <div className="flex justify-center gap-6 mb-6">
                  <div className="text-center"><div className="text-2xl font-bold text-green-500">{score}</div><div className="text-sm text-muted-foreground">Dogru</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-red-500">{material.questions.length - score}</div><div className="text-sm text-muted-foreground">Yanlis</div></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowQuiz(false)} className="flex-1">Dinlemeye Don</Button>
                  <Button onClick={() => { setCurrentQuestion(0); setSelectedAnswer(null); setShowResult(false); setScore(0); setQuizComplete(false) }} className="flex-1"><RotateCcw className="h-4 w-4 mr-2" />Tekrar Dene</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
