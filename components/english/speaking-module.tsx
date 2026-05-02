'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mic, MicOff, Play, RotateCcw, Volume2, CheckCircle2, XCircle, ArrowRight, MessageSquare, Users, Presentation } from 'lucide-react'

const speakingExercises = [
  {
    id: 1, type: 'pronunciation', title: 'Telaffuz Pratigi', icon: Volume2,
    exercises: [
      { id: 1, word: 'through', phonetic: '/θruː/', turkishHint: 'Dilini dislerin arasina koy', difficulty: 'Orta' },
      { id: 2, word: 'comfortable', phonetic: '/ˈkʌmftəbl/', turkishHint: '3 hece: KUMF-tuh-bl', difficulty: 'Zor' },
      { id: 3, word: 'schedule', phonetic: '/ˈʃedjuːl/', turkishHint: 'SHED-yool', difficulty: 'Orta' },
      { id: 4, word: 'entrepreneur', phonetic: '/ˌɒntrəprəˈnɜː/', turkishHint: 'ON-truh-pruh-NUR', difficulty: 'Zor' },
    ]
  },
  {
    id: 2, type: 'roleplay', title: 'Rol Yapma', icon: Users,
    scenarios: [
      { id: 1, title: 'Restoranda Siparis', description: 'Bir restoranda yemek siparisi verin', prompts: ['Garson: Good evening! Welcome to our restaurant. Table for how many?', 'Sen: ...', 'Garson: Perfect. Here\'s your menu. Can I get you something to drink?', 'Sen: ...', 'Garson: Are you ready to order?', 'Sen: ...'], suggestedResponses: ['Table for two, please.', "I'd like a glass of water, please.", "Yes, I'll have the grilled salmon with vegetables."] },
      { id: 2, title: 'Is Gorusmesi', description: 'Bir is gorusmesinde kendinizi tanitın', prompts: ['Interviewer: Tell me about yourself.', 'Sen: ...', 'Interviewer: Why do you want to work for our company?', 'Sen: ...', 'Interviewer: Where do you see yourself in 5 years?', 'Sen: ...'], suggestedResponses: ['I\'m a software developer with 3 years of experience...', "I admire your company's innovative approach to...", 'I see myself growing into a leadership role...'] }
    ]
  },
  {
    id: 3, type: 'presentation', title: 'Sunum Pratigi', icon: Presentation,
    topics: [
      { id: 1, title: 'Kendinizi Tanitin', duration: '1-2 dakika', points: ['Your name and background', 'Your hobbies and interests', 'Your goals and aspirations'], tips: ['Goz temasi kurun', 'Net ve yavas konusun', 'Baglac kelimeleri kullanin (First, Then, Finally)'] },
      { id: 2, title: 'Favori Filminizi Anlatin', duration: '2-3 dakika', points: ['Movie title and genre', 'Main plot summary', 'Why you like it', 'Would you recommend it?'], tips: ['Spoiler vermeden anlatin', 'Duygularinizi ifade edin', 'Karsilastirmalar yapin'] }
    ]
  },
  {
    id: 4, type: 'conversation', title: 'Gunluk Konusma', icon: MessageSquare,
    dialogues: [
      { id: 1, title: 'Tanisma', lines: [{ speaker: 'A', text: 'Hi! I\'m Sarah. Nice to meet you!' }, { speaker: 'B', text: 'Nice to meet you too! I\'m [your name].' }, { speaker: 'A', text: 'Where are you from?' }, { speaker: 'B', text: 'I\'m from Turkey. What about you?' }, { speaker: 'A', text: 'I\'m from London. How long have you been here?' }, { speaker: 'B', text: "I've been here for about two weeks." }] },
      { id: 2, title: 'Yol Tarifi', lines: [{ speaker: 'A', text: 'Excuse me, could you help me?' }, { speaker: 'B', text: 'Of course! What do you need?' }, { speaker: 'A', text: "I'm looking for the train station." }, { speaker: 'B', text: 'Go straight and turn left at the traffic lights.' }, { speaker: 'A', text: 'How far is it from here?' }, { speaker: 'B', text: "It's about a 10-minute walk." }] }
    ]
  }
]

export function SpeakingModule() {
  const [isRecording, setIsRecording] = useState(false)
  const [currentExercise, setCurrentExercise] = useState(0)
  const [activeTab, setActiveTab] = useState('pronunciation')
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null)
  const [currentDialogue, setCurrentDialogue] = useState(0)
  const [practiceResults, setPracticeResults] = useState<{ [key: string]: 'success' | 'retry' | null }>({})

  const handleRecord = () => {
    setIsRecording(!isRecording)
    if (isRecording) {
      const random = Math.random() > 0.3
      setPracticeResults({ ...practiceResults, [`${activeTab}-${currentExercise}`]: random ? 'success' : 'retry' })
    }
  }

  const playAudio = () => {
    const pronunciation = speakingExercises.find(e => e.type === 'pronunciation')
    const word = pronunciation?.exercises?.[currentExercise]?.word || ''
    const u = new SpeechSynthesisUtterance(word)
    u.lang = 'en-US'
    window.speechSynthesis.speak(u)
  }

  const pronunciation = speakingExercises.find(e => e.type === 'pronunciation')
  const roleplay = speakingExercises.find(e => e.type === 'roleplay')
  const presentation = speakingExercises.find(e => e.type === 'presentation')
  const conversation = speakingExercises.find(e => e.type === 'conversation')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Konusma Pratigi</h1>
          <p className="text-muted-foreground mt-1">Telaffuz, rol yapma ve sunum becerileri</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Bugunku Pratik</p>
          <p className="text-2xl font-bold text-primary">12 dk</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pronunciation" className="gap-2"><Volume2 className="h-4 w-4" />Telaffuz</TabsTrigger>
          <TabsTrigger value="roleplay" className="gap-2"><Users className="h-4 w-4" />Rol Yapma</TabsTrigger>
          <TabsTrigger value="presentation" className="gap-2"><Presentation className="h-4 w-4" />Sunum</TabsTrigger>
          <TabsTrigger value="conversation" className="gap-2"><MessageSquare className="h-4 w-4" />Diyalog</TabsTrigger>
        </TabsList>

        <TabsContent value="pronunciation" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Kelime Telaffuzu</span>
                  <Badge variant="outline">{currentExercise + 1} / {pronunciation?.exercises?.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {pronunciation?.exercises && (
                  <>
                    <div className="text-center p-8 bg-muted/30 rounded-xl">
                      <p className="text-5xl font-bold text-foreground mb-2">{pronunciation.exercises[currentExercise].word}</p>
                      <p className="text-2xl text-primary font-mono">{pronunciation.exercises[currentExercise].phonetic}</p>
                      <p className="text-sm text-muted-foreground mt-4">💡 {pronunciation.exercises[currentExercise].turkishHint}</p>
                      <Badge className="mt-2" variant="secondary">{pronunciation.exercises[currentExercise].difficulty}</Badge>
                    </div>
                    <div className="flex justify-center gap-4">
                      <Button variant="outline" size="lg" onClick={playAudio}><Volume2 className="h-5 w-5 mr-2" />Dinle</Button>
                      <Button size="lg" variant={isRecording ? 'destructive' : 'default'} onClick={handleRecord} className="min-w-32">
                        {isRecording ? <><MicOff className="h-5 w-5 mr-2" />Durdur</> : <><Mic className="h-5 w-5 mr-2" />Kaydet</>}
                      </Button>
                    </div>
                    {practiceResults[`pronunciation-${currentExercise}`] && (
                      <div className={`p-4 rounded-lg text-center ${practiceResults[`pronunciation-${currentExercise}`] === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                        {practiceResults[`pronunciation-${currentExercise}`] === 'success'
                          ? <div className="flex items-center justify-center gap-2"><CheckCircle2 className="h-5 w-5" />Harika! Telaffuzun cok iyi.</div>
                          : <div className="flex items-center justify-center gap-2"><XCircle className="h-5 w-5" />Tekrar dene! Biraz daha pratik yap.</div>}
                      </div>
                    )}
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => setCurrentExercise(Math.max(0, currentExercise - 1))} disabled={currentExercise === 0}>Onceki</Button>
                      <Button onClick={() => setCurrentExercise(Math.min(pronunciation.exercises!.length - 1, currentExercise + 1))} disabled={currentExercise === pronunciation.exercises!.length - 1}>Sonraki<ArrowRight className="h-4 w-4 ml-2" /></Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Telaffuz Ipuclari</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold mb-2">TH Sesi (/θ/ ve /ð/)</h4>
                  <p className="text-sm text-muted-foreground">Dilinizi ust dislerinizin arasina koyun ve hafifce ufleyin. Turkcede bu ses yoktur.</p>
                  <div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">think</Badge><Badge variant="outline">the</Badge><Badge variant="outline">through</Badge></div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold mb-2">R Sesi</h4>
                  <p className="text-sm text-muted-foreground">Amerikan Ingilizcesinde R sesi dilinizi geriye dogru kivırarak yapilir.</p>
                  <div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">red</Badge><Badge variant="outline">right</Badge><Badge variant="outline">car</Badge></div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold mb-2">Vurgulu Heceler</h4>
                  <p className="text-sm text-muted-foreground">Ingilizcede her kelimenin vurgulu bir hecesi vardir. Yanlis vurgu anlasilmayi zorlastirir.</p>
                  <div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">PHO-to-graph</Badge><Badge variant="outline">pho-TO-gra-pher</Badge></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roleplay" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-4">
              <h3 className="font-semibold text-lg">Senaryolar</h3>
              {roleplay?.scenarios?.map((scenario) => (
                <Card key={scenario.id} className={`cursor-pointer transition-all hover:border-primary/50 ${selectedScenario === scenario.id ? 'border-primary bg-primary/5' : ''}`} onClick={() => setSelectedScenario(scenario.id)}>
                  <CardContent className="p-4"><h4 className="font-semibold">{scenario.title}</h4><p className="text-sm text-muted-foreground mt-1">{scenario.description}</p></CardContent>
                </Card>
              ))}
            </div>
            <div className="lg:col-span-2">
              {selectedScenario ? (
                <Card>
                  <CardHeader><CardTitle>{roleplay?.scenarios?.find(s => s.id === selectedScenario)?.title}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {roleplay?.scenarios?.find(s => s.id === selectedScenario)?.prompts.map((prompt, idx) => (
                      <div key={idx} className={`p-4 rounded-lg ${prompt.startsWith('Sen:') ? 'bg-primary/10 border-l-4 border-primary ml-8' : 'bg-muted/30 mr-8'}`}>
                        <p className="text-sm">{prompt}</p>
                        {prompt.startsWith('Sen:') && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline"><Mic className="h-4 w-4 mr-1" />Kaydet</Button><Button size="sm" variant="ghost">Ipucu</Button></div>}
                      </div>
                    ))}
                    <div className="p-4 bg-muted/30 rounded-lg mt-6">
                      <h4 className="font-semibold mb-2">Onerilen Yanitlar</h4>
                      <ul className="space-y-2">{roleplay?.scenarios?.find(s => s.id === selectedScenario)?.suggestedResponses.map((r, idx) => <li key={idx} className="text-sm text-muted-foreground">• {r}</li>)}</ul>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">Pratik yapmak icin bir senaryo secin</p></CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="presentation" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {presentation?.topics?.map((topic) => (
              <Card key={topic.id} className={`cursor-pointer transition-all hover:border-primary/50 ${selectedTopic === topic.id ? 'border-primary' : ''}`} onClick={() => setSelectedTopic(topic.id)}>
                <CardHeader><CardTitle className="flex items-center justify-between"><span>{topic.title}</span><Badge variant="outline">{topic.duration}</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Konusma Noktalari:</h4>
                    <ul className="space-y-1">{topic.points.map((point, idx) => <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{point}</li>)}</ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Ipuclari:</h4>
                    <ul className="space-y-1">{topic.tips.map((tip, idx) => <li key={idx} className="text-sm text-muted-foreground">💡 {tip}</li>)}</ul>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button className="flex-1"><Mic className="h-4 w-4 mr-2" />Sunuma Basla</Button>
                    <Button variant="outline"><RotateCcw className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="conversation" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Diyaloglar</h3>
              {conversation?.dialogues?.map((dialogue, idx) => (
                <Card key={dialogue.id} className={`cursor-pointer transition-all hover:border-primary/50 ${currentDialogue === idx ? 'border-primary bg-primary/5' : ''}`} onClick={() => setCurrentDialogue(idx)}>
                  <CardContent className="p-4"><h4 className="font-semibold">{dialogue.title}</h4><p className="text-sm text-muted-foreground mt-1">{dialogue.lines.length} satir diyalog</p></CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{conversation?.dialogues?.[currentDialogue]?.title}</span>
                  <Button size="sm" variant="outline"><Play className="h-4 w-4 mr-1" />Tumunu Dinle</Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {conversation?.dialogues?.[currentDialogue]?.lines.map((line, idx) => (
                  <div key={idx} className={`p-3 rounded-lg flex items-start gap-3 ${line.speaker === 'B' ? 'bg-primary/10 ml-8' : 'bg-muted/30 mr-8'}`}>
                    <Badge variant={line.speaker === 'B' ? 'default' : 'secondary'}>{line.speaker}</Badge>
                    <div className="flex-1"><p className="text-sm">{line.text}</p></div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Volume2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="pt-4 flex gap-2">
                  <Button className="flex-1"><Mic className="h-4 w-4 mr-2" />B Rolunu Oyna</Button>
                  <Button variant="outline" className="flex-1"><Users className="h-4 w-4 mr-2" />A Rolunu Oyna</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
