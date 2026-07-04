// Sanchez bağlam rayı — MOCK veri (UI v1). Gerçek veri bağlantısı sonraki
// adımın işi; bu dosya yalnız görsel iskeleti Türkçe/Reborn bağlamıyla
// dolduran statik örneklerdir. Gerçek kaynaklar geldiğinde (goals: lib/db
// dbLoadGoals, hafıza: memories, ajanlar: Faz 4) bu dosya emekli edilir.

export const todayFocus = [
  { id: 't1', label: 'IELTS speaking pratiği — 25 dk', done: true, area: 'İngilizce' },
  { id: 't2', label: 'Essay taslağının girişini bitir', done: false, area: 'Essay' },
  { id: 't3', label: 'Burs başvuru takvimini gözden geçir', done: false, area: 'Burs' },
  { id: 't4', label: 'Günlük kaydını yaz', done: false, area: 'Günlük' },
  { id: 't5', label: 'Reborn — Brain sekmesini test et', done: true, area: 'Reborn' },
]

export const activeGoals = [
  { id: 'g1', title: 'IELTS 7.0+ (Eylül 2026)', progress: 62 },
  { id: 'g2', title: 'Yurt dışı burslu lisans kabulü', progress: 34 },
  { id: 'g3', title: 'Reborn v1 — çalışan hafıza katmanı', progress: 71 },
]

export const memoryInsights = [
  'En verimli yazma saatlerin sabah 6–9 arası — derin işi oraya koyduk.',
  'Burs deadline yaklaştıkça günlük kayıtlarında kaygı teması artıyor.',
  'İngilizce pratiği yaptığın günlerde essay üretimin belirgin artıyor.',
]

export const runningAgents = [
  { name: 'Araştırmacı', task: 'Burs programlarının son tarihlerini tarıyor', pct: 82 },
  { name: 'Yazar', task: 'Essay girişi için 2 taslak hazırlıyor', pct: 45 },
]

export const suggestedActions = [
  'Yarın 7–9 arasını essay için blokla',
  'IELTS deneme sınavı planla',
  'Bu haftanın günlüklerini özetle',
]
