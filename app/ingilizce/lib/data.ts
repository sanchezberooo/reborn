import type { Word, GrammarRule, Idiom, SentencePattern, UserProgress, Module, Achievement } from './types'

// Ornek kelimeler
export const sampleWords: Word[] = [
  {
    id: '1',
    english: 'accomplish',
    turkish: 'basarmak, gerceklestirmek',
    pronunciation: '/əˈkɒmplɪʃ/',
    partOfSpeech: 'verb',
    level: 'B2',
    examples: [
      'She accomplished her goal of running a marathon.',
      'We accomplished the task ahead of schedule.',
      'He accomplished great things in his career.'
    ],
    synonyms: ['achieve', 'complete', 'fulfill'],
    antonyms: ['fail', 'abandon'],
    category: 'Success & Achievement',
    learned: false,
    reviewCount: 0
  },
  {
    id: '2',
    english: 'resilient',
    turkish: 'dayanikli, cok cabuk iyilesen',
    pronunciation: '/rɪˈzɪliənt/',
    partOfSpeech: 'adjective',
    level: 'C1',
    examples: [
      'Children are remarkably resilient.',
      'The economy proved to be resilient during the crisis.',
      'She became more resilient after facing many challenges.'
    ],
    synonyms: ['tough', 'strong', 'adaptable'],
    antonyms: ['fragile', 'weak'],
    category: 'Personality',
    learned: false,
    reviewCount: 0
  },
  {
    id: '3',
    english: 'ambiguous',
    turkish: 'belirsiz, iki anlamli',
    pronunciation: '/æmˈbɪɡjuəs/',
    partOfSpeech: 'adjective',
    level: 'B2',
    examples: [
      'The ending of the movie was ambiguous.',
      'His answer was deliberately ambiguous.',
      'The contract contains some ambiguous terms.'
    ],
    synonyms: ['unclear', 'vague', 'equivocal'],
    antonyms: ['clear', 'unambiguous', 'definite'],
    category: 'Communication',
    learned: false,
    reviewCount: 0
  },
  {
    id: '4',
    english: 'eloquent',
    turkish: 'akici, etkili konusan',
    pronunciation: '/ˈeləkwənt/',
    partOfSpeech: 'adjective',
    level: 'C1',
    examples: [
      'She gave an eloquent speech at the conference.',
      'He is an eloquent defender of human rights.',
      'Her eloquent writing style captivated readers.'
    ],
    synonyms: ['articulate', 'fluent', 'expressive'],
    antonyms: ['inarticulate', 'tongue-tied'],
    category: 'Communication',
    learned: true,
    reviewCount: 3
  },
  {
    id: '5',
    english: 'inevitable',
    turkish: 'kacınılmaz, mukadder',
    pronunciation: '/ɪnˈevɪtəbl/',
    partOfSpeech: 'adjective',
    level: 'B2',
    examples: [
      'Change is inevitable in life.',
      'The accident was inevitable given the conditions.',
      'Death is the only inevitable thing in life.'
    ],
    synonyms: ['unavoidable', 'certain', 'inescapable'],
    antonyms: ['avoidable', 'preventable', 'uncertain'],
    category: 'Life & Philosophy',
    learned: false,
    reviewCount: 0
  },
  {
    id: '6',
    english: 'meticulous',
    turkish: 'titiz, dikkatli',
    pronunciation: '/məˈtɪkjələs/',
    partOfSpeech: 'adjective',
    level: 'C1',
    examples: [
      'She is meticulous about her work.',
      'The research was conducted with meticulous care.',
      'He keeps meticulous records of all transactions.'
    ],
    synonyms: ['careful', 'thorough', 'precise'],
    antonyms: ['careless', 'sloppy', 'negligent'],
    category: 'Work & Productivity',
    learned: false,
    reviewCount: 0
  },
  {
    id: '7',
    english: 'procrastinate',
    turkish: 'ertelemek, oyalanmak',
    pronunciation: '/prəˈkræstɪneɪt/',
    partOfSpeech: 'verb',
    level: 'B2',
    examples: [
      'Stop procrastinating and start working!',
      'I tend to procrastinate when I have difficult tasks.',
      'She procrastinated until the deadline was near.'
    ],
    synonyms: ['delay', 'postpone', 'defer'],
    antonyms: ['act', 'proceed', 'advance'],
    category: 'Work & Productivity',
    learned: false,
    reviewCount: 0
  },
  {
    id: '8',
    english: 'serendipity',
    turkish: 'sans eseri bulunan guzel sey',
    pronunciation: '/ˌserənˈdɪpɪti/',
    partOfSpeech: 'noun',
    level: 'C2',
    examples: [
      'Finding that book was pure serendipity.',
      'By serendipity, they met at the same cafe.',
      'The discovery was a result of serendipity.'
    ],
    synonyms: ['luck', 'chance', 'fortune'],
    category: 'Life & Philosophy',
    learned: false,
    reviewCount: 0
  }
]

// Ornek gramer kurallari
export const sampleGrammarRules: GrammarRule[] = [
  {
    id: '1',
    title: 'Present Perfect Tense',
    titleTr: 'Simdiki Zaman Bitmiş Kip',
    level: 'B1',
    category: 'Tenses',
    explanation: 'Used to describe actions that happened at an unspecified time before now or actions that started in the past and continue to the present.',
    explanationTr: 'Gecmiste belirsiz bir zamanda olan veya gecmiste baslayıp simdi devam eden eylemleri anlatmak icin kullanılır.',
    formula: 'Subject + have/has + Past Participle (V3)',
    examples: [
      { english: 'I have visited Paris three times.', turkish: 'Paris\'i uc kere ziyaret ettim.', highlight: 'have visited' },
      { english: 'She has lived here since 2010.', turkish: '2010\'dan beri burada yaşıyor.', highlight: 'has lived' },
      { english: 'They have just finished their homework.', turkish: 'Odevlerini yeni bitirdiler.', highlight: 'have finished' }
    ],
    commonMistakes: [
      { wrong: 'I have went to school.', correct: 'I have gone to school.', explanation: 'Use past participle (V3), not simple past.' },
      { wrong: 'She has seen him yesterday.', correct: 'She saw him yesterday.', explanation: 'Don\'t use present perfect with specific past time expressions.' }
    ],
    exercises: [
      {
        id: 'ex1',
        type: 'fill-blank',
        question: 'I ___ (never/see) such a beautiful sunset.',
        answer: 'have never seen',
        explanation: 'Use "have + never + past participle" for negative experiences.'
      },
      {
        id: 'ex2',
        type: 'multiple-choice',
        question: 'She ___ in London for five years.',
        options: ['lives', 'has lived', 'lived', 'is living'],
        answer: 'has lived',
        explanation: 'Use present perfect with "for" to show duration from past to now.'
      }
    ]
  },
  {
    id: '2',
    title: 'Conditional Sentences Type 2',
    titleTr: 'Koşul Cümleleri Tip 2',
    level: 'B2',
    category: 'Conditionals',
    explanation: 'Used to talk about unreal or hypothetical situations in the present or future.',
    explanationTr: 'Şimdi veya gelecekte gercek olmayan veya varsayımsal durumları anlatmak icin kullanılır.',
    formula: 'If + Subject + Past Simple, Subject + would/could/might + Base Verb',
    examples: [
      { english: 'If I won the lottery, I would travel the world.', turkish: 'Piyango kazansam, dünyayı gezerim.', highlight: 'If I won... I would travel' },
      { english: 'If she had more time, she could learn a new language.', turkish: 'Daha fazla zamanı olsa, yeni bir dil ogrenebilir.', highlight: 'If she had... she could learn' },
      { english: 'If they knew the answer, they might tell us.', turkish: 'Cevabı bilseler, bize söyleyebilirler.', highlight: 'If they knew... they might tell' }
    ],
    commonMistakes: [
      { wrong: 'If I would have money, I would buy a car.', correct: 'If I had money, I would buy a car.', explanation: 'Don\'t use "would" in the if-clause.' },
      { wrong: 'If he was rich, he would help.', correct: 'If he were rich, he would help.', explanation: 'Use "were" for all subjects in formal English.' }
    ],
    exercises: [
      {
        id: 'ex1',
        type: 'fill-blank',
        question: 'If I ___ (be) you, I would apologize.',
        answer: 'were',
        explanation: 'Use "were" for all subjects in Type 2 conditionals.'
      }
    ]
  },
  {
    id: '3',
    title: 'Passive Voice',
    titleTr: 'Edilgen Cati',
    level: 'B1',
    category: 'Voice',
    explanation: 'Used when the focus is on the action rather than who performs it.',
    explanationTr: 'Odak eylemi yapan kisiye degil eylemin kendisine olduğunda kullanılır.',
    formula: 'Subject + be + Past Participle (+ by agent)',
    examples: [
      { english: 'The book was written by Shakespeare.', turkish: 'Kitap Shakespeare tarafından yazıldı.', highlight: 'was written' },
      { english: 'The house is being painted.', turkish: 'Ev boyanıyor.', highlight: 'is being painted' },
      { english: 'The email has been sent.', turkish: 'E-posta gönderildi.', highlight: 'has been sent' }
    ],
    exercises: [
      {
        id: 'ex1',
        type: 'transform',
        question: 'They built this bridge in 1990. (Change to passive)',
        answer: 'This bridge was built in 1990.',
        explanation: 'Move the object to subject position and use "was + past participle".'
      }
    ]
  },
  {
    id: '4',
    title: 'Reported Speech',
    titleTr: 'Dolayli Anlatiş',
    level: 'B2',
    category: 'Speech',
    explanation: 'Used to report what someone said without using their exact words.',
    explanationTr: 'Birinin söylediklerini kendi kelimelerimizle aktarmak icin kullanılır.',
    formula: 'Reporting verb + (that) + clause (with tense shift)',
    examples: [
      { english: '"I am tired" → She said (that) she was tired.', turkish: '"Yorgunum" → Yorgun olduğunu söyledi.', highlight: 'said that she was' },
      { english: '"I will help" → He promised (that) he would help.', turkish: '"Yardim ederim" → Yardim edeceğine söz verdi.', highlight: 'promised that he would' }
    ],
    exercises: [
      {
        id: 'ex1',
        type: 'transform',
        question: '"I love pizza," she said. (Change to reported speech)',
        answer: 'She said (that) she loved pizza.',
        explanation: 'Present simple becomes past simple in reported speech.'
      }
    ]
  }
]

// Ornek deyimler
export const sampleIdioms: Idiom[] = [
  {
    id: '1',
    english: 'Break the ice',
    turkish: 'Buzu kırmak, ortamı ısıtmak',
    literal: 'Buzu kırmak',
    meaning: 'To do or say something to make people feel more relaxed in a social situation.',
    examples: [
      'He told a joke to break the ice at the meeting.',
      'Playing a game is a great way to break the ice at parties.'
    ],
    level: 'B1',
    category: 'Social Situations',
    origin: 'From the practice of breaking ice to allow ships to pass.'
  },
  {
    id: '2',
    english: 'Piece of cake',
    turkish: 'Cok kolay, cocuk oyuncagi',
    literal: 'Bir parca kek',
    meaning: 'Something very easy to do.',
    examples: [
      'The exam was a piece of cake.',
      'Don\'t worry, fixing this is a piece of cake.'
    ],
    level: 'A2',
    category: 'Difficulty',
    origin: 'Eating cake is easy and pleasant.'
  },
  {
    id: '3',
    english: 'Hit the nail on the head',
    turkish: 'Tam isabetli konuşmak, tam üstüne basmak',
    literal: 'Civiyi kafasından vurmak',
    meaning: 'To describe exactly what is causing a situation or problem.',
    examples: [
      'You hit the nail on the head when you said he was lazy.',
      'I think she hit the nail on the head with her analysis.'
    ],
    level: 'B2',
    category: 'Accuracy',
    origin: 'From carpentry - hitting a nail correctly.'
  },
  {
    id: '4',
    english: 'Bite off more than you can chew',
    turkish: 'Altından kalkamayacağı işe girişmek',
    literal: 'Cigneyebileginden fazlasını ısırmak',
    meaning: 'To take on a task that is too big or difficult.',
    examples: [
      'I think I bit off more than I can chew with this project.',
      'She bit off more than she could chew by accepting three jobs.'
    ],
    level: 'B2',
    category: 'Work & Effort',
    origin: 'From the literal difficulty of eating too much at once.'
  },
  {
    id: '5',
    english: 'The ball is in your court',
    turkish: 'Simdi sıra sende, karar sende',
    literal: 'Top senin sahanda',
    meaning: 'It is your turn to take action or make a decision.',
    examples: [
      'I\'ve done my part. The ball is in your court now.',
      'We made an offer. The ball is in their court.'
    ],
    level: 'B2',
    category: 'Decision Making',
    origin: 'From tennis - when the ball is on your side, you must hit it.'
  },
  {
    id: '6',
    english: 'Burn the midnight oil',
    turkish: 'Gece geç saatlere kadar calışmak',
    literal: 'Gece yarısı yağını yakmak',
    meaning: 'To work late into the night.',
    examples: [
      'I had to burn the midnight oil to finish the report.',
      'Students often burn the midnight oil before exams.'
    ],
    level: 'B2',
    category: 'Work & Effort',
    origin: 'From the time when oil lamps were used for lighting.'
  },
  {
    id: '7',
    english: 'Cost an arm and a leg',
    turkish: 'Cok pahalı olmak, kol bacak kesmek',
    literal: 'Bir kol ve bir bacaga mal olmak',
    meaning: 'To be very expensive.',
    examples: [
      'That car cost an arm and a leg.',
      'Living in this city costs an arm and a leg.'
    ],
    level: 'B1',
    category: 'Money',
    origin: 'Emphasizes the high price by referring to body parts.'
  },
  {
    id: '8',
    english: 'Kill two birds with one stone',
    turkish: 'Bir taşla iki kuş vurmak',
    literal: 'Bir taşla iki kuş öldürmek',
    meaning: 'To achieve two things with a single action.',
    examples: [
      'By cycling to work, I can kill two birds with one stone - save money and stay fit.',
      'Let\'s kill two birds with one stone and discuss both topics in one meeting.'
    ],
    level: 'B1',
    category: 'Efficiency',
    origin: 'Ancient proverb about efficiency.'
  }
]

// Ornek cumle kaliplari
export const samplePatterns: SentencePattern[] = [
  {
    id: '1',
    pattern: 'Not only... but also...',
    meaning: 'Hem... hem de... (vurgu icin)',
    level: 'B2',
    examples: [
      { english: 'Not only is she smart, but she is also hardworking.', turkish: 'O sadece akıllı degil, aynı zamanda calışkan.' },
      { english: 'He not only speaks English but also French.', turkish: 'O sadece Ingilizce degil Fransızca da konuşuyor.' }
    ],
    usage: 'Used to add emphasis when mentioning two related things.',
    category: 'Emphasis'
  },
  {
    id: '2',
    pattern: 'The more... the more...',
    meaning: 'Ne kadar... o kadar...',
    level: 'B1',
    examples: [
      { english: 'The more you practice, the better you become.', turkish: 'Ne kadar cok pratik yaparsan, o kadar iyi olursun.' },
      { english: 'The more I learn, the more I realize how little I know.', turkish: 'Ne kadar cok ogreniyorsam, ne kadar az şey bildigimi o kadar anlıyorum.' }
    ],
    usage: 'Used to show that two things change together proportionally.',
    category: 'Comparison'
  },
  {
    id: '3',
    pattern: 'Would rather... than...',
    meaning: '...mektense ...meyi tercih ederim',
    level: 'B1',
    examples: [
      { english: 'I would rather stay home than go to the party.', turkish: 'Partiye gitmektense evde kalmayı tercih ederim.' },
      { english: 'She would rather read than watch TV.', turkish: 'TV izlemektense okumayı tercih eder.' }
    ],
    usage: 'Used to express preference between two options.',
    category: 'Preferences'
  },
  {
    id: '4',
    pattern: 'It\'s high time...',
    meaning: 'Artık ... zamani geldi',
    level: 'B2',
    examples: [
      { english: 'It\'s high time you learned to drive.', turkish: 'Artık araba kullanmayı öğrenme zamanın geldi.' },
      { english: 'It\'s high time we left.', turkish: 'Artık gitme zamanımız geldi.' }
    ],
    usage: 'Used to say that something should have happened already.',
    category: 'Time'
  },
  {
    id: '5',
    pattern: 'No sooner... than...',
    meaning: '...yapar yapmaz...',
    level: 'C1',
    examples: [
      { english: 'No sooner had I arrived than it started raining.', turkish: 'Vardığım anda yağmur yağmaya başladı.' },
      { english: 'No sooner had she finished than the phone rang.', turkish: 'Bitirdiği anda telefon caldi.' }
    ],
    usage: 'Used to say that one thing happens immediately after another.',
    category: 'Time'
  },
  {
    id: '6',
    pattern: 'Had better...',
    meaning: '...mesi/malı daha iyi olur',
    level: 'B1',
    examples: [
      { english: 'You had better study for the exam.', turkish: 'Sınava calışsan iyi olur.' },
      { english: 'We had better leave now or we\'ll be late.', turkish: 'Şimdi gitsek iyi olur yoksa geç kalırız.' }
    ],
    usage: 'Used to give strong advice or warnings.',
    category: 'Advice'
  }
]

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

// Kategoriler
export const wordCategories = [
  'Business & Work',
  'Technology',
  'Travel',
  'Health & Fitness',
  'Food & Cooking',
  'Entertainment',
  'Education',
  'Nature & Environment',
  'Emotions & Feelings',
  'Daily Life',
  'Communication',
  'Success & Achievement',
  'Personality',
  'Life & Philosophy',
  'Work & Productivity'
]

export const grammarCategories = [
  'Tenses',
  'Conditionals',
  'Voice',
  'Speech',
  'Modal Verbs',
  'Articles',
  'Prepositions',
  'Conjunctions',
  'Relative Clauses',
  'Gerunds & Infinitives'
]

export const idiomCategories = [
  'Social Situations',
  'Difficulty',
  'Accuracy',
  'Work & Effort',
  'Decision Making',
  'Money',
  'Efficiency',
  'Time',
  'Emotions',
  'Success'
]
