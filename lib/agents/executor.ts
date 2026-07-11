export async function serverExecuteTool(
  name: string,
  input: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
  const supabase = getSupabaseAdmin()

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
      // saveMemory: silo insert + Brain köprü entity'si (embedding lokal bge-m3)
      // — kayıt hybridRetrieve'e ve dolayısıyla chat bağlamına dahil olur.
      const { saveMemory } = await import('@/lib/db-server')
      const result = await saveMemory(userId, { content, importance, tags, type })
      return { ok: true, memory_id: result.id, entity_synced: result.entitySynced }
    }

    case 'save_goal': {
      const { title, description, target_date } = input as {
        title: string; description?: string; target_date?: string
      }
      // saveGoal embedding'i lokal (bge-m3) hesaplar — üretken AI çağrısı yok.
      const { saveGoal } = await import('@/lib/db-server')
      const goal = await saveGoal(userId, {
        title,
        description: description ?? null,
        targetDate: target_date ?? null,
      })
      return { ok: true, goal_id: goal.id, title: goal.title, status: goal.status }
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
              return String((u as Record<string, unknown>).name ?? '').toLowerCase() === university.toLowerCase()
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

    case 'read_essays': {
      // Essay listesi + her birinin SON versiyonunun metni. Sanchez
      // "essay'ime bak" akışında bunu okuyup run_agent(essay-critic)'e
      // draft olarak geçirir.
      const { essay_id } = input as { essay_id?: string }
      let q = supabase.from('essays')
        .select('id, title, school, prompt, word_limit, status, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      if (essay_id) q = q.eq('id', essay_id)
      const { data: essays } = await q

      const withVersions = await Promise.all((essays ?? []).map(async (e) => {
        const { data: v } = await supabase.from('essay_versions')
          .select('version_number, content, created_at')
          .eq('essay_id', e.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .single()
        return { ...e, latest_version: v ?? null }
      }))
      return withVersions
    }

    case 'run_agent': {
      const { agentName, agentInput } = input as { agentName: string; agentInput: Record<string, unknown> }
      // Dynamic import breaks the circular dep (runner → executor → runner)
      const { runAgent } = await import('./runner')
      return await runAgent(agentName, agentInput, userId)
    }

    default:
      return { ok: true, note: 'server-handled' }
  }
}
