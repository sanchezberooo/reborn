'use client'

import { useState } from 'react'
import { 
  BookText, 
  Clock, 
  CheckCircle2,
  XCircle,
  ChevronRight,
  Eye,
  Volume2,
  Bookmark,
  RotateCcw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Level, ReadingMaterial } from '../lib/types'
import { cn } from '@/lib/utils'

// Sample reading materials
const readingMaterials: ReadingMaterial[] = [
  {
    id: '1',
    title: 'The Power of Daily Habits',
    content: `Every day, we make countless decisions that shape our lives. From the moment we wake up to the time we go to sleep, our habits guide us through the day. But what makes some habits stick while others fade away?

Research shows that successful people share common habits. They wake up early, exercise regularly, and set clear goals. They read books, learn new skills, and take care of their health. Most importantly, they stay consistent.

Building good habits takes time and patience. Experts suggest starting small. Instead of trying to change everything at once, focus on one habit at a time. Make it easy to do the right thing. Put your running shoes by the door. Keep healthy snacks visible. Remove distractions from your workspace.

The key is to make your desired behavior the path of least resistance. When good habits become automatic, you free up mental energy for more important decisions. Your daily routines become the foundation for success.

Remember, you don't have to be perfect. Missing one day won't ruin your progress. What matters is getting back on track. The most successful people aren't those who never fail—they're the ones who never give up.`,
    level: 'B1',
    category: 'Self-Improvement',
    wordCount: 195,
    readingTime: 3,
    vocabulary: ['countless', 'consistent', 'automatic', 'foundation', 'resistance'],
    questions: [
      {
        question: 'What do successful people have in common according to the text?',
        options: [
          'They sleep late',
          'They share common habits like waking up early and exercising',
          'They avoid reading books',
          'They change everything at once'
        ],
        answer: 1
      },
      {
        question: 'What do experts suggest for building good habits?',
        options: [
          'Change all habits at once',
          'Start with the most difficult habits',
          'Start small and focus on one habit at a time',
          'Avoid setting goals'
        ],
        answer: 2
      },
      {
        question: 'What happens when good habits become automatic?',
        options: [
          'You become lazy',
          'You free up mental energy for more important decisions',
          'You stop making progress',
          'You need to work harder'
        ],
        answer: 1
      }
    ]
  },
  {
    id: '2',
    title: 'Climate Change and Our Future',
    content: `Climate change is one of the most pressing issues of our time. Scientists around the world agree that human activities are causing the Earth's temperature to rise at an unprecedented rate. The consequences are already visible: melting ice caps, rising sea levels, and more frequent extreme weather events.

The main cause of climate change is the burning of fossil fuels—coal, oil, and natural gas. These release carbon dioxide and other greenhouse gases into the atmosphere, trapping heat and warming the planet. Deforestation and industrial processes also contribute significantly to this problem.

However, there is hope. Countries are increasingly turning to renewable energy sources like solar and wind power. Electric vehicles are becoming more common on our roads. Many businesses are adopting sustainable practices to reduce their carbon footprint.

Individual actions matter too. Simple changes like using less energy at home, eating less meat, and reducing waste can make a difference. Walking or cycling instead of driving, using public transportation, and supporting environmentally conscious companies are all ways to help.

The transition to a sustainable future will require cooperation at all levels—from individuals to governments to international organizations. The technology exists; what we need now is the collective will to implement change before it's too late.`,
    level: 'B2',
    category: 'Environment',
    wordCount: 218,
    readingTime: 4,
    vocabulary: ['unprecedented', 'consequences', 'deforestation', 'sustainable', 'transition'],
    questions: [
      {
        question: 'What is the main cause of climate change mentioned in the text?',
        options: [
          'Solar radiation',
          'The burning of fossil fuels',
          'Volcanic eruptions',
          'Ocean currents'
        ],
        answer: 1
      },
      {
        question: 'Which of the following is NOT mentioned as a consequence of climate change?',
        options: [
          'Melting ice caps',
          'Rising sea levels',
          'More earthquakes',
          'Extreme weather events'
        ],
        answer: 2
      },
      {
        question: 'What does the text suggest about individual actions?',
        options: [
          'They are meaningless',
          'Only governments can make a difference',
          'Simple changes can make a difference',
          'We should wait for new technology'
        ],
        answer: 2
      }
    ]
  },
  {
    id: '3',
    title: 'The Art of Communication',
    content: `Effective communication is a skill that can transform your personal and professional life. Whether you're giving a presentation, having a difficult conversation, or simply trying to connect with someone, the way you communicate matters.

Listening is perhaps the most underrated aspect of communication. Most people listen to respond rather than to understand. Active listening means giving your full attention, asking clarifying questions, and showing empathy. When people feel heard, they become more open and cooperative.

Body language speaks volumes. Your posture, eye contact, and facial expressions can reinforce or contradict your words. Crossing your arms might signal defensiveness, while maintaining eye contact shows confidence and interest. Being aware of these nonverbal cues helps you communicate more effectively.

Clarity is essential. Use simple, direct language whenever possible. Avoid jargon unless you're sure your audience understands it. Structure your thoughts before speaking, and don't be afraid to pause. Silence can be powerful—it gives both you and your listener time to think.

Finally, adapt your communication style to your audience. What works with friends might not work in a business meeting. Consider cultural differences, personal preferences, and the context of your conversation. The best communicators are flexible and responsive to the needs of their listeners.`,
    level: 'B2',
    category: 'Communication',
    wordCount: 224,
    readingTime: 4,
    vocabulary: ['underrated', 'empathy', 'posture', 'contradict', 'jargon'],
    questions: [
      {
        question: 'What does the text say about listening?',
        options: [
          'It is the most practiced skill',
          'Most people listen to respond rather than understand',
          'It is not important for communication',
          'It should be avoided in difficult conversations'
        ],
        answer: 1
      },
      {
        question: 'According to the text, what does crossing your arms signal?',
        options: [
          'Confidence',
          'Interest',
          'Defensiveness',
          'Agreement'
        ],
        answer: 2
      },
      {
        question: 'What advice does the text give about communication style?',
        options: [
          'Always use the same style',
          'Use complex language to impress',
          'Adapt your style to your audience',
          'Avoid pauses when speaking'
        ],
        answer: 2
      }
    ]
  }
]

export function ReadingModule() {
  const [selectedLevel, setSelectedLevel] = useState<Level | 'all'>('all')
  const [activeReading, setActiveReading] = useState<ReadingMaterial | null>(null)

  const filteredMaterials = readingMaterials.filter(material => 
    selectedLevel === 'all' || material.level === selectedLevel
  )

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
          <h1 className="text-3xl font-bold text-foreground">Okuma Pratigi</h1>
          <p className="text-muted-foreground">Okuma becerilerini gelistir</p>
        </div>
      </div>

      {activeReading ? (
        <ReadingDetail 
          material={activeReading} 
          onBack={() => setActiveReading(null)}
          levelColor={levelColors[activeReading.level]}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-4">
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
            <Badge variant="outline">{filteredMaterials.length} metin</Badge>
          </div>

          {/* Reading List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMaterials.map((material) => (
              <Card 
                key={material.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50"
                onClick={() => setActiveReading(material)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <Badge className={levelColors[material.level]}>{material.level}</Badge>
                    <Badge variant="outline">{material.category}</Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{material.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {material.content.substring(0, 150)}...
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookText className="h-4 w-4" />
                      {material.wordCount} kelime
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {material.readingTime} dk
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-muted-foreground">
                      {material.questions.length} soru
                    </span>
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

// Reading Detail Component
function ReadingDetail({
  material,
  onBack,
  levelColor
}: {
  material: ReadingMaterial
  onBack: () => void
  levelColor: string
}) {
  const [showQuiz, setShowQuiz] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [quizComplete, setQuizComplete] = useState(false)
  const [showVocabulary, setShowVocabulary] = useState(false)

  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    speechSynthesis.speak(utterance)
  }

  const handleAnswerSelect = (index: number) => {
    if (showResult) return
    setSelectedAnswer(index)
  }

  const handleCheckAnswer = () => {
    setShowResult(true)
    if (selectedAnswer === material.questions[currentQuestion].answer) {
      setScore(score + 1)
    }
  }

  const handleNextQuestion = () => {
    if (currentQuestion < material.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    } else {
      setQuizComplete(true)
    }
  }

  const resetQuiz = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setQuizComplete(false)
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack}>
        <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
        Geri Don
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={levelColor}>{material.level}</Badge>
        <Badge variant="outline">{material.category}</Badge>
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <BookText className="h-4 w-4" />
          {material.wordCount} kelime
        </span>
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {material.readingTime} dk
        </span>
      </div>

      <h1 className="text-3xl font-bold">{material.title}</h1>

      {!showQuiz ? (
        <>
          {/* Reading Content */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-end mb-4">
                <Button variant="ghost" size="sm" onClick={() => speakText(material.content)}>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Dinle
                </Button>
              </div>
              <ScrollArea className="h-[400px] pr-4">
                <div className="prose prose-invert max-w-none">
                  {material.content.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="text-foreground leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Vocabulary */}
          <Card>
            <CardHeader>
              <CardTitle 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowVocabulary(!showVocabulary)}
              >
                <span className="flex items-center gap-2">
                  <Bookmark className="h-5 w-5" />
                  Anahtar Kelimeler
                </span>
                <ChevronRight className={cn("h-5 w-5 transition-transform", showVocabulary && "rotate-90")} />
              </CardTitle>
            </CardHeader>
            {showVocabulary && (
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {material.vocabulary.map((word, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="cursor-pointer hover:bg-primary/20"
                      onClick={() => speakText(word)}
                    >
                      {word}
                      <Volume2 className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          <Button onClick={() => setShowQuiz(true)} className="w-full">
            Anlama Testine Basla
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </>
      ) : (
        /* Quiz Section */
        <Card>
          <CardContent className="pt-6">
            {!quizComplete ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm text-muted-foreground">
                    Soru {currentQuestion + 1} / {material.questions.length}
                  </span>
                  <Progress value={((currentQuestion + 1) / material.questions.length) * 100} className="w-32 h-2" />
                </div>

                <h3 className="text-xl font-semibold mb-6">
                  {material.questions[currentQuestion].question}
                </h3>

                <div className="space-y-3">
                  {material.questions[currentQuestion].options.map((option, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className={cn(
                        "w-full justify-start h-auto py-4 px-4 text-left",
                        selectedAnswer === index && !showResult && "border-primary bg-primary/10",
                        showResult && index === material.questions[currentQuestion].answer && "bg-green-500/20 border-green-500",
                        showResult && selectedAnswer === index && index !== material.questions[currentQuestion].answer && "bg-red-500/20 border-red-500"
                      )}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={showResult}
                    >
                      {option}
                      {showResult && index === material.questions[currentQuestion].answer && (
                        <CheckCircle2 className="h-5 w-5 ml-auto text-green-500" />
                      )}
                      {showResult && selectedAnswer === index && index !== material.questions[currentQuestion].answer && (
                        <XCircle className="h-5 w-5 ml-auto text-red-500" />
                      )}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2 mt-6">
                  {!showResult ? (
                    <Button 
                      onClick={handleCheckAnswer} 
                      disabled={selectedAnswer === null}
                      className="flex-1"
                    >
                      Kontrol Et
                    </Button>
                  ) : (
                    <Button onClick={handleNextQuestion} className="flex-1">
                      {currentQuestion < material.questions.length - 1 ? 'Sonraki Soru' : 'Sonuclari Gor'}
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </>
            ) : (
              /* Results */
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Test Tamamlandi!</h2>
                <div className="text-5xl font-bold mb-4">
                  {Math.round((score / material.questions.length) * 100)}%
                </div>
                <Progress value={(score / material.questions.length) * 100} className="h-3 mb-6" />
                <div className="flex justify-center gap-6 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">{score}</div>
                    <div className="text-sm text-muted-foreground">Dogru</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{material.questions.length - score}</div>
                    <div className="text-sm text-muted-foreground">Yanlis</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowQuiz(false)} className="flex-1">
                    Metne Don
                  </Button>
                  <Button onClick={resetQuiz} className="flex-1">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Tekrar Dene
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
