"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Trophy,
  Target,
  Zap,
  Clock,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Languages,
  MessageSquare,
  Lightbulb,
} from "lucide-react";

type QuizCategory = "vocabulary" | "grammar" | "idioms" | "mixed";

interface Question {
  id: number;
  category: QuizCategory;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

const quizQuestions: Question[] = [
  {
    id: 1,
    category: "vocabulary",
    question: "'Accomplish' kelimesinin Türkçe karşılığı nedir?",
    options: ["Kabul etmek", "Başarmak", "Reddetmek", "Düşünmek"],
    correct: 1,
    explanation: "Accomplish = başarmak, gerçekleştirmek anlamına gelir.",
  },
  {
    id: 2,
    category: "grammar",
    question: "Hangi cümle Present Perfect tense kullanımına örnektir?",
    options: [
      "I went to Paris last year.",
      "I have been to Paris three times.",
      "I will go to Paris next month.",
      "I am going to Paris.",
    ],
    correct: 1,
    explanation:
      "Present Perfect (have/has + past participle) geçmişte olan ama şu ana bağlı deneyimleri ifade eder.",
  },
  {
    id: 3,
    category: "idioms",
    question: "'Break the ice' deyiminin anlamı nedir?",
    options: [
      "Buz kırmak",
      "İlk adımı atmak, ortamı yumuşatmak",
      "Soğuk davranmak",
      "Hava durumunu konuşmak",
    ],
    correct: 1,
    explanation:
      "Break the ice = yeni tanışılan bir ortamda ilk adımı atarak gerginliği gidermek.",
  },
  {
    id: 4,
    category: "grammar",
    question: "Boşluğu doğru kelimeyle doldurun: 'She ___ to the gym every day.'",
    options: ["go", "goes", "going", "gone"],
    correct: 1,
    explanation:
      "Simple Present tense'de 3. tekil şahıs (he/she/it) için fiile -s/-es eklenir.",
  },
  {
    id: 5,
    category: "vocabulary",
    question: "'Hesitant' kelimesinin eş anlamlısı hangisidir?",
    options: ["Confident", "Uncertain", "Brave", "Quick"],
    correct: 1,
    explanation: "Hesitant = tereddütlü, kararsız. Uncertain da benzer anlam taşır.",
  },
  {
    id: 6,
    category: "idioms",
    question: "'Hit the nail on the head' ne anlama gelir?",
    options: [
      "Çivi çakmak",
      "Tam isabetli konuşmak",
      "Hata yapmak",
      "Zarar vermek",
    ],
    correct: 1,
    explanation:
      "Hit the nail on the head = tam doğruyu söylemek, isabetli konuşmak.",
  },
  {
    id: 7,
    category: "grammar",
    question: "Hangi cümle Conditional Type 2 örneğidir?",
    options: [
      "If it rains, I will stay home.",
      "If I were rich, I would travel the world.",
      "If I had known, I would have told you.",
      "If you heat water, it boils.",
    ],
    correct: 1,
    explanation:
      "Conditional Type 2: If + past simple, would + base verb. Gerçek olmayan durumları ifade eder.",
  },
  {
    id: 8,
    category: "vocabulary",
    question: "'Inevitable' kelimesinin anlamı nedir?",
    options: ["Gerekli", "İmkansız", "Kaçınılmaz", "Nadir"],
    correct: 2,
    explanation: "Inevitable = kaçınılmaz, önlenemez anlamına gelir.",
  },
  {
    id: 9,
    category: "grammar",
    question: "'The book ___ by millions of people.' cümlesinde boşluğa ne gelir?",
    options: ["read", "reads", "is read", "reading"],
    correct: 2,
    explanation: "Passive voice (edilgen çatı) kullanılmalı: is + past participle.",
  },
  {
    id: 10,
    category: "idioms",
    question: "'Once in a blue moon' ne anlama gelir?",
    options: ["Her gece", "Çok nadir", "Mavi ışıkta", "Ay tutulmasında"],
    correct: 1,
    explanation: "Once in a blue moon = çok nadir, nadiren anlamına gelir.",
  },
];

export function QuizModule() {
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [streak, setStreak] = useState(0);

  const filteredQuestions =
    selectedCategory === "mixed"
      ? quizQuestions
      : quizQuestions.filter((q) => q.category === selectedCategory);

  const handleStartQuiz = (category: QuizCategory) => {
    setSelectedCategory(category);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setAnswers([]);
    setQuizComplete(false);
    setStreak(0);
  };

  const handleAnswer = () => {
    if (selectedAnswer === null) return;

    const isCorrect = selectedAnswer === filteredQuestions[currentQuestion].correct;
    setShowResult(true);

    if (isCorrect) {
      setScore(score + 1);
      setStreak(streak + 1);
    } else {
      setStreak(0);
    }

    setAnswers([...answers, selectedAnswer]);
  };

  const handleNext = () => {
    if (currentQuestion < filteredQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      setQuizComplete(true);
    }
  };

  const getScoreMessage = () => {
    const percentage = (score / filteredQuestions.length) * 100;
    if (percentage >= 90) return { text: "Mükemmel!", emoji: "🏆" };
    if (percentage >= 70) return { text: "Çok İyi!", emoji: "🌟" };
    if (percentage >= 50) return { text: "İyi!", emoji: "👍" };
    return { text: "Daha Fazla Pratik Yap!", emoji: "💪" };
  };

  const categoryIcons = {
    vocabulary: BookOpen,
    grammar: Languages,
    idioms: MessageSquare,
    mixed: Lightbulb,
  };

  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quiz Merkezi</h1>
          <p className="text-muted-foreground mt-1">
            Bilgilerini test et ve seviyeni ölç
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              category: "vocabulary" as QuizCategory,
              title: "Kelime Bilgisi",
              description: "Kelime haznenizi test edin",
              color: "from-blue-500 to-cyan-500",
              questions: quizQuestions.filter((q) => q.category === "vocabulary").length,
            },
            {
              category: "grammar" as QuizCategory,
              title: "Gramer",
              description: "Dilbilgisi kurallarını test edin",
              color: "from-purple-500 to-pink-500",
              questions: quizQuestions.filter((q) => q.category === "grammar").length,
            },
            {
              category: "idioms" as QuizCategory,
              title: "Deyimler",
              description: "Deyim ve kalıpları test edin",
              color: "from-orange-500 to-red-500",
              questions: quizQuestions.filter((q) => q.category === "idioms").length,
            },
            {
              category: "mixed" as QuizCategory,
              title: "Karışık",
              description: "Tüm kategorilerden sorular",
              color: "from-green-500 to-emerald-500",
              questions: quizQuestions.length,
            },
          ].map((item) => {
            const Icon = categoryIcons[item.category];
            return (
              <Card
                key={item.category}
                className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg border-border/50 overflow-hidden"
                onClick={() => handleStartQuiz(item.category)}
              >
                <div className={`h-2 bg-gradient-to-r ${item.color}`} />
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-r ${item.color} text-white`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {item.questions} soru
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <Button className="w-full mt-4">Başla</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Günlük İstatistikler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 bg-muted/30 rounded-xl">
                <Target className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Quiz Tamamlandı</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-xl">
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold">0%</p>
                <p className="text-sm text-muted-foreground">Doğruluk Oranı</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-xl">
                <Zap className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">En Yüksek Seri</p>
              </div>
              <div className="text-center p-4 bg-muted/30 rounded-xl">
                <Clock className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold">0 dk</p>
                <p className="text-sm text-muted-foreground">Toplam Süre</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quizComplete) {
    const scoreMessage = getScoreMessage();
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-border/50 text-center">
          <CardContent className="p-12">
            <div className="text-6xl mb-4">{scoreMessage.emoji}</div>
            <h2 className="text-3xl font-bold mb-2">{scoreMessage.text}</h2>
            <p className="text-muted-foreground mb-6">Quiz tamamlandı!</p>

            <div className="bg-muted/30 rounded-xl p-6 mb-8">
              <div className="text-5xl font-bold text-primary mb-2">
                {score} / {filteredQuestions.length}
              </div>
              <p className="text-muted-foreground">Doğru Cevap</p>
              <Progress
                value={(score / filteredQuestions.length) * 100}
                className="mt-4 h-3"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-green-500/10 rounded-xl">
                <CheckCircle2 className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <p className="text-xl font-bold text-green-500">{score}</p>
                <p className="text-xs text-muted-foreground">Doğru</p>
              </div>
              <div className="p-4 bg-red-500/10 rounded-xl">
                <XCircle className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold text-red-500">
                  {filteredQuestions.length - score}
                </p>
                <p className="text-xs text-muted-foreground">Yanlış</p>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-xl">
                <Zap className="h-6 w-6 mx-auto text-yellow-500 mb-1" />
                <p className="text-xl font-bold text-yellow-500">{streak}</p>
                <p className="text-xs text-muted-foreground">En Yüksek Seri</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-left">Cevap Özeti:</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`p-3 rounded-lg text-left text-sm ${
                      answers[idx] === q.correct
                        ? "bg-green-500/10 border border-green-500/30"
                        : "bg-red-500/10 border border-red-500/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {answers[idx] === q.correct ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium">{q.question}</p>
                        {answers[idx] !== q.correct && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Doğru cevap: {q.options[q.correct]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedCategory(null)}
              >
                Kategorilere Dön
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleStartQuiz(selectedCategory)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Tekrar Dene
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const question = filteredQuestions[currentQuestion];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setSelectedCategory(null)}>
          Geri
        </Button>
        <div className="flex items-center gap-4">
          {streak > 1 && (
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3 text-yellow-500" />
              {streak} Seri
            </Badge>
          )}
          <Badge variant="outline">
            {currentQuestion + 1} / {filteredQuestions.length}
          </Badge>
        </div>
      </div>

      <Progress value={((currentQuestion + 1) / filteredQuestions.length) * 100} />

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="capitalize">
              {question.category === "vocabulary"
                ? "Kelime"
                : question.category === "grammar"
                ? "Gramer"
                : "Deyim"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Skor: {score}/{currentQuestion}
            </span>
          </div>
          <CardTitle className="text-xl mt-4">{question.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={selectedAnswer?.toString()}
            onValueChange={(value) => setSelectedAnswer(parseInt(value))}
            disabled={showResult}
          >
            {question.options.map((option, idx) => (
              <div
                key={idx}
                className={`flex items-center space-x-3 p-4 rounded-lg border transition-all ${
                  showResult
                    ? idx === question.correct
                      ? "bg-green-500/10 border-green-500"
                      : selectedAnswer === idx
                      ? "bg-red-500/10 border-red-500"
                      : "border-border/50"
                    : selectedAnswer === idx
                    ? "border-primary bg-primary/5"
                    : "border-border/50 hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value={idx.toString()} id={`option-${idx}`} />
                <Label
                  htmlFor={`option-${idx}`}
                  className="flex-1 cursor-pointer font-normal"
                >
                  {option}
                </Label>
                {showResult && idx === question.correct && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {showResult && selectedAnswer === idx && idx !== question.correct && (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            ))}
          </RadioGroup>

          {showResult && (
            <div
              className={`p-4 rounded-lg ${
                selectedAnswer === question.correct
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-orange-500/10 border border-orange-500/30"
              }`}
            >
              <p className="font-semibold mb-1">
                {selectedAnswer === question.correct
                  ? "Doğru!"
                  : "Yanlış!"}
              </p>
              <p className="text-sm text-muted-foreground">
                {question.explanation}
              </p>
            </div>
          )}

          <div className="flex gap-4">
            {!showResult ? (
              <Button
                className="flex-1"
                onClick={handleAnswer}
                disabled={selectedAnswer === null}
              >
                Cevapla
              </Button>
            ) : (
              <Button className="flex-1" onClick={handleNext}>
                {currentQuestion < filteredQuestions.length - 1 ? (
                  <>
                    Sonraki Soru
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  "Sonuçları Gör"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
