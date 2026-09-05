import { getAIProvider, TOOLS, MAX_TOOL_ITERATIONS } from '@/lib/ai'
import type { AIMessage, AIToolResult, AIUsage } from '@/lib/ai'
import { sumUsage } from '@/lib/ai/usage'
import { getAgent } from '@/lib/agents/registry'
import { runToolCall } from '@/lib/agents/tool-loop'
import { verifyAgentOutput } from '@/lib/agents/verify'
import type { FailedToolCall, VerificationResult } from '@/lib/agents/verify'

export type AgentRunResult =
  | { ok: true; output: unknown; runId: string }
  /** verification: yalnız VERIFY düştüğünde dolu — çağıran (ve model)
   *  hangi kontrolün neden düştüğünü görebilsin. runId: verify_failed
   *  çalıştırmasının izi; run satırı yazıldıysa her hata yolunda taşınır. */
  | { ok: false; error: string; notFound?: true; runId?: string; verification?: VerificationResult }

/**
 * Ajanların JSON-only çıktı sözleşmesini ayıklar: kod bloklu (```json ... ```)
 * sarmalamayı kaldırır, ilk `{` ile son `}` arasını alır, parse eder. Bozuk
 * çıktıda veri kaybetmeden `parseError` fallback'ine düşer.
 */
export function parseAgentOutput(finalText: string): unknown {
  const debracketed = finalText
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()
  const firstBrace = debracketed.indexOf('{')
  const lastBrace  = debracketed.lastIndexOf('}')
  const candidate  = firstBrace !== -1 && lastBrace > firstBrace
    ? debracketed.slice(firstBrace, lastBrace + 1)
    : debracketed

  try {
    return JSON.parse(candidate)
  } catch {
    return { parseError: true, rawLength: finalText.length, raw: finalText }
  }
}

export async function runAgent(
  agentName: string,
  input: Record<string, unknown>,
  userId: string,
  /** opts.taskId: çalıştırma bir iş emri (agent task) adına yapılıyorsa o
   *  görevin id'si — tool bağlamına taşınır (delegate_task'ın
   *  dependsOnCurrentTask çözümü buna dayanır). Sprint 3, kırıcı değil. */
  opts: { taskId?: string } = {}
): Promise<AgentRunResult> {
  const agent = getAgent(agentName)
  if (!agent) return { ok: false, error: `Agent '${agentName}' bulunamadı`, notFound: true }

  const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
  const supabase = getSupabaseAdmin()

  const { data: runRow, error: insertError } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: agentName,
      status: 'running',
      input,
      started_at: new Date().toISOString(),
      user_id: userId,
    })
    .select()
    .single()

  if (insertError || !runRow) {
    return { ok: false, error: insertError?.message ?? 'agent_runs satırı oluşturulamadı' }
  }

  const runId = runRow.id as string

  // Token muhasebesi try'ın DIŞINDA: çalıştırma yarıda patlasa da o ana
  // kadar harcanan token gerçekten harcanmıştır ve satıra yazılmalıdır —
  // maliyeti yalnız başarılı run'larda görmek kontrol kaybıdır.
  const turnUsages: (AIUsage | undefined)[] = []

  try {
    const provider = getAIProvider()

    const customTools = agent.toolNames.length > 0
      ? TOOLS.filter((t) => agent.toolNames.includes(t.name))
      : []

    // Knowledge Agent istisnası: bekleyen sinyal bağlamı system prompt'a
    // çalıştırma anında bağlanır (lib/brain/context-builder.ts) — tek ajana
    // özel minimal dokunuş, genel bir dinamik-persona mekanizması DEĞİL.
    // Rapor modunda (input.mode === 'report') sinyal bağlamı BİLİNÇLİ atlanır:
    // rapor sinyallerle ilgilenmez, listenin varlığı modu bulandırır — sinyal
    // işleme yolu (mode'suz input) birebir aynı kalır.
    let system = agent.persona
    if (agentName === 'knowledge-agent') {
      const { buildKnowledgeAgentContext } = await import('@/lib/brain/context-builder')
      const { buildKnowledgeAgentPrompt } = await import('@/lib/agents/knowledge-agent-prompt')
      const isReportMode = (input as { mode?: unknown }).mode === 'report'
      system = buildKnowledgeAgentPrompt(
        isReportMode ? '' : await buildKnowledgeAgentContext(10, { userId })
      )
    }

    const messages: AIMessage[] = [
      { role: 'user', content: JSON.stringify(input) },
    ]

    let finalText = ''

    // VERIFY'ın 4. kontrolü için: bu run'da hata dönen tool çağrıları.
    // Bloklamaz (bkz. verify.ts) — sonuçta görünür.
    const failedToolCalls: FailedToolCall[] = []

    // Kaçak döngü guard'ı (chat route'uyla AYNI sabit): sınır aşılırsa hata
    // fırlatılmaz — eldeki metinle çıkılır, parseAgentOutput normal yolunda
    // (gerekirse parseError fallback'iyle) devam eder.
    let toolRounds = 0

    while (true) {
      const turn = await provider.complete({
        model: agent.model,
        system,
        messages,
        tools: customTools,
        maxTokens: agent.maxTokens ?? 2048,
        webSearch: Boolean(agent.webSearch),
      })

      finalText += turn.text
      // Her tur sayılır — döngü nasıl biterse bitsin (break, iterasyon
      // sınırı, hata) o ana kadar harcanan token gerçekten harcanmıştır.
      turnUsages.push(turn.usage)

      if (turn.stopReason !== 'tool_use') break

      if (toolRounds >= MAX_TOOL_ITERATIONS) {
        console.warn(`[Reborn] runAgent(${agentName}): MAX_TOOL_ITERATIONS (${MAX_TOOL_ITERATIONS}) aşıldı — tool döngüsü durduruldu.`)
        break
      }
      toolRounds++

      messages.push({ role: 'assistant', content: turn.text, raw: turn.raw })

      // Hata çağrı BAŞINA yakalanır (lib/agents/tool-loop.ts — Sanchez Core
      // ile aynı sözleşme): tek bir reddedilen/patlayan tool run'ı
      // düşürmez, modele isError olarak döner ve ajan devam edebilir.
      const toolResults: AIToolResult[] = await Promise.all(
        turn.toolUses.map(async (tu) => {
          const result = await runToolCall(tu, userId, {
            callerAgent: agentName,
            taskId: opts.taskId,
            runId,
          })
          if (result.isError) {
            failedToolCalls.push({ name: tu.name, message: result.content })
          } else {
            void supabase.from('agent_logs').insert({
              run_id: runId,
              agent_name: agentName,
              action: tu.name,
              result: result.content.slice(0, 500),
            })
          }
          return result
        })
      )

      if (toolResults.length > 0) {
        messages.push({ role: 'tool_results', results: toolResults })
      } else {
        break
      }
    }

    const output = parseAgentOutput(finalText)

    // ── VERIFY ────────────────────────────────────────────────────────────
    // Ajan artık kendi çıktısını otomatik başarılı saymaz. Karar SAF ve
    // deterministiktir (lib/agents/verify.ts): ikinci bir LLM turu yok.
    const verification = verifyAgentOutput({
      output,
      outputSchema: agent.outputSchema,
      failedToolCalls,
    })

    // ── LOG + COMPLETE ────────────────────────────────────────────────────
    // Çıktı BAŞARISIZ doğrulamada da yazılır: verify_failed bir run'ın
    // incelenebilmesi tam da neyin üretildiğine bakmayı gerektirir.
    const usage = sumUsage(turnUsages)

    await supabase.from('agent_runs').update({
      status: verification.passed ? 'done' : 'verify_failed',
      output,
      verification,
      // null = ölçülmedi (MockProvider) — 0 ile karıştırılmaz.
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      module_target: agent.moduleTarget,
      finished_at: new Date().toISOString(),
    }).eq('id', runId)

    if (!verification.passed) {
      const failed = verification.checks
        .filter((c) => c.blocking && !c.skipped && !c.passed)
        .map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ''}`)
        .join('; ')
      // ok:false BİLİNÇLİ — ok:true dönmek, sözleşmesini tutmayan çıktıyı
      // kuyruk tarafında 'done' yapar ve bozuk veriyi aşağı akıtırdı; bu tam
      // olarak TASK B1.2'de kapatılan "model başarı sanıyor" hatasının run
      // düzeyindeki hâli olurdu. Kuyruk bunu 'failed' görür ve retry'a
      // UYGUN sayar (terminal değil): baskın verify hatası parseError'dır —
      // LLM belirsizliğinden doğar ve yeniden çalıştırmayla düzelebilir.
      // Maliyet sınırı zaten görevde: maxRetries varsayılanı 0'dır
      // (delegate_task clamp'i), yani retry görev başına açık bir tercihtir.
      return {
        ok: false,
        error: `VERIFY başarısız: ${failed}`,
        runId,
        verification,
      }
    }

    return { ok: true, output, runId }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const usage = sumUsage(turnUsages)
    await supabase.from('agent_runs').update({
      status: 'error',
      error: message,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      finished_at: new Date().toISOString(),
    }).eq('id', runId)
    return { ok: false, error: message, runId }
  }
}
