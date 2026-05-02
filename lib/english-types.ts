// Seviye tipleri
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

// Kelime tipleri
export interface Word {
  id: string
  english: string
  turkish: string
  pronunciation: string
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'pronoun' | 'interjection'
  level: Level
  examples: string[]
  synonyms?: string[]
  antonyms?: string[]
  category: string
  audioUrl?: string
  imageUrl?: string
  learned: boolean
  reviewCount: number
  nextReview?: Date
}

// Gramer kuralı tipleri
export interface GrammarRule {
  id: string
  title: string
  titleTr: string
  level: Level
  category: string
  explanation: string
  explanationTr: string
  formula: string
  examples: {
    english: string
    turkish: string
    highlight?: string
  }[]
  commonMistakes?: {
    wrong: string
    correct: string
    explanation: string
  }[]
  exercises: GrammarExercise[]
}

export interface GrammarExercise {
  id: string
  type: 'fill-blank' | 'multiple-choice' | 'reorder' | 'transform'
  question: string
  options?: string[]
  answer: string
  explanation: string
}

// Deyim tipleri
export interface Idiom {
  id: string
  english: string
  turkish: string
  literal: string
  meaning: string
  examples: string[]
  level: Level
  category: string
  origin?: string
}

// Cumle kalibi tipleri
export interface SentencePattern {
  id: string
  pattern: string
  meaning: string
  level: Level
  examples: {
    english: string
    turkish: string
  }[]
  usage: string
  category: string
}

// Okuma materyali tipleri
export interface ReadingMaterial {
  id: string
  title: string
  content: string
  level: Level
  category: string
  wordCount: number
  readingTime: number
  vocabulary: string[]
  questions: {
    question: string
    options: string[]
    answer: number
  }[]
  audioUrl?: string
}

// Dinleme materyali tipleri
export interface ListeningMaterial {
  id: string
  title: string
  audioUrl: string
  transcript: string
  level: Level
  duration: number
  questions: {
    question: string
    options: string[]
    answer: number
    timestamp?: number
  }[]
}

// Yazma egzersizi tipleri
export interface WritingExercise {
  id: string
  type: 'essay' | 'email' | 'story' | 'description' | 'summary'
  prompt: string
  promptTr: string
  level: Level
  wordLimit: { min: number; max: number }
  tips: string[]
  sampleAnswer?: string
  criteria: string[]
}

// Konusma egzersizi tipleri
export interface SpeakingExercise {
  id: string
  type: 'pronunciation' | 'dialogue' | 'monologue' | 'roleplay'
  title: string
  instructions: string
  level: Level
  targetPhrases?: string[]
  dialogue?: {
    speaker: 'A' | 'B'
    text: string
  }[]
  tips: string[]
}

// Kullanici ilerleme tipleri
export interface UserProgress {
  level: Level
  xp: number
  streak: number
  wordsLearned: number
  grammarCompleted: number
  idiomsLearned: number
  readingCompleted: number
  listeningCompleted: number
  writingCompleted: number
  speakingCompleted: number
  quizzesTaken: number
  averageScore: number
  lastActive: Date
  achievements: Achievement[]
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlockedAt?: Date
  progress: number
  target: number
}

// Quiz tipleri
export interface Quiz {
  id: string
  title: string
  type: 'vocabulary' | 'grammar' | 'idiom' | 'mixed'
  level: Level
  questions: QuizQuestion[]
  timeLimit?: number
}

export interface QuizQuestion {
  id: string
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'matching' | 'listening'
  question: string
  options?: string[]
  answer: string | number
  explanation?: string
  points: number
  audioUrl?: string
  imageUrl?: string
}

// Modül kategorileri
export type ModuleType = 'vocabulary' | 'grammar' | 'idioms' | 'patterns' | 'reading' | 'listening' | 'writing' | 'speaking' | 'quiz'

export interface Module {
  id: ModuleType
  title: string
  titleTr: string
  description: string
  icon: string
  color: string
  progress: number
  totalItems: number
  completedItems: number
}
