import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'
import { dbToggleHabitLog, dbExecuteAction } from './db'

const BERO_ID = process.env.NEXT_PUBLIC_BERO_ID ?? '00000000-0000-0000-0000-000000000001'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const CLAUDE_MODEL = 'claude-sonnet-4-6'

// ─── Custom tool definitions ───────────────────────────────────────────────────

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_habits',
    description: 'Bu haftanın alışkanlık loglarını ve habits tablosundaki habit listesini okur.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'read_memories',
    description: 'memories tablosundan Bero hakkındaki hafızaları okur. type veya tags ile filtrelenebilir.',
    input_schema: {
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
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'read_modules',
    description: "modules tablosundan Bero'nun modüllerini okur.",
    input_schema: {
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
    input_schema: {
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
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'toggle_habit',
    description: 'Bir alışkanlığı belirli bir tarih için tamamlandı / tamamlanmadı olarak işaretler.',
    input_schema: {
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
    description: "Bero hakkında önemli bir bilgiyi memories tablosuna kaydeder.",
    input_schema: {
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
    name: 'update_profile',
    description: "Bero'nun profilindeki bir değeri user_profile tablosunda günceller.",
    input_schema: {
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
    input_schema: {
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
    input_schema: {
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
    input_schema: {
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
    input_schema: {
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
    name: 'add_scholarship',
    description: "Burs başvurusu için bir üniversiteyi library ve scholarship modülüne ekler.",
    input_schema: {
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
]

// Built-in web search — Anthropic sunucuları tarafından işlenir
export const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305' as const,
  name: 'web_search',
} as unknown as Anthropic.Tool

// ─── Tool executor ─────────────────────────────────────────────────────────────

export async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {

    case 'read_habits': {
      const { data: habits } = await supabase
        .from('habits').select('id, name, emoji, order_index')
        .eq('active', true).order('order_index')

      const today = new Date()
      const dow   = today.getDay() === 0 ? 6 : today.getDay() - 1
      const start = new Date(today)
      start.setDate(today.getDate() - dow)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      const fmt = (d: Date) => d.toISOString().slice(0, 10)

      const { data: logs } = await supabase
        .from('habit_logs').select('habit_id, date, completed')
        .eq('user_id', BERO_ID).gte('date', fmt(start)).lte('date', fmt(end))

      return { habits: habits ?? [], logs: logs ?? [], week: { start: fmt(start), end: fmt(end) } }
    }

    case 'read_memories': {
      const { type, tags, limit = 20 } = input as { type?: string; tags?: string[]; limit?: number }
      let q = supabase.from('memories')
        .select('id, summary, content, type, tags, importance, date')
        .eq('user_id', BERO_ID)
      if (type) q = q.eq('type', type)
      if (tags?.length) q = q.overlaps('tags', tags)
      const { data } = await q.order('importance', { ascending: false }).limit(limit)
      return data ?? []
    }

    case 'read_profile': {
      const [{ data: profile }, { data: userProfile }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', BERO_ID).single(),
        supabase.from('user_profile').select('key, value'),
      ])
      return { profile, user_profile: userProfile ?? [] }
    }

    case 'read_modules': {
      const { module_id } = input as { module_id?: string }
      let q = supabase.from('modules').select('id, name, icon, color, data').eq('user_id', BERO_ID)
      if (module_id) q = q.eq('id', module_id)
      const { data } = await q
      return data ?? []
    }

    case 'read_library': {
      const { category, limit = 20 } = input as { category?: string; limit?: number }
      let q = supabase.from('library').select('id, title, content, source, category, created_at')
      if (category) q = q.eq('category', category)
      const { data } = await q.order('created_at', { ascending: false }).limit(limit)
      return data ?? []
    }

    case 'read_conversations': {
      const { data } = await supabase.from('conversations')
        .select('id, title, created_at').order('created_at', { ascending: false }).limit(10)
      return data ?? []
    }

    case 'toggle_habit': {
      const { habit_id, date, completed } = input as { habit_id: string; date: string; completed: boolean }
      await dbToggleHabitLog(date, habit_id, completed)
      return { ok: true, habit_id, date, completed }
    }

    case 'save_memory': {
      const { content, importance = 5, tags = [], type = 'general' } = input as {
        content: string; importance?: number; tags?: string[]; type?: string
      }
      const date = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      const { error } = await supabase.from('memories').insert({
        user_id: BERO_ID, content, summary: content, importance, tags, type, date,
      })
      if (error) throw error
      return { ok: true }
    }

    case 'update_profile': {
      const { key, value } = input as { key: string; value: string }
      const { error } = await supabase.from('user_profile')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (error) throw error
      return { ok: true, key, value }
    }

    case 'save_to_library': {
      const { title, content, source, category } = input as {
        title: string; content: string; source?: string; category?: string
      }
      const { error } = await supabase.from('library').insert({
        title, content, source, category, saved_by_agent: 'sanchez',
      })
      if (error) throw error
      return { ok: true }
    }

    case 'log_agent_action': {
      const { agent_name, action, result } = input as {
        agent_name: string; action: string; result?: string
      }
      const { error } = await supabase.from('agent_logs').insert({ agent_name, action, result })
      if (error) throw error
      return { ok: true }
    }

    case 'update_module': {
      const { module_id, data } = input as { module_id: string; data: Record<string, unknown> }
      await dbExecuteAction({ type: 'UPDATE_MODULE', payload: { id: module_id, patch: data } })
      return { ok: true }
    }

    case 'add_roadmap_item': {
      const { title, deadline, type = 'milestone', notes } = input as {
        title: string; deadline: string; type?: string; notes?: string
      }
      await dbExecuteAction({
        type: 'APPEND_TO_FIELD',
        payload: {
          id: 'roadmap',
          field: 'milestones',
          item: { title, date: deadline, type, notes: notes ?? '', status: 'pending' },
        },
      })
      return { ok: true }
    }

    case 'add_scholarship': {
      const { university, country, deadline, notes } = input as {
        university: string; country: string; deadline: string; notes?: string
      }
      await Promise.all([
        supabase.from('library').insert({
          title: university, content: notes ?? '', source: country,
          category: 'scholarship', saved_by_agent: 'sanchez',
        }),
        dbExecuteAction({
          type: 'ADD_ITEM_TO_FIELD',
          payload: {
            id: 'scholarship',
            field: 'universities',
            item: { name: university, country, deadline, notes: notes ?? '' },
          },
        }).catch(() => {}),
      ])
      return { ok: true }
    }

    default:
      // web_search ve diğer server-side built-in tool'lar buraya düşer
      return { ok: true, note: 'server-handled' }
  }
}
