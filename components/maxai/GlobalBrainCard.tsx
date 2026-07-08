// MAXAI Panel — üst şerit Global Brain özet kartı. Eski components/GlobalBrainCard.tsx'ten
// aynen taşındı: props sözleşmesi zaten Panel'in istediği "Skills: N · Agents: M / D
// desks filled" biçimiyle bire bir örtüşüyordu.

import { Brain } from 'lucide-react'

export default function GlobalBrainCard({
  skillsCount,
  agentsFilled,
  deskCount,
}: {
  skillsCount: number
  agentsFilled: number
  deskCount: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
        <Brain className="size-[18px] text-foreground/80" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Global Brain</p>
        <p className="text-2xs text-muted-foreground">
          Skills: {skillsCount} · Agents: {agentsFilled} / {deskCount} desks filled
        </p>
      </div>
    </div>
  )
}
