// Ajan durum rozeti — renk + ikon + metin üçlüsü (erişilebilirlik: durum asla
// yalnız renkle anlatılmaz). Hem sahnedeki avatarların yanında (foreignObject
// içinde) hem alt status bar'da AYNI component kullanılır.
//
// agent_runs.status → AgentStatus eşlemesi (statusFromRun):
//   koşu yok      → idle    (gri, durgun nokta, "Hazır")
//   'running'     → running (amber, dönen ikon, "Çalışıyor")
//   'error'       → error   (kırmızı, ünlem, "Hata")
//   'done' / diğer → success (yeşil, tik, "OK")

import { AlertTriangle, Check, CircleDot, Loader } from 'lucide-react'

export type AgentStatus = 'idle' | 'running' | 'success' | 'error'

/** Son agent_runs koşusunun status alanından rozet durumu türetir. */
export function statusFromRun(runStatus: string | null | undefined): AgentStatus {
  if (!runStatus) return 'idle'
  if (runStatus === 'running') return 'running'
  if (runStatus === 'error') return 'error'
  return 'success' // runner yalnız 'done' yazar; bilinmeyen değer başarı sayılır
}

const META: Record<
  AgentStatus,
  { label: string; Icon: typeof Check; pill: string; spin?: boolean }
> = {
  idle: {
    label: 'Hazır',
    Icon: CircleDot,
    pill: 'border-slate-300 bg-white/90 text-slate-500',
  },
  running: {
    label: 'Çalışıyor',
    Icon: Loader,
    pill: 'border-amber-300 bg-amber-50/95 text-amber-600',
    spin: true,
  },
  success: {
    label: 'OK',
    Icon: Check,
    pill: 'border-emerald-300 bg-emerald-50/95 text-emerald-600',
  },
  error: {
    label: 'Hata',
    Icon: AlertTriangle,
    pill: 'border-red-300 bg-red-50/95 text-red-600',
  },
}

export default function StatusBadge({
  status,
  className = '',
}: {
  status: AgentStatus
  className?: string
}) {
  const { label, Icon, pill, spin } = META[status]
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${pill} ${className}`}
    >
      <Icon className={`size-2.5 shrink-0 ${spin ? 'animate-spin' : ''}`} strokeWidth={2.5} />
      {label}
    </span>
  )
}
