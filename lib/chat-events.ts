// /api/chat NDJSON akış protokolü — sunucu (app/api/chat/route.ts) ve istemci
// (components/chat/useSanchezChat.ts) arasında paylaşılan olay tipi. Her satır
// tek bir JSON olayıdır (satır sonu '\n' ile ayrılır).
export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; name: string }
  | { type: 'tool_end'; name: string; ok: boolean }
  | { type: 'done' }
  | { type: 'error'; message: string }

// Araç adından kullanıcıya gösterilecek Türkçe durum metni.
const TOOL_STATUS_LABELS: Record<string, string> = {
  read_habits:        'alışkanlıkları okuyor',
  read_memories:       'hafızayı tarıyor',
  read_profile:        'profili okuyor',
  read_modules:        'modülleri okuyor',
  read_library:        'kütüphaneyi tarıyor',
  read_conversations:  'geçmiş sohbetleri okuyor',
  toggle_habit:        'alışkanlık işaretliyor',
  save_memory:         'hafızaya kaydediyor',
  update_profile:      'profili güncelliyor',
  save_to_library:     'kütüphaneye kaydediyor',
  log_agent_action:    'kaydı işliyor',
  update_module:       'modülü güncelliyor',
  add_roadmap_item:    'yol haritasına ekliyor',
  add_scholarship:     'burs ekliyor',
  run_agent:           'bir ajanı çalıştırıyor',
  web_search:          "web'de araştırıyor",
}

export function toolStatusLabel(name: string): string {
  return TOOL_STATUS_LABELS[name] ?? `${name} aracını kullanıyor`
}
