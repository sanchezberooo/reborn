import AgentCard from '@/components/office/AgentCard'
import type { Agent } from '@/lib/types'

const agents: Agent[] = [
  {
    id: 'sanchez-core',
    name: 'Sanchez Core',
    description: 'Ana AI mentor — chat, yönlendirme, motivasyon',
    status: 'active',
    logs: [
      'Başlatıldı: gpt-4o-mini modeli yüklendi',
      'Sistem prompt aktif: Sanchez v1.0',
      'Hazır — Bero bağlantısı bekleniyor',
    ],
  },
  {
    id: 'goal-tracker',
    name: 'Goal Tracker',
    description: 'Hedef takibi ve ilerleme analizi',
    status: 'idle',
    logs: ['Veritabanı bağlantısı bekleniyor (Supabase)'],
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
    logs: ['Henüz başlatılmadı — yakında'],
  },
]

export default function OfficePage() {
  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-foreground mb-1">
            Office
          </h1>
          <p className="text-sm text-muted">
            AI agent'ların durumu ve logları.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>

        <div className="mt-6 p-4 rounded-2xl border border-dashed border-border text-center">
          <p className="text-xs text-muted">Yeni agent eklemek için Sanchez'e sor.</p>
        </div>
      </div>
    </div>
  )
}
