// Office — MOCK veri (UI v1). Yalnız görsel iskeleti dolduran statik Türkçe
// örneklerdir; gerçek ajan/departman altyapısı Faz 4'ün işidir (job queue,
// durum makinesi, MockProvider senaryoları). Bu dosya o altyapı geldiğinde
// emekli edilir. İçerik Reborn'un gerçek bağlamından: IELTS/burs süreci,
// essay üretimi ve Reborn'un kendi geliştirme hikayesi.

import {
  Cpu,
  Compass,
  PenTool,
  Megaphone,
  Workflow,
  Brain,
  type LucideIcon,
} from 'lucide-react'

export type AgentStatus = 'working' | 'review' | 'idle' | 'blocked'

export type Agent = {
  id: string
  name: string
  role: string
  status: AgentStatus
  task: string
  progress: number
  health: number
  costToday: string
  tools: string[]
  memory: string
  activity: { time: string; text: string }[]
}

export type Team = {
  id: string
  name: string
  icon: LucideIcon
  mission: string
  agents: Agent[]
}

function agent(
  id: string,
  name: string,
  role: string,
  status: AgentStatus,
  task: string,
  progress: number,
  health: number,
  costToday: string,
  tools: string[],
  memory: string,
  activity: { time: string; text: string }[],
): Agent {
  return { id, name, role, status, task, progress, health, costToday, tools, memory, activity }
}

export const teams: Team[] = [
  {
    id: 'engineering',
    name: 'Mühendislik',
    icon: Cpu,
    mission: "Reborn'un kendisini inşa eder — modüller, hafıza katmanı, otomasyonlar.",
    agents: [
      agent('e1', 'Forge', 'Full-stack geliştirici', 'working', 'Brain sekmesi — bilgi grafiği görünümü', 72, 96, '$1.24', ['Kod', 'Deploy', 'GitHub'], 'Tercihlerini biliyor: Next.js, sade UI, nötr tasarım dili.', [
        { time: '2 dk', text: 'Entity grafiği için düğüm bileşenini yazdı' },
        { time: '18 dk', text: 'Obsidian senkronundaki tarih hatasını düzeltti' },
        { time: '1 sa', text: 'Önizleme build aldı' },
      ]),
      agent('e2', 'Sentry', 'Güvenilirlik ajanı', 'idle', '6 otomasyonu izliyor', 100, 99, '$0.09', ['Loglar', 'Uyarılar'], 'Her workflow için taban çalışma süresi hedefleri.', [
        { time: '30 dk', text: 'Tüm sistemler normal' },
      ]),
    ],
  },
  {
    id: 'research',
    name: 'Araştırma',
    icon: Compass,
    mission: 'Hedeflerini ilerleten her şeyi bulur, okur ve sentezler.',
    agents: [
      agent('r1', 'Atlas', 'Baş araştırmacı', 'working', '12 burs programının son tarihlerini tarıyor', 88, 94, '$2.02', ['Web', 'Arşiv', 'RAG'], 'Yurt dışı burslu lisans + IELTS odağını takip ediyor.', [
        { time: 'şimdi', text: '3 yeni uygun burs programı buldu' },
        { time: '12 dk', text: 'IELTS writing band tanımlarını özetledi' },
      ]),
      agent('r2', 'Quill', 'Doğrulayıcı', 'review', 'Essay kaynaklarını doğruluyor', 54, 91, '$0.61', ['Arama', 'Atıf'], 'Birincil kaynakları tercih eder.', [
        { time: '5 dk', text: '1 zayıf atıf işaretledi' },
      ]),
    ],
  },
  {
    id: 'content',
    name: 'İçerik',
    icon: PenTool,
    mission: 'Fikirlerini ve sesini bitmiş yazıya dönüştürür.',
    agents: [
      agent('c1', 'Yazar', 'Metin yazarı', 'working', 'Essay girişi — 2 taslak varyant', 62, 97, '$1.48', ['Taslak', 'Ses', 'Düzenleme'], 'Yansıtıcı-ama-iddialı tonunu öğrendi.', [
        { time: 'şimdi', text: 'B varyantını yazıyor — yansıtıcı ton' },
        { time: '9 dk', text: 'Giriş kancası için günlükten alıntı çekti' },
      ]),
      agent('c2', 'Editör', 'Satır editörü', 'idle', 'Taslak teslimini bekliyor', 100, 98, '$0.22', ['Dilbilgisi', 'Üslup'], 'Netliği zorunlu kılar, dolguyu keser.', [
        { time: '20 dk', text: 'Burs niyet mektubu özetini temizledi' },
      ]),
    ],
  },
  {
    id: 'marketing',
    name: 'Pazarlama',
    icon: Megaphone,
    mission: 'Görünürlüğünü ve kişisel markanı büyütür.',
    agents: [
      agent('m1', 'Echo', 'Dağıtım', 'blocked', 'İçerik takvimi — başlık onayı bekliyor', 20, 72, '$0.40', ['Sosyal', 'Takvim'], 'En iyi paylaşım saatlerini analizden öğrendi.', [
        { time: '15 dk', text: 'Engellendi: İçerik ekibinden başlık bekliyor' },
      ]),
    ],
  },
  {
    id: 'automation',
    name: 'Otomasyon',
    icon: Workflow,
    mission: 'Tüm şirketi güvenilir workflow’larla birbirine bağlar.',
    agents: [
      agent('a1', 'Relay', 'Orkestratör', 'working', '"Günlük burs taraması" hattını çalıştırıyor', 73, 95, '$0.55', ['Tetikleyiciler', 'Yönlendirme'], 'Ekipler arası bağımlılık haritasını tutar.', [
        { time: 'şimdi', text: 'Devir: Araştırma → Yazar' },
      ]),
    ],
  },
  {
    id: 'knowledge',
    name: 'Bilgi',
    icon: Brain,
    mission: "Şirketin öğrendiklerini Brain'e — ikinci beynine — işler.",
    agents: [
      agent('k1', 'Arşivci', 'Bilgi bekçisi', 'working', '12 yeni notu entity çekirdeğine indeksliyor', 90, 98, '$0.19', ['Obsidian', 'Embedding'], 'Yeni içgörüleri mevcut notlara bağlar.', [
        { time: '4 dk', text: 'IELTS notunu essay entity’sine bağladı' },
      ]),
    ],
  },
]

export type WorkflowState = 'done' | 'active' | 'queued'

export const workflow: { name: string; agent: string; state: WorkflowState }[] = [
  { name: 'Araştırma', agent: 'Atlas', state: 'done' },
  { name: 'Taslak', agent: 'Yazar', state: 'active' },
  { name: 'Doğrulama', agent: 'Quill', state: 'active' },
  { name: 'Düzenleme', agent: 'Editör', state: 'queued' },
  { name: 'Arşivleme', agent: 'Arşivci', state: 'queued' },
  { name: 'Günlük Rapor', agent: 'Relay', state: 'queued' },
]
