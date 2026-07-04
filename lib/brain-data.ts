// Brain — MOCK graf verisi (UI v1). Görsel iskeleti dolduran statik Türkçe
// örneklerdir; gerçek kaynak Faz 1 çekirdeğidir (entities/links tabloları,
// migration 0001) ve bağlantı sonraki adımın işidir. İçerik Reborn'un
// gerçek bağlamından: IELTS/burs süreci, modüller ve Reborn'un kendi
// geliştirme hikayesi.

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
}

export const notes: Note[] = [
  {
    id: 'burs',
    label: 'Yurt dışı burs',
    x: 500,
    y: 350,
    size: 'hub',
    tags: ['#hedef', '#burs'],
    updated: '2 sa önce',
    body: 'Bu dönemin düzenleyici hedefi: yurt dışında burslu lisans. Essay, IELTS ve başvuru takvimi kümelerinin hepsi buraya çıkar.',
    links: ['essay', 'ielts', 'basvuru-takvimi', 'hedefler', 'gunluk'],
  },
  {
    id: 'ielts',
    label: 'IELTS 7.0+',
    x: 285,
    y: 210,
    size: 'hub',
    tags: ['#hedef', '#ingilizce'],
    updated: '5 sa önce',
    body: 'Eylül 2026 sınavı. Speaking en zayıf halka; pratik yapılan günlerde essay üretimi de artıyor — Sanchez’in yakaladığı desen.',
    links: ['speaking', 'kelime', 'burs', 'essay'],
  },
  {
    id: 'speaking',
    label: 'Speaking pratiği',
    x: 140,
    y: 120,
    size: 'mid',
    tags: ['#ingilizce', '#rutin'],
    updated: '12 dk önce',
    body: 'Günde 25 dk sesli pratik. Part 2 anlatılarında akıcılık gözle görülür arttı; kayıtlar kelime defterini besliyor.',
    links: ['ielts', 'kelime', 'disiplin'],
  },
  {
    id: 'kelime',
    label: 'Kelime defteri',
    x: 175,
    y: 300,
    size: 'leaf',
    tags: ['#ingilizce'],
    updated: '1 gün önce',
    body: 'Akademik kelime listesi + speaking kayıtlarından çıkan yeni ifadeler. Haftalık tekrar döngüsüyle işleniyor.',
    links: ['ielts', 'speaking'],
  },
  {
    id: 'essay',
    label: 'Motivasyon essay’i',
    x: 690,
    y: 210,
    size: 'hub',
    tags: ['#yazi', '#burs'],
    updated: 'şimdi',
    body: 'Başvurunun kalbi. Teknik kısmı sağlam; girişin duygusal gerçeği günlükten gelecek. İki AI taslağı incelemede.',
    links: ['burs', 'ielts', 'gunluk', 'yazma'],
  },
  {
    id: 'yazma',
    label: 'Yazma zanaatı',
    x: 820,
    y: 130,
    size: 'mid',
    tags: ['#beceri'],
    updated: '2 gün önce',
    body: 'Ses, netlik ve yapı üzerine notlar. Hedef ton: yansıtıcı ama iddialı.',
    links: ['essay', 'gunluk'],
  },
  {
    id: 'basvuru-takvimi',
    label: 'Başvuru takvimi',
    x: 400,
    y: 500,
    size: 'mid',
    tags: ['#burs', '#takvim'],
    updated: '4 sa önce',
    body: 'Program bazlı son tarihler ve gerekli belgeler. Araştırma ajanı Atlas feed’leri günlük tarıyor.',
    links: ['burs', 'hedefler'],
  },
  {
    id: 'gunluk',
    label: 'Günlük',
    x: 350,
    y: 380,
    size: 'mid',
    tags: ['#modul', '#gunluk'],
    updated: '06:42',
    body: 'Ham malzemenin yaşadığı yer. Essay girişi, hedeflerin çoğu ve Sanchez’in desenleri burada doğdu. Her kayıt hafıza çekirdeğine işleniyor.',
    links: ['essay', 'hafiza', 'disiplin', 'burs'],
  },
  {
    id: 'hedefler',
    label: 'Hedefler',
    x: 560,
    y: 540,
    size: 'mid',
    tags: ['#modul', '#hedef'],
    updated: '1 gün önce',
    body: '"Kim olmak istiyorsun" sorusunun ölçülebilir hali: ana hedefler, alt hedefler ve graf bağlantıları. Native entity olarak yaşıyor.',
    links: ['burs', 'basvuru-takvimi', 'hafiza'],
  },
  {
    id: 'disiplin',
    label: 'Disiplin & rutin',
    x: 230,
    y: 470,
    size: 'leaf',
    tags: ['#sistem'],
    updated: '07:00',
    body: 'Derin çalışma 6–9 arası. Sabah rutini oturduğunda hem speaking hem yazı üretimi artıyor.',
    links: ['gunluk', 'speaking'],
  },
  {
    id: 'reborn',
    label: 'Reborn projesi',
    x: 760,
    y: 430,
    size: 'hub',
    tags: ['#proje', '#reborn'],
    updated: '3 sa önce',
    body: 'Kişisel Life OS — bu ekranın kendisi. Tek bağlantılı hafıza, tek muhatap Sanchez. Şu an Faz 3: yüzey ve tasarım sistemi.',
    links: ['hafiza', 'sanchez', 'obsidian', 'faz1'],
  },
  {
    id: 'hafiza',
    label: 'Hafıza çekirdeği',
    x: 620,
    y: 380,
    size: 'mid',
    tags: ['#reborn', '#mimari'],
    updated: '1 sa önce',
    body: 'Tek entities + links + memories sistemi (migration 0001). Journal, goal ve notlar aynı grafta buluşur — Brain’in fiziksel temeli.',
    links: ['reborn', 'gunluk', 'hedefler', 'faz1', 'obsidian'],
  },
  {
    id: 'faz1',
    label: 'Faz 1 — entity çekirdeği',
    x: 880,
    y: 330,
    size: 'leaf',
    tags: ['#reborn', '#tarihce'],
    updated: '3 Tem',
    body: 'pgvector + bge-m3 embedding + hibrit retrieval canlıya alındı. Reborn’un geliştirme hikayesindeki ilk büyük dönemeç.',
    links: ['reborn', 'hafiza'],
  },
  {
    id: 'sanchez',
    label: 'Sanchez',
    x: 870,
    y: 520,
    size: 'mid',
    tags: ['#reborn', '#karakter'],
    updated: '30 dk önce',
    body: 'Sistemin tek muhatabı: mentor kimlikli, soru soran, hatırlayan. Her modülün verisi onun bağlamına akar.',
    links: ['reborn', 'hafiza'],
  },
  {
    id: 'obsidian',
    label: 'Obsidian kasası',
    x: 640,
    y: 560,
    size: 'leaf',
    tags: ['#kaynak'],
    updated: '2 sa önce',
    body: "Brain'e veri sağlayan kaynaklardan biri (ileride GitHub, Drive…). Notlar entity olarak içe alınır, [[wikilink]]'ler graf bağlantısına dönüşür.",
    links: ['reborn', 'hafiza'],
  },
]

export const noteById = Object.fromEntries(notes.map((n) => [n.id, n]))

export const edges = (() => {
  const seen = new Set<string>()
  const out: { source: string; target: string }[] = []
  for (const n of notes) {
    for (const l of n.links) {
      const key = [n.id, l].sort().join('|')
      if (seen.has(key) || !noteById[l]) continue
      seen.add(key)
      out.push({ source: n.id, target: l })
    }
  }
  return out
})()

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
