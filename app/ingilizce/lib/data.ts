import type { Module, Achievement, UserProgress } from './types'

// Moduller
export const modules: Module[] = [
  {
    id: 'vocabulary',
    title: 'Vocabulary',
    titleTr: 'Kelime Bankasi',
    description: 'Build your word power with categorized vocabulary',
    icon: 'BookOpen',
    color: 'from-blue-500 to-cyan-500',
    progress: 25,
    totalItems: 5000,
    completedItems: 1250
  },
  {
    id: 'grammar',
    title: 'Grammar',
    titleTr: 'Gramer Kurallari',
    description: 'Master English grammar rules and structures',
    icon: 'FileText',
    color: 'from-purple-500 to-pink-500',
    progress: 40,
    totalItems: 150,
    completedItems: 60
  },
  {
    id: 'idioms',
    title: 'Idioms & Phrases',
    titleTr: 'Deyimler ve Kaliplar',
    description: 'Learn common idioms and expressions',
    icon: 'MessageSquare',
    color: 'from-orange-500 to-red-500',
    progress: 15,
    totalItems: 500,
    completedItems: 75
  },
  {
    id: 'patterns',
    title: 'Sentence Patterns',
    titleTr: 'Cumle Kaliplari',
    description: 'Learn useful sentence structures',
    icon: 'Layers',
    color: 'from-green-500 to-emerald-500',
    progress: 30,
    totalItems: 200,
    completedItems: 60
  },
  {
    id: 'reading',
    title: 'Reading',
    titleTr: 'Okuma Pratigi',
    description: 'Improve reading comprehension skills',
    icon: 'BookText',
    color: 'from-indigo-500 to-blue-500',
    progress: 20,
    totalItems: 100,
    completedItems: 20
  },
  {
    id: 'listening',
    title: 'Listening',
    titleTr: 'Dinleme Pratigi',
    description: 'Enhance your listening comprehension',
    icon: 'Headphones',
    color: 'from-teal-500 to-cyan-500',
    progress: 10,
    totalItems: 80,
    completedItems: 8
  },
  {
    id: 'writing',
    title: 'Writing',
    titleTr: 'Yazma Pratigi',
    description: 'Develop your writing skills',
    icon: 'PenTool',
    color: 'from-rose-500 to-pink-500',
    progress: 5,
    totalItems: 50,
    completedItems: 2
  },
  {
    id: 'speaking',
    title: 'Speaking',
    titleTr: 'Konusma Pratigi',
    description: 'Practice speaking and pronunciation',
    icon: 'Mic',
    color: 'from-amber-500 to-orange-500',
    progress: 8,
    totalItems: 60,
    completedItems: 5
  }
]

// Basarimlar
export const achievements: Achievement[] = [
  { id: '1', title: 'First Steps', description: 'Complete your first lesson', icon: 'Trophy', progress: 1, target: 1, unlockedAt: new Date() },
  { id: '2', title: 'Word Collector', description: 'Learn 100 new words', icon: 'BookOpen', progress: 45, target: 100 },
  { id: '3', title: 'Grammar Guru', description: 'Complete all B1 grammar', icon: 'GraduationCap', progress: 8, target: 20 },
  { id: '4', title: 'Streak Master', description: '7-day learning streak', icon: 'Flame', progress: 3, target: 7 },
  { id: '5', title: 'Polyglot', description: 'Learn 50 idioms', icon: 'MessageCircle', progress: 12, target: 50 },
  { id: '6', title: 'Bookworm', description: 'Complete 20 reading exercises', icon: 'Book', progress: 5, target: 20 }
]

// Kullanici ilerlemesi
export const initialProgress: UserProgress = {
  level: 'B1',
  xp: 2450,
  streak: 3,
  wordsLearned: 245,
  grammarCompleted: 12,
  idiomsLearned: 28,
  readingCompleted: 8,
  listeningCompleted: 5,
  writingCompleted: 3,
  speakingCompleted: 4,
  quizzesTaken: 15,
  averageScore: 78,
  lastActive: new Date(),
  achievements: achievements
}

// Seviye bilgileri
export const levelInfo = {
  A1: { name: 'Beginner', nameTr: 'Başlangıç', xpRequired: 0, color: 'bg-green-500' },
  A2: { name: 'Elementary', nameTr: 'Temel', xpRequired: 1000, color: 'bg-lime-500' },
  B1: { name: 'Intermediate', nameTr: 'Orta', xpRequired: 3000, color: 'bg-yellow-500' },
  B2: { name: 'Upper Intermediate', nameTr: 'Orta Üstü', xpRequired: 6000, color: 'bg-orange-500' },
  C1: { name: 'Advanced', nameTr: 'Ileri', xpRequired: 10000, color: 'bg-red-500' },
  C2: { name: 'Proficient', nameTr: 'Uzman', xpRequired: 15000, color: 'bg-purple-500' }
}
