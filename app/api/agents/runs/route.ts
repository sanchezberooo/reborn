// Ajan çalıştırma görünürlüğü — VERİ KATMANI (Paket B / TASK B4).
//
// İki mod, TEK uç (yeni route AÇILMADI — mevcut uç genişletildi):
//   GET /api/agents/runs            → liste (özet satırlar)
//   GET /api/agents/runs?id=<uuid>  → tek run'ın TAM detayı
//
// GERİYE UYUMLULUK: liste satırının MEVCUT alanları (id, agent_name, status,
// input, output, module_target, error, started_at, finished_at) aynen
// korunur — bu ucu bugün dört ekran okuyor (MAXAIPanel, OfficeLayout,
// AgentDetailPanel, dashboard/essay) ve UI bu pakette KAPSAM DIŞI. Yeni
// alanlar yanına EKLENİR. Bu yüzden yanıt snake_case'tir: DB kolonlarıyla ve
// mevcut istemcilerle aynı sözlük.
//
// Liste sorgusu her run için ayrı sorgu ATMAZ (N+1 yok): sayfa bir kez
// çekilir, ilişkili satırlar İKİ toplu sorguyla alınır ve bellekte gruplanır.
//
// Bu uç bir sonraki pakette Office'i besleyecek; şimdilik yalnız veridir.

import { getSupabaseAdmin } from '@/lib/supabase-admin'

/** Liste sayfa boyutu — mevcut davranış (20) korunur, ?limit ile değişir. */
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const RUN_COLUMNS =
  'id, agent_name, status, input, output, module_target, error, started_at, finished_at, verification, input_tokens, output_tokens'

function clampLimit(raw: string | null): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.floor(n), 1), MAX_LIMIT)
}

/** Süre: bitmemiş run'da null — 0 yazmak "anında bitti" demek olurdu. */
function durationMs(startedAt: unknown, finishedAt: unknown): number | null {
  if (typeof startedAt !== 'string' || typeof finishedAt !== 'string') return null
  const ms = Date.parse(finishedAt) - Date.parse(startedAt)
  return Number.isFinite(ms) ? ms : null
}

type Row = Record<string, unknown>

interface ToolCallSummary {
  total: number
  allowed: number
  denied: number
  errored: number
}

function emptySummary(): ToolCallSummary {
  return { total: 0, allowed: 0, denied: 0, errored: 0 }
}

function countInto(summary: ToolCallSummary, status: unknown): void {
  summary.total++
  if (status === 'allowed') summary.allowed++
  else if (status === 'denied') summary.denied++
  else if (status === 'error') summary.errored++
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('id')
  const supabase = getSupabaseAdmin()

  // ── Tek run detayı ────────────────────────────────────────────────────
  if (runId) {
    const { data: run, error } = await supabase
      .from('agent_runs').select(RUN_COLUMNS).eq('id', runId).single()

    if (error) {
      // PGRST116 = satır bulunamadı.
      const status = error.code === 'PGRST116' ? 404 : 500
      return Response.json({ error: error.message }, { status })
    }

    const [logs, audit, taskLink] = await Promise.all([
      supabase.from('agent_logs')
        .select('id, action, result, created_at')
        .eq('run_id', runId).order('created_at', { ascending: true }),
      // İzin verilen VE reddedilen çağrılar aynı tablodadır; ayrım status
      // alanında (allowed | denied | error) — reddedilenler kaybolmaz.
      supabase.from('audit_log')
        .select('id, tool_name, status, capability, deny_reason, duration_ms, error, input_keys, created_at')
        .eq('run_id', runId).order('created_at', { ascending: true }),
      // Göreve köprü: agent_runs'ta task kolonu YOK, bağ run_linked
      // olayıdır (lib/tasks/repository.ts linkRun).
      supabase.from('agent_task_events')
        .select('task_id').eq('run_id', runId).eq('event', 'run_linked').limit(1),
    ])

    const taskId = (taskLink.data?.[0] as Row | undefined)?.task_id as string | undefined
    let task: Row | null = null
    if (taskId) {
      const { data } = await supabase
        .from('agent_tasks')
        .select('id, title, status, department, owner_agent, priority, retry_count, max_retries')
        .eq('id', taskId).single()
      task = (data as Row) ?? null
    }

    const toolCalls = (audit.data ?? []) as Row[]
    const summary = emptySummary()
    for (const call of toolCalls) countInto(summary, call.status)

    return Response.json({
      ...(run as Row),
      duration_ms: durationMs((run as Row).started_at, (run as Row).finished_at),
      task,
      tool_calls: toolCalls,
      tool_call_summary: summary,
      // agent_logs, audit_log'un YERİNE geçmez: o "ne yapıldı"yı (kısaltılmış
      // sonuç), audit "izin verildi mi"yi cevaplar (migration 0013 notu).
      logs: logs.data ?? [],
    })
  }

  // ── Liste ─────────────────────────────────────────────────────────────
  const agent = searchParams.get('agent')
  const status = searchParams.get('status')

  let query = supabase
    .from('agent_runs').select(RUN_COLUMNS)
    .order('started_at', { ascending: false })
    .limit(clampLimit(searchParams.get('limit')))

  if (agent) query = query.eq('agent_name', agent)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const runs = (data ?? []) as Row[]
  if (runs.length === 0) return Response.json([])

  // N+1 YOK: tüm run'ların denetim satırları ve görev bağları İKİ sorguyla
  // toplanır, sonra bellekte gruplanır.
  const runIds = runs.map((r) => r.id as string)
  const [audit, taskLinks] = await Promise.all([
    supabase.from('audit_log').select('run_id, status').in('run_id', runIds),
    supabase.from('agent_task_events')
      .select('run_id, task_id').in('run_id', runIds).eq('event', 'run_linked'),
  ])

  const summaryByRun = new Map<string, ToolCallSummary>()
  for (const row of (audit.data ?? []) as Row[]) {
    const key = row.run_id as string
    const summary = summaryByRun.get(key) ?? emptySummary()
    countInto(summary, row.status)
    summaryByRun.set(key, summary)
  }

  const taskByRun = new Map<string, string>()
  for (const row of (taskLinks.data ?? []) as Row[]) {
    taskByRun.set(row.run_id as string, row.task_id as string)
  }

  return Response.json(runs.map((run) => ({
    ...run,
    duration_ms: durationMs(run.started_at, run.finished_at),
    task_id: taskByRun.get(run.id as string) ?? null,
    tool_call_summary: summaryByRun.get(run.id as string) ?? emptySummary(),
  })))
}
