import Link from 'next/link'
import type { ModuleItem } from '@/lib/modules'

interface Props {
  module: ModuleItem
}

function getSubtitle(module: ModuleItem): string {
  const d = module.data
  switch (module.id) {
    case 'english':
      return `IELTS hedef: ${d.ielts_target} — ${d.ielts_date}`
    case 'scholarship': {
      const unis = (d.universities as unknown[]) ?? []
      return unis.length > 0 ? `${unis.length} üniversite takibinde` : 'Henüz üniversite yok'
    }
    case 'daily': {
      const tasks = (d.tasks as unknown[]) ?? []
      return tasks.length > 0 ? `${tasks.length} görev` : 'Görev yok'
    }
    case 'habits': {
      const habits = (d.habits as unknown[]) ?? []
      return habits.length > 0 ? `${habits.length} alışkanlık` : 'Henüz alışkanlık yok'
    }
    case 'roadmap': {
      const focus = d.current_focus as string
      return focus || 'Odak belirlenmedi'
    }
    case 'finance': {
      const budget = d.monthly_budget as number
      return budget > 0 ? `Aylık bütçe: ₺${budget}` : 'Bütçe belirlenmedi'
    }
    default: {
      const items = (d.items as unknown[]) ?? []
      return items.length > 0 ? `${items.length} öğe` : 'Sanchez ile doldur'
    }
  }
}

export default function ModuleWidget({ module }: Props) {
  return (
    <Link
      href={`/dashboard/${module.id}`}
      className="bg-surface border border-border rounded-2xl p-5 hover:border-gold transition-all duration-150 cursor-pointer group block"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4"
        style={{ background: module.color + '20' }}
      >
        {module.icon}
      </div>
      <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-gold transition-colors">
        {module.name}
      </h3>
      <p className="text-xs text-muted leading-relaxed">{getSubtitle(module)}</p>
    </Link>
  )
}
