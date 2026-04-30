export interface BeroProfile {
  name: string
  age: number
  location: string
  goal: string
  ielts_target: string
  ielts_exam: string
  project: string
  application_deadline: string
  universities: string[]
  strengths: string[]
  weaknesses: string[]
}

export interface Memory {
  id: string
  date: string
  summary: string
}

export const DEFAULT_PROFILE: BeroProfile = {
  name: 'Bero',
  age: 18,
  location: 'İstanbul',
  goal: 'ABD/Kanada/Avrupa tam burslu CS',
  ielts_target: '7.0+',
  ielts_exam: 'Eylül 2026',
  project: 'Reborn - AI Life OS',
  application_deadline: 'Kasım 2026',
  universities: ['Berea', 'Grinnell', 'Davidson', 'Macalester', 'Oberlin'],
  strengths: ['Okul başkanlığı', 'Reborn projesi', 'Liderlik'],
  weaknesses: ['IELTS yok henüz', 'GPA zayıf'],
}
