import { Server } from 'lucide-react'

// Dekor katmanı: statik server/veri hissi. Ahşap/organik öğe yok — tamamen
// metal/ışık temsili, diğer odalardan teknolojik olarak ayrışsın diye.
// Avatar katmanı ileride bu dekorun önünde (z üstünde) konumlanacak.
function RoomBrainDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {/* Duvar paneli — içinde ince veri/graf çizgileri */}
      <div className="absolute left-[8%] right-[8%] top-[10%] h-[26%] rounded-md border border-cyan-400/30 bg-cyan-950/30 p-[6%]">
        <div className="flex h-full items-end gap-[8%]">
          <div className="h-[40%] w-full rounded-sm bg-cyan-400/30" />
          <div className="h-[70%] w-full rounded-sm bg-cyan-400/40" />
          <div className="h-[50%] w-full rounded-sm bg-cyan-400/25" />
          <div className="h-[85%] w-full rounded-sm bg-cyan-400/45" />
          <div className="h-[35%] w-full rounded-sm bg-cyan-400/25" />
        </div>
      </div>

      {/* Dikey server blokları */}
      <div className="absolute bottom-[10%] left-[8%] flex h-[38%] w-[46%] items-end gap-[6%]">
        <div className="flex h-full w-full flex-col items-center justify-end gap-1 rounded-md border border-cyan-400/40 bg-cyan-950/40 pb-2 shadow-[0_0_14px_-4px_rgba(34,211,238,0.4)]">
          <Server className="h-3.5 w-3.5 text-cyan-300/80" />
        </div>
        <div className="flex h-[85%] w-full flex-col items-center justify-end gap-1 rounded-md border border-cyan-400/40 bg-cyan-950/40 pb-2 shadow-[0_0_14px_-4px_rgba(34,211,238,0.4)]">
          <Server className="h-3.5 w-3.5 text-cyan-300/80" />
        </div>
        <div className="flex h-[95%] w-full flex-col items-center justify-end gap-1 rounded-md border border-cyan-400/40 bg-cyan-950/40 pb-2 shadow-[0_0_14px_-4px_rgba(34,211,238,0.4)]">
          <Server className="h-3.5 w-3.5 text-cyan-300/80" />
        </div>
      </div>

      {/* Zemin boyunca ince ışıklı çizgi */}
      <div className="absolute bottom-[6%] left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="absolute bottom-[8%] right-[8%] h-[20%] w-px bg-gradient-to-t from-cyan-400/50 to-transparent" />
    </div>
  )
}

export default function RoomBrain() {
  return (
    <div className="relative rounded-2xl border border-cyan-900/40 bg-cyan-950/20">
      <span className="absolute left-3 top-3 z-10 text-2xs font-medium uppercase tracking-wide text-cyan-400/80">
        Brain
      </span>
      <RoomBrainDecor />
    </div>
  )
}
