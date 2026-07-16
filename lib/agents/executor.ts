import type { ColdNodeType, LinkType } from '@/lib/brain/types'
import type { TaskPriority } from '@/lib/tasks/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Modelden gelen sayısal girdiyi [min, max] aralığına kırpar; sayı değilse
 *  veya geçersizse varsayılana düşer — model keyfi büyük değer (örn.
 *  limit: 100000) geçirememeli. */
function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback
  return Math.min(Math.max(n, min), max)
}

/** brain_read_signals'ın bekleyen sinyal taramasında çekilen pencere:
 *  getNodesByType status filtrelemez (query.ts'e dokunulmaz), süzme burada
 *  yapılır. Bekleyen sinyal sayısı bu pencereyi aşarsa en eskiler pencere
 *  dışında kalabilir — tek kullanıcılı fazda kabul edilmiş sınır. */
const SIGNAL_SCAN_WINDOW = 100

/** Tool çağrısının kaynağı — delegasyon izinin "kim açtı" alanı ve
 *  dependsOnCurrentTask çözümü için (Sprint 3). Model girdisine GÜVENİLMEZ;
 *  kimlik çağıran koddan (runner/Sanchez Core) gelir. */
export interface ToolExecutionContext {
  /** 'sanchez' veya registry ajan adı. */
  callerAgent?: string
  /** Çağıran bir iş emri (agent task) bağlamında koşuyorsa o görevin id'si. */
  taskId?: string
}

export async function serverExecuteTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  ctx: ToolExecutionContext = {}
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
      const { type, tags } = input as { type?: string; tags?: string[] }
      const limit = clampNumber(input.limit, 20, 1, 100)
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
      const { category } = input as { category?: string }
      const limit = clampNumber(input.limit, 20, 1, 100)
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
      const { content, tags = [], type = 'general' } = input as {
        content: string; tags?: string[]; type?: string
      }
      const importance = clampNumber(input.importance, 5, 1, 10) // şema 1-10 der; modele güvenme
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

    // ── Task delegasyonu (Sprint 3) ───────────────────────────────────────
    // run_agent'ın asenkron kardeşi: iş emri kuyruğa yazılır, worker uygun
    // olduğunda çalıştırır. Doğrulamanın esas sahibi repository'dir
    // (createTask departman/ajan/öncelik kontrolleri); burada yalnız tip
    // ayıklama + bağlam çözümü yapılır. Beklenen hatalar { ok:false, error }
    // olarak modele döner — çağıran run düşmez (brain_* deseni).
    case 'delegate_task': {
      const {
        title, description, department, agentName, priority, maxRetries,
        dependsOnTaskIds, dependsOnCurrentTask,
      } = input as {
        title?: unknown; description?: unknown; department?: unknown
        agentName?: unknown; priority?: unknown; maxRetries?: unknown
        dependsOnTaskIds?: unknown; dependsOnCurrentTask?: unknown
      }
      if (typeof title !== 'string' || !title.trim()) {
        return { ok: false, error: 'delegate_task: title boş olmayan bir metin olmalı.' }
      }
      if (typeof department !== 'string' && typeof agentName !== 'string') {
        return { ok: false, error: 'delegate_task: department veya agentName\'den en az biri verilmeli — yönlendirilemeyen iş emri açılamaz.' }
      }

      const { TASK_PRIORITIES } = await import('@/lib/tasks/types')
      if (priority !== undefined
        && (typeof priority !== 'string' || !(TASK_PRIORITIES as readonly string[]).includes(priority))) {
        return { ok: false, error: `delegate_task: priority ${TASK_PRIORITIES.join(' | ')} olmalı — '${String(priority)}' reddedildi.` }
      }

      const dependsOn: string[] = []
      if (Array.isArray(dependsOnTaskIds)) {
        for (const id of dependsOnTaskIds) {
          if (typeof id !== 'string' || !UUID_RE.test(id)) {
            return { ok: false, error: `delegate_task: dependsOnTaskIds geçerli UUID listesi olmalı — '${String(id)}' reddedildi.` }
          }
          dependsOn.push(id)
        }
      }
      if (dependsOnCurrentTask === true) {
        if (!ctx.taskId) {
          return { ok: false, error: 'delegate_task: dependsOnCurrentTask yalnız bir görev bağlamında çalışırken kullanılabilir — şu an aktif görev yok.' }
        }
        if (!dependsOn.includes(ctx.taskId)) dependsOn.push(ctx.taskId)
      }

      try {
        const { createTask } = await import('@/lib/tasks/repository')
        const task = await createTask(userId, {
          title,
          description: typeof description === 'string' ? description : undefined,
          department: typeof department === 'string' ? department : undefined,
          ownerAgent: typeof agentName === 'string' ? agentName : undefined,
          priority: typeof priority === 'string' ? (priority as TaskPriority) : undefined,
          input: (input.input as Record<string, unknown> | undefined) ?? undefined,
          maxRetries: clampNumber(maxRetries, 0, 0, 5),
          dependsOn,
        })

        // Organizma izi: Sanchez/insan iş emri = task_created; bir ajanın
        // başka ajana açtığı iş = task_delegated (Sprint 3 olay sözlüğü).
        const { getRuntime } = await import('@/lib/runtime/manager')
        const delegatedByAgent = Boolean(ctx.callerAgent && ctx.callerAgent !== 'sanchez')
        await getRuntime().bus.publish({
          type: delegatedByAgent ? 'task_delegated' : 'task_created',
          taskId: task.id,
          agentName: task.ownerAgent ?? undefined,
          department: task.department ?? undefined,
          userId,
          detail: {
            title: task.title,
            delegatedBy: ctx.callerAgent ?? 'insan',
            ...(ctx.taskId ? { fromTaskId: ctx.taskId } : {}),
            ...(dependsOn.length > 0 ? { dependsOn } : {}),
          },
        })

        return {
          ok: true,
          taskId: task.id,
          status: task.status,
          department: task.department,
          ownerAgent: task.ownerAgent,
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }

    // ── Agent Brain tool'ları ─────────────────────────────────────────────
    // Tanımlar lib/brain/tools.ts'te; davranış burada — brain katmanı
    // (query/node-repository/link-registry) DOĞRUDAN import edilir (diğer
    // case'lerin lib/db-server.ts'i çağırma deseniyle birebir aynı; ayrı
    // HTTP/REST route yok). Kim hangi tool'u kullanabilir ayrımı registry
    // toolNames listelerindedir — bu ayrım yapısal/isimseldir, gerçek
    // yetkilendirme/Auth DEĞİL.
    // Enum/tip validasyonu BURADA yapılır (modele güvenilmez); brain
    // katmanının kendi assert'leri ikinci savunma hattıdır. Reddedilen çağrı
    // run'ı öldürmez: { ok:false, error } olarak modele geri döner.

    case 'brain_read_signals': {
      const { limit } = input as { limit?: unknown }
      const { BRAIN_READ_SIGNALS_DEFAULT_LIMIT, BRAIN_READ_SIGNALS_MAX_LIMIT } =
        await import('@/lib/brain/tools')
      const requested = typeof limit === 'number' && Number.isFinite(limit)
        ? Math.floor(limit)
        : BRAIN_READ_SIGNALS_DEFAULT_LIMIT
      const capped = Math.min(Math.max(requested, 1), BRAIN_READ_SIGNALS_MAX_LIMIT)
      const { getNodesByType } = await import('@/lib/brain/query')
      // getNodesByType yeniden-eskiye sıralar ve status filtrelemez; sözleşme
      // (status='gözlemlenen', en eskiden yeniye) burada uygulanır.
      const hot = await getNodesByType('signal', 'hot', { userId, limit: SIGNAL_SCAN_WINDOW })
      return hot
        .filter((n) => n.status === 'gözlemlenen')
        .reverse()
        .slice(0, capped)
    }

    case 'brain_integrate': {
      const { signalId, targetType, content } = input as {
        signalId?: unknown; targetType?: unknown; content?: unknown
      }
      if (typeof signalId !== 'string' || !UUID_RE.test(signalId)) {
        return { ok: false, error: 'brain_integrate: signalId geçerli bir UUID olmalı.' }
      }
      const { COLD_NODE_TYPES } = await import('@/lib/brain/types')
      if (typeof targetType !== 'string' || !(COLD_NODE_TYPES as readonly string[]).includes(targetType)) {
        return {
          ok: false,
          error: `brain_integrate: targetType ${COLD_NODE_TYPES.length} tanımlı tipten biri olmalı (${COLD_NODE_TYPES.join(', ')}) — '${String(targetType)}' reddedildi.`,
        }
      }
      if (typeof content !== 'string' || !content.trim()) {
        return { ok: false, error: 'brain_integrate: content boş olmayan bir metin olmalı.' }
      }
      try {
        const { integrateNode } = await import('@/lib/brain/node-repository')
        const { getLinkedNodes } = await import('@/lib/brain/link-registry')
        const node = await integrateNode(signalId, targetType as ColdNodeType, content)
        // integrateNode derived_from kenarını kurar ama id'sini döndürmez;
        // sözleşmedeki derivedFromLinkId kenar sorgusuyla okunur.
        const neighbors = await getLinkedNodes(node.id, 'derived_from')
        const derived = neighbors.find((n) => n.direction === 'outgoing' && n.node.id === signalId)

        // Organizma izi (Sprint 3): soğuk katmana her yazım brain_updated
        // olayıdır — Live State ve gelecekteki Office akışı bunu görür.
        const { getRuntime } = await import('@/lib/runtime/manager')
        await getRuntime().bus.publish({
          type: 'brain_updated',
          agentName: ctx.callerAgent,
          taskId: ctx.taskId,
          userId,
          detail: { nodeId: node.id, targetType, signalId },
        })

        return { nodeId: node.id, derivedFromLinkId: derived?.link.id ?? null }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }

    case 'brain_link': {
      const { fromId, toId, linkType } = input as {
        fromId?: unknown; toId?: unknown; linkType?: unknown
      }
      if (typeof fromId !== 'string' || !UUID_RE.test(fromId)) {
        return { ok: false, error: 'brain_link: fromId geçerli bir UUID olmalı.' }
      }
      if (typeof toId !== 'string' || !UUID_RE.test(toId)) {
        return { ok: false, error: 'brain_link: toId geçerli bir UUID olmalı.' }
      }
      const { LINK_TYPES } = await import('@/lib/brain/types')
      if (typeof linkType !== 'string' || !(LINK_TYPES as readonly string[]).includes(linkType)) {
        return {
          ok: false,
          error: `brain_link: linkType 9 tanımlı tipten biri olmalı (${LINK_TYPES.join(', ')}) — '${String(linkType)}' reddedildi.`,
        }
      }
      try {
        const { linkNodes } = await import('@/lib/brain/link-registry')
        const link = await linkNodes(fromId, toId, linkType as LinkType)
        return { linkId: link.id }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }

    case 'brain_get_node': {
      const { id } = input as { id?: unknown }
      if (typeof id !== 'string' || !UUID_RE.test(id)) {
        return { ok: false, error: 'brain_get_node: id geçerli bir UUID olmalı.' }
      }
      const { getNode } = await import('@/lib/brain/node-repository')
      return await getNode(id)
    }

    // ── Dış kaynak fetch tool'ları (Knowledge Agent rapor modu) ───────────
    // Tanımlar lib/knowledge/source-tools.ts'te; davranış — github.com
    // whitelist'i, sourceType switch'i ve GitHub API çağrıları dahil —
    // lib/knowledge/source-fetcher.ts'te. Brain'e YAZMAZ (salt okuma);
    // beklenen hatalar { ok:false, error } olarak modele geri döner.

    case 'fetch_source_overview': {
      const { sourceUrl, sourceType } = input as { sourceUrl?: unknown; sourceType?: unknown }
      if (typeof sourceUrl !== 'string' || !sourceUrl.trim()) {
        return { ok: false, error: 'fetch_source_overview: sourceUrl boş olmayan bir metin olmalı.' }
      }
      const { fetchSourceOverview } = await import('@/lib/knowledge/source-fetcher')
      const overview = await fetchSourceOverview(sourceUrl, sourceType)
      if ('ok' in overview) return overview // fetch hatası — Brain ilişkisi hesaplanmaz

      // Rapor modunun "Brain ile İlişki" bölümü: eşik-tabanlı Similarity
      // Level + Confidence kod tarafında hesaplanır (modele sayısal skor
      // sızmaz) ve tool sonucuna eklenir. buildBrainRelation SALT OKUMA yapar
      // ve beklenen hatalarda fırlatmaz (Low/Low + note döner).
      const { buildBrainRelation } = await import('@/lib/knowledge/brain-relation')
      const queryText = [
        overview.description ?? '',
        overview.topics.join(' '),
        overview.readmeExcerpt.slice(0, 500),
      ].join('\n')
      const brainRelation = await buildBrainRelation(queryText, userId)
      return { ...overview, brainRelation }
    }

    case 'fetch_source_content': {
      const { sourceUrl, sourceType, paths } = input as {
        sourceUrl?: unknown; sourceType?: unknown; paths?: unknown
      }
      if (typeof sourceUrl !== 'string' || !sourceUrl.trim()) {
        return { ok: false, error: 'fetch_source_content: sourceUrl boş olmayan bir metin olmalı.' }
      }
      // paths validasyonu (dizi/eleman/sayı/bütçe) source-fetcher içinde —
      // sınır aşımı dahil tüm beklenen hatalar { ok:false, error } döner.
      const { fetchSourceContent } = await import('@/lib/knowledge/source-fetcher')
      return await fetchSourceContent(sourceUrl, sourceType, paths)
    }

    default:
      return { ok: true, note: 'server-handled' }
  }
}
