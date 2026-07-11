// MAXAİ Ofis sahnesinin paylaşılan veri sözleşmeleri ve küçük yardımcılar.
// OfficeLayout ve AgentDetailPanel ikisi de kullanır; ayrı modül olması
// component'ler arası dairesel import'u önler.

export interface AgentMeta {
  name: string
  displayName: string
  moduleTarget: string | null
}

export interface AgentRun {
  id: string
  agent_name: string
  status: string
  input: unknown
  error: string | null
  started_at: string
  finished_at: string | null
}

export function fmtRelative(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'az önce'
  if (mins < 60) return `${mins} dk önce`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} sa önce`
  return `${Math.floor(hrs / 24)} gün önce`
}

/** Koşu girdisinden tek satırlık görev özeti (status bar + detay paneli). */
export function runSummary(run: AgentRun): string {
  const input = run.input as Record<string, unknown> | null
  if (input && typeof input === 'object') {
    for (const key of ['topic', 'schoolName', 'essayPrompt', 'weekNumber', 'message']) {
      const v = input[key]
      if (v !== undefined && v !== null && v !== '') {
        return key === 'weekNumber' ? `Hafta ${v}` : String(v).slice(0, 90)
      }
    }
    const keys = Object.keys(input)
    if (keys.length > 0) return keys.slice(0, 3).join(', ')
  }
  return 'girdi yok'
}
