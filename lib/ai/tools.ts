import type { AIToolDef } from './provider'
import { BRAIN_TOOLS } from '../brain/tools'
import { SOURCE_TOOLS } from '../knowledge/source-tools'

// Sanchez ve ajanların custom tool tanımları — provider-bağımsız şema
// (lib/anthropic.ts'ten taşındı). Davranışları lib/agents/executor.ts
// serverExecuteTool() switch'inde; yeni tool eklerken İKİSİNİ birlikte güncelle.
// Anthropic'e çeviri AnthropicProvider içinde yapılır (inputSchema → input_schema).
//
// brain_* tool'ları (lib/brain/tools.ts) dosya sonunda bu merkezi listeye
// birleştirilir — ayrı ikinci tool sistemi yok. Kim hangi brain tool'unu
// kullanabilir ayrımı registry'deki toolNames listeleriyle yapılır (yapısal/
// isimsel — gerçek yetkilendirme değil); tanım açıklamaları da bunu belirtir.

/** Tool döngüsü üst sınırı (tool-yürütme turu sayısı) — hem Sanchez chat
 *  route'u (app/api/chat/route.ts) hem ajan runner'ı (lib/agents/runner.ts)
 *  BU sabiti kullanır; ikinci bir sabit tanımlama, buradan import et.
 *  Değer seçimi: en ağır meşru senaryo, Knowledge Agent'ın 10 bekleyen
 *  sinyali tool çağrılarını batch'lemeden tek tek entegre etmesi (~11-14
 *  tur); Sanchez'in en ağır akışı (read_essays → run_agent) ≤3 tur. 16,
 *  bunların üstünde ama kaçak/sonsuz döngünün maliyetini yine de keser. */
export const MAX_TOOL_ITERATIONS = 16

export const TOOLS: AIToolDef[] = [
  {
    name: 'read_habits',
    description: 'Bu haftanın alışkanlık loglarını ve habits tablosundaki habit listesini okur.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'read_memories',
    description: 'memories tablosundan Bero hakkındaki hafızaları okur. type veya tags ile filtrelenebilir.',
    inputSchema: {
      type: 'object',
      properties: {
        type:  { type: 'string', description: 'Filtre: general, goal, user_fact, project vb.' },
        tags:  { type: 'array', items: { type: 'string' }, description: 'Filtre için etiketler' },
        limit: { type: 'number', description: 'Maksimum kayıt sayısı (varsayılan: 20)' },
      },
      required: [],
    },
  },
  {
    name: 'read_profile',
    description: "Bero'nun profilini profiles ve user_profile tablolarından okur.",
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'read_modules',
    description: "modules tablosundan Bero'nun modüllerini okur.",
    inputSchema: {
      type: 'object',
      properties: {
        module_id: { type: 'string', description: 'Belirli bir modül ID (opsiyonel)' },
      },
      required: [],
    },
  },
  {
    name: 'read_library',
    description: 'library tablosundan kayıtlı içerikleri okur.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Kategori: scholarship, resource, book, note vb.' },
        limit:    { type: 'number', description: 'Maksimum kayıt sayısı (varsayılan: 20)' },
      },
      required: [],
    },
  },
  {
    name: 'read_conversations',
    description: 'Son 10 sohbetin başlıklarını conversations tablosundan okur.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'toggle_habit',
    description: 'Bir alışkanlığı belirli bir tarih için tamamlandı / tamamlanmadı olarak işaretler.',
    inputSchema: {
      type: 'object',
      properties: {
        habit_id:  { type: 'string',  description: 'Habit ID: sleep, eat, study, exercise vb.' },
        date:      { type: 'string',  description: 'Tarih YYYY-MM-DD formatında' },
        completed: { type: 'boolean', description: 'true = tamamlandı, false = işareti kaldır' },
      },
      required: ['habit_id', 'date', 'completed'],
    },
  },
  {
    name: 'save_memory',
    description: "Bero hakkında önemli bir bilgiyi hafızaya kaydeder (memories + Brain'e embedding'li entity — sonraki sohbetlerde retrieval ile bağlama geri gelir).",
    inputSchema: {
      type: 'object',
      properties: {
        content:    { type: 'string', description: 'Kaydedilecek bilgi' },
        importance: { type: 'number', description: '1-10 arası önem skoru (varsayılan: 5)' },
        tags:       { type: 'array', items: { type: 'string' }, description: 'Etiketler' },
        type:       { type: 'string', description: 'Tip: general, goal, user_fact, project, habit vb.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'save_goal',
    description:
      'Yeni bir hedef (goal) yaratır — Faz 2 goal sistemi: native entity + goals uzantısı, embedding sunucuda. Onboarding tanışma sohbetinin onaylanan hedefi de bununla yazılır.',
    inputSchema: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: 'Hedef başlığı' },
        description: { type: 'string', description: 'Hedefin açıklaması (opsiyonel)' },
        target_date: { type: 'string', description: 'Hedef tarihi YYYY-MM-DD (opsiyonel)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_profile',
    description: "Bero'nun profilindeki bir değeri user_profile tablosunda günceller.",
    inputSchema: {
      type: 'object',
      properties: {
        key:   { type: 'string', description: 'Profil anahtarı: ielts_target, location, goal vb.' },
        value: { type: 'string', description: 'Yeni değer' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'save_to_library',
    description: 'Bir içeriği, kaynağı veya notu library tablosuna kaydeder.',
    inputSchema: {
      type: 'object',
      properties: {
        title:    { type: 'string', description: 'Başlık' },
        content:  { type: 'string', description: 'İçerik veya açıklama' },
        source:   { type: 'string', description: 'Kaynak URL veya isim' },
        category: { type: 'string', description: 'Kategori: scholarship, resource, book, note vb.' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'log_agent_action',
    description: 'Yapılan bir agent eylemini agent_logs tablosuna kaydeder.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_name: { type: 'string', description: 'Agent adı: sanchez, kesif vb.' },
        action:     { type: 'string', description: 'Yapılan eylem' },
        result:     { type: 'string', description: 'Sonuç veya özet' },
      },
      required: ['agent_name', 'action'],
    },
  },
  {
    name: 'update_module',
    description: "Bir modülün data alanını günceller (patch olarak uygulanır).",
    inputSchema: {
      type: 'object',
      properties: {
        module_id: { type: 'string', description: 'Modül ID: english, roadmap, finance, body vb.' },
        data:      { type: 'object', description: 'Güncellenecek alanlar (key-value patch)' },
      },
      required: ['module_id', 'data'],
    },
  },
  {
    name: 'add_roadmap_item',
    description: 'Yol haritasına yeni bir milestone veya hedef ekler.',
    inputSchema: {
      type: 'object',
      properties: {
        title:    { type: 'string', description: 'Milestone başlığı' },
        deadline: { type: 'string', description: 'Son tarih YYYY-MM-DD formatında' },
        type:     { type: 'string', description: 'milestone, task veya goal (varsayılan: milestone)' },
        notes:    { type: 'string', description: 'Ek notlar (opsiyonel)' },
      },
      required: ['title', 'deadline'],
    },
  },
  {
    name: 'read_essays',
    description: "Kullanıcının essay'lerini ve her birinin SON versiyon metnini okur. essay-critic'i çalıştırmadan önce taslağı almak için kullan.",
    inputSchema: {
      type: 'object',
      properties: {
        essay_id: { type: 'string', description: 'Belirli bir essay ID (opsiyonel — verilmezse hepsi listelenir)' },
      },
      required: [],
    },
  },
  {
    name: 'run_agent',
    description: 'Bir MAXAİ departman ajanını çalıştırır ve sonucunu döndürür. Hepsi taslak-üreticidir — dış dünyaya eylem yapmaz. Strateji, içerik, teknik tasarım, müşteri objective\'i veya analiz taslağı gerektiren işler için kullan.',
    inputSchema: {
      type: 'object',
      properties: {
        agentName: {
          type: 'string',
          description: 'Çalıştırılacak ajan: growth-agent | creative-agent | builder-agent | client-success-agent | operations-agent | knowledge-agent',
        },
        agentInput: {
          type: 'object',
          description: 'Ajana gönderilecek girdi verileri (ajana göre değişir)',
        },
      },
      required: ['agentName', 'agentInput'],
    },
  },
  {
    name: 'add_scholarship',
    description: "Burs başvurusu için bir üniversiteyi library ve scholarship modülüne ekler.",
    inputSchema: {
      type: 'object',
      properties: {
        university: { type: 'string', description: 'Üniversite adı' },
        country:    { type: 'string', description: 'Ülke' },
        deadline:   { type: 'string', description: 'Başvuru son tarihi' },
        notes:      { type: 'string', description: 'Burs miktarı, gereksinimler vb. (opsiyonel)' },
      },
      required: ['university', 'country', 'deadline'],
    },
  },

  // Agent Brain tool'ları — tanımlar lib/brain/tools.ts'te yaşar,
  // davranışlar executor'da (brain_* case'leri).
  ...BRAIN_TOOLS,

  // Dış kaynak fetch tool'ları — tanımlar lib/knowledge/source-tools.ts'te,
  // davranışlar (github.com whitelist'i dahil) lib/knowledge/source-fetcher.ts'te,
  // executor'da fetch_source_* case'leri. SADECE Knowledge Agent kullanır.
  ...SOURCE_TOOLS,
]
