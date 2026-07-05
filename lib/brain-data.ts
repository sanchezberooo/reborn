// Brain — Not tipi ve hâlâ mock kalan paneller. Graf artık gerçek entities/
// links çekirdeğinden gelir (lib/db-server.ts getBrainGraph + lib/brain-layout.ts
// buildBrainView); bu dosyada yalnızca KnowledgeGraph'ın beklediği ortak `Note`
// tipi ve "Sanchez'in fark ettiği bağlantı" tarzı analiz gerektiren paneller
// kalıyor — o gerçek davranış Faz AI'nın işi (bkz. görev kuralları).

import type { EntityType } from './db-server'

export type Note = {
  id: string
  label: string
  x: number
  y: number
  size: 'hub' | 'mid' | 'leaf'
  tags: string[]
  updated: string
  body: string
  links: string[]
  /** İçeriğe git linki için (components/brain/Brain.tsx) — KnowledgeGraph'ın
   *  görsel mantığı bu alanı hiç okumaz. */
  entityType?: EntityType
}

export const discoveries = [
  { text: 'Speaking pratiği yapılan günlerde essay üretimi %40 artıyor', by: 'Sanchez', time: '06:12' },
  { text: '"Sabah rutini" notu 3 bağlantısız günlük kaydıyla ilişkili', by: 'Arşivci ajan', time: 'dün' },
  { text: 'Burs kaygısı teması son 2 haftada 4 günlük kaydında geçti', by: 'Sanchez', time: '2 gün önce' },
]

export const dailyNotes = [
  { date: 'Bugün', title: '4 Tem — essay girişi açıldı', words: 412 },
  { date: 'Dün', title: '3 Tem — Faz 1 çekirdeği canlıda', words: 268 },
  { date: 'Çar', title: '2 Tem — burs kısa listesi', words: 190 },
  { date: 'Sal', title: '1 Tem — haftalık değerlendirme', words: 540 },
]
