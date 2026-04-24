import type { Agent } from '@/lib/types'

const agents: Agent[] = [
  {
    id: 'sanchez-core',
    name: 'Sanchez Core',
    description: 'Ana AI mentor — chat, yönlendirme, motivasyon',
    status: 'active',
    logs: [
      'gpt-4o-mini modeli yüklendi',
      'Sistem prompt aktif: Sanchez v1.0',
      'Hazır — Bero bağlantısı aktif',
    ],
  },
  {
    id: 'goal-tracker',
    name: 'Goal Tracker',
    description: 'Hedef takibi ve ilerleme analizi',
    status: 'idle',
    logs: ['Supabase bağlantısı bekleniyor'],
  },
  {
    id: 'task-agent',
    name: 'Task Agent',
    description: 'Günlük görev oluşturma ve önceliklendirme',
    status: 'idle',
    logs: ['Henüz başlatılmadı'],
  },
  {
    id: 'scholarship-scout',
    name: 'Scholarship Scout',
    description: 'Burs fırsatı tarama ve eşleştirme',
    status: 'idle',
    logs: ['Yakında aktif olacak'],
  },
]

const statusConfig = {
  active: { label: 'Aktif', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  idle: { label: 'Beklemede', dot: 'bg-muted', text: 'text-muted' },
  error: { label: 'Hata', dot: 'bg-red-400', text: 'text-red-400' },
}

export default function OfficePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground mb-1">Office</h1>
          <p className="text-sm text-muted">AI agent&apos;larının durumu.</p>
        </div>

        <div className="flex flex-col gap-3">
          {agents.map((agent) => {
            const cfg = statusConfig[agent.status] ?? statusConfig.idle
            return (
              <div
                key={agent.id}
                className="bg-surface border border-border rounded-2xl p-5 hover:border-border/80 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                    <p className="text-xs text-muted mt-0.5">{agent.description}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${agent.status === 'active' ? 'animate-pulse' : ''}`} />
                    {cfg.label}
                  </div>
                </div>

                <div className="bg-background rounded-xl px-3 py-2.5 font-mono">
                  {agent.logs.map((log, i) => (
                    <p key={i} className="text-[11px] text-muted leading-5">
                      <span className="text-muted/40 select-none mr-2">›</span>
                      {log}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 p-4 rounded-2xl border border-dashed border-border/50 text-center">
          <p className="text-xs text-muted/60">Yeni agent eklemek için Sanchez&apos;e sor.</p>
        </div>
      </div>
    </div>
  )
}
