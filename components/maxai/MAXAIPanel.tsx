// MAXAI Panel — bilgi yoğun, dense kart/tablo görünümü. Animasyon yok.

import GlobalBrainCard from './GlobalBrainCard'
import { PANEL_AGENTS, DESK_COUNT, GLOBAL_BRAIN_SKILLS, type PanelStatus } from '@/lib/maxai-data'
import { cn } from '@/lib/utils'

const STATUS_META: Record<PanelStatus, { label: string; dot: string; text: string }> = {
  working: { label: 'Çalışıyor', dot: 'bg-success animate-pulse', text: 'text-success' },
  learning: { label: 'Öğreniyor', dot: 'bg-primary animate-pulse', text: 'text-primary' },
  idle: { label: 'Boşta', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
}

export default function MAXAIPanel() {
  return (
    <div className="no-scrollbar flex h-full flex-col gap-4 overflow-y-auto p-6">
      <GlobalBrainCard
        skillsCount={GLOBAL_BRAIN_SKILLS}
        agentsFilled={PANEL_AGENTS.length}
        deskCount={DESK_COUNT}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-2xs">
          <thead>
            <tr className="border-b border-border text-3xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium">Domain</th>
              <th className="px-4 py-2.5 font-medium">Durum</th>
              <th className="px-4 py-2.5 font-medium text-right">Skills</th>
              <th className="px-4 py-2.5 font-medium text-right">Patterns</th>
              <th className="px-4 py-2.5 font-medium">Son Etkileşimler</th>
            </tr>
          </thead>
          <tbody>
            {PANEL_AGENTS.map((agent) => {
              const status = STATUS_META[agent.status]
              return (
                <tr key={agent.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{agent.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{agent.domain}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1.5', status.text)}>
                      <span className={cn('size-1.5 rounded-full', status.dot)} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground/90">{agent.brainSkillsCount}</td>
                  <td className="px-4 py-3 text-right text-foreground/90">{agent.brainPatternsCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {agent.lastInteractions.slice(0, 2).join(' · ') || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
