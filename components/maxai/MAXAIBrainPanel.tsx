'use client'

// MAXAI Brain — agent-brain metrik görünümü (kişisel not Brain'i DEĞİL, ayrı ve
// yeni). Tüm agentler için overview tablo + seçili agent için mini bar chart.
// Üç ölçüm (Skills/Patterns/Workflows) tek bir agent'ın kimliğine ait — status
// renkleri (success/warning) burada kullanılmaz, aynı marka tonunun (primary)
// üç opaklığıyla ayrıştırılır.

import { useState } from 'react'
import { BRAIN_STATS } from '@/lib/maxai-data'
import { cn } from '@/lib/utils'

const METRICS = [
  { key: 'skillsCount', label: 'Skills', swatch: 'bg-primary' },
  { key: 'patternsCount', label: 'Patterns', swatch: 'bg-primary/60' },
  { key: 'workflowsCount', label: 'Workflows', swatch: 'bg-primary/30' },
] as const

export default function MAXAIBrainPanel() {
  const [selected, setSelected] = useState(BRAIN_STATS[0].agentName)
  const agent = BRAIN_STATS.find((a) => a.agentName === selected) ?? BRAIN_STATS[0]
  const maxValue = Math.max(...BRAIN_STATS.flatMap((a) => [a.skillsCount, a.patternsCount, a.workflowsCount]))

  return (
    <div className="no-scrollbar flex h-full flex-col gap-4 overflow-y-auto p-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-2xs">
          <thead>
            <tr className="border-b border-border text-3xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium text-right">Skills</th>
              <th className="px-4 py-2.5 font-medium text-right">Patterns</th>
              <th className="px-4 py-2.5 font-medium text-right">Workflows</th>
            </tr>
          </thead>
          <tbody>
            {BRAIN_STATS.map((a) => (
              <tr
                key={a.agentName}
                onClick={() => setSelected(a.agentName)}
                className={cn(
                  'cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/40',
                  selected === a.agentName && 'bg-secondary/60',
                )}
              >
                <td className="px-4 py-3 font-medium text-foreground">{a.agentName}</td>
                <td className="px-4 py-3 text-right text-foreground/90">{a.skillsCount}</td>
                <td className="px-4 py-3 text-right text-foreground/90">{a.patternsCount}</td>
                <td className="px-4 py-3 text-right text-foreground/90">{a.workflowsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{agent.agentName} · Brain metrikleri</p>
          <div className="flex items-center gap-3 text-3xs text-muted-foreground">
            {METRICS.map((m) => (
              <span key={m.key} className="flex items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', m.swatch)} />
                {m.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {METRICS.map((m) => {
            const value = agent[m.key]
            const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0
            return (
              <div key={m.key} className="flex items-center gap-3" title={`${m.label}: ${value}`}>
                <span className="w-20 shrink-0 text-2xs text-muted-foreground">{m.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary/60">
                  <div className={cn('h-full rounded-full', m.swatch)} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-2xs text-foreground/90">{value}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
