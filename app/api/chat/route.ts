import type { BetaToolUseBlock, BetaMessageParam, BetaToolResultBlockParam, BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { anthropic, CLAUDE_MODEL, TOOLS, WEB_SEARCH_TOOL } from '@/lib/anthropic'
import { buildSystemPrompt } from '@/lib/openai'
import { getSupabaseServer } from '@/lib/supabase-server'
import type { ModuleItem } from '@/lib/modules'

async function serverExecuteTool(
  name: string,
  input: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  switch (name) {
    case 'read_habits': {
      const { data: habits } = await supabase
        .from('habits').select('id, name, emoji, order_index')
        .eq('user_id', userId).eq('active', true).order('order_index')

      const today = new Date()
      const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
      const start = new Date(today); start.setDate(today.getDate() - dow)
      const end = new Date(start); end.setDate(start.getDate() + 6)
      const fmt = (d: Date) => d.toISOString().slice(0, 10)

      const { data: logs } = await supabase
        .from('habit_logs').select('habit_id, date, completed')
        .eq('user_id', userId).gte('date', fmt(start)).lte('date', fmt(end))

      return { habits: habits ?? [], logs: logs ?? [], week: { start: fmt(start), end: fmt(end) } }
    }

    case 'read_memories': {
      const { type, tags, limit = 20 } = input as { type?: string; tags?: string[]; limit?: number }
      let q = supabase.from('memories')
        .select('id, summary, content, type, tags, importance, date')
        .eq('user_id', userId)
      if (type) q = q.eq('type', type)
      if (tags?.length) q = q.overlaps('tags', tags)
      const { data } = await q.order('importance', { ascending: false }).limit(limit)
      return data ?? []
    }

    case 'read_profile': {
      const [{ data: profile }, { data: userProfile }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_profile').select('key, value').eq('user_id', userId),
      ])
      return { profile, user_profile: userProfile ?? [] }
    }

    case 'read_modules': {
      const { module_id } = input as { module_id?: string }
      let q = supabase.from('modules').select('id, name, icon, color, data').eq('user_id', userId)
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
        .select('id, title, created_at').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(10)
      return data ?? []
    }

    case 'toggle_habit': {
      const { habit_id, date, completed } = input as { habit_id: string; date: string; completed: boolean }
      if (completed) {
        await supabase.from('habit_logs').upsert(
          { user_id: userId, date, habit_id, completed: true },
          { onConflict: 'user_id,date,habit_id' }
        )
      } else {
        await supabase.from('habit_logs').delete()
          .eq('user_id', userId).eq('date', date).eq('habit_id', habit_id)
      }
      return { ok: true, habit_id, date, completed }
    }

    case 'save_memory': {
      const { content, importance = 5, tags = [], type = 'general' } = input as {
        content: string; importance?: number; tags?: string[]; type?: string
      }
      const date = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      const { error } = await supabase.from('memories').insert({
        user_id: userId, content, summary: content, importance, tags, type, date,
      })
      if (error) throw error
      return { ok: true }
    }

    case 'update_profile': {
      const { key, value } = input as { key: string; value: string }
      const { error } = await supabase.from('user_profile')
        .upsert({ key, value, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'key' })
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
      const { data: row } = await supabase.from('modules').select('data')
        .eq('user_id', userId).eq('id', module_id).single()
      const base = (row?.data as Record<string, unknown>) ?? {}
      await supabase.from('modules')
        .update({ data: { ...base, ...data }, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('id', module_id)
      return { ok: true }
    }

    case 'add_roadmap_item': {
      const { title, deadline, type = 'milestone', notes } = input as {
        title: string; deadline: string; type?: string; notes?: string
      }
      const { data: row } = await supabase.from('modules').select('data')
        .eq('user_id', userId).eq('id', 'roadmap').single()
      const base = (row?.data as Record<string, unknown>) ?? {}
      const milestones = (base.milestones as unknown[]) ?? []
      await supabase.from('modules')
        .update({
          data: { ...base, milestones: [...milestones, { title, date: deadline, type, notes: notes ?? '', status: 'pending' }] },
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId).eq('id', 'roadmap')
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
        (async () => {
          const { data: row } = await supabase.from('modules').select('data')
            .eq('user_id', userId).eq('id', 'scholarship').single()
          const base = (row?.data as Record<string, unknown>) ?? {}
          const universities = (base.universities as unknown[]) ?? []
          const newItem = { name: university, country, deadline, notes: notes ?? '' }
          const exists = universities.some((u: unknown) => {
            if (u !== null && typeof u === 'object') {
              return String((u as Record<string,unknown>).name ?? '').toLowerCase() === university.toLowerCase()
            }
            return false
          })
          if (!exists) {
            await supabase.from('modules')
              .update({ data: { ...base, universities: [...universities, newItem] }, updated_at: new Date().toISOString() })
              .eq('user_id', userId).eq('id', 'scholarship')
          }
        })().catch(() => {}),
      ])
      return { ok: true }
    }

    default:
      return { ok: true, note: 'server-handled' }
  }
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('ANTHROPIC_API_KEY eksik. .env.local dosyasına ekle.', { status: 503 })
  }

  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { messages, lastConversation, activeModule } = (await req.json()) as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    lastConversation?: { role: string; content: string }[]
    activeModule?: ModuleItem
  }

  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [profileResult, memoriesResult] = await Promise.allSettled([
    adminClient.from('profiles').select('*').eq('id', user.id).single(),
    adminClient.from('memories').select('id, summary, date').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(5),
  ])

  const { DEFAULT_PROFILE } = await import('@/lib/memory')
  const profileData = profileResult.status === 'fulfilled' ? profileResult.value.data : null
  const profile = profileData ? {
    name: profileData.name ?? DEFAULT_PROFILE.name,
    age: profileData.age ?? DEFAULT_PROFILE.age,
    location: profileData.location ?? DEFAULT_PROFILE.location,
    goal: profileData.goal ?? DEFAULT_PROFILE.goal,
    ielts_target: profileData.ielts_target ?? DEFAULT_PROFILE.ielts_target,
    ielts_exam: profileData.ielts_exam ?? DEFAULT_PROFILE.ielts_exam,
    project: profileData.project ?? DEFAULT_PROFILE.project,
    application_deadline: profileData.application_deadline ?? DEFAULT_PROFILE.application_deadline,
    universities: profileData.universities ?? DEFAULT_PROFILE.universities,
    strengths: profileData.strengths ?? DEFAULT_PROFILE.strengths,
    weaknesses: profileData.weaknesses ?? DEFAULT_PROFILE.weaknesses,
  } : DEFAULT_PROFILE

  const memories = memoriesResult.status === 'fulfilled'
    ? (memoriesResult.value.data ?? [])
    : []

  const systemPrompt = buildSystemPrompt(profile, memories, lastConversation, activeModule)
  const allTools = [...TOOLS, WEB_SEARCH_TOOL] as unknown as BetaToolUnion[]

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()

      try {
        const currentHistory: BetaMessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        while (true) {
          const response = await anthropic.beta.messages.create({
            model: CLAUDE_MODEL,
            system: systemPrompt,
            messages: currentHistory,
            tools: allTools,
            max_tokens: 4096,
            betas: ['web-search-2025-03-05'],
          })

          for (const block of response.content) {
            if (block.type === 'text' && block.text) {
              controller.enqueue(enc.encode(block.text))
            }
          }

          if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') break

          if (response.stop_reason === 'tool_use') {
            const toolUses = response.content.filter(
              (b): b is BetaToolUseBlock => b.type === 'tool_use',
            )

            currentHistory.push({ role: 'assistant', content: response.content })

            const toolResults: BetaToolResultBlockParam[] = await Promise.all(
              toolUses.map(async (tu) => {
                try {
                  const result = await serverExecuteTool(tu.name, tu.input as Record<string, unknown>, user.id)
                  const resultStr = typeof result === 'string' ? result : JSON.stringify(result)
                  void adminClient.from('agent_logs').insert({
                    agent_name: 'sanchez', action: tu.name, result: resultStr.slice(0, 500),
                  })
                  return { type: 'tool_result' as const, tool_use_id: tu.id, content: resultStr }
                } catch (err) {
                  console.error(`[Reborn] tool ${tu.name} error:`, err)
                  return {
                    type: 'tool_result' as const,
                    tool_use_id: tu.id,
                    content: `Hata: ${err instanceof Error ? err.message : 'Tool çalışmadı'}`,
                    is_error: true,
                  }
                }
              }),
            )

            currentHistory.push({ role: 'user', content: toolResults })
          }
        }
      } catch (err) {
        console.error('[Reborn] Claude error:', err)
        controller.enqueue(enc.encode('Bir hata oluştu. Tekrar dene.'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
