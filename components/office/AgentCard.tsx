import type { Agent } from '@/lib/types'

const statusColors = {
  active: '#8ec86e',
  idle: '#888888',
  error: '#c86e6e',
}

const statusLabels = {
  active: 'Aktif',
  idle: 'Bekliyor',
  error: 'Hata',
}

interface Props {
  agent: Agent
}

export default function AgentCard({ agent }: Props) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm text-foreground">{agent.name}</h3>
          <p className="text-xs text-muted mt-0.5">{agent.description}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ borderColor: statusColors[agent.status] + '40', background: statusColors[agent.status] + '10' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColors[agent.status] }} />
          <span className="text-[10px] font-medium" style={{ color: statusColors[agent.status] }}>
            {statusLabels[agent.status]}
          </span>
        </div>
      </div>

      {agent.logs.length > 0 && (
        <div className="bg-background rounded-xl p-3 font-mono text-[11px] text-muted space-y-1 max-h-28 overflow-y-auto">
          {agent.logs.map((log, i) => (
            <p key={i} className="leading-relaxed">
              <span className="text-gold mr-2">&gt;</span>{log}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
