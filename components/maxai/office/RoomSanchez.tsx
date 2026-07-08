import { Archive, Leaf, Monitor } from 'lucide-react'
import PixelAvatar from './PixelAvatar'

// Dekor katmanı: statik mobilya/ikon temsili. Avatar/hareket henüz yok —
// bu katman arka planda kalacak şekilde (z-0), ileride eklenecek avatar
// katmanının önde durabilmesi için ayrı tutuluyor.
function RoomSanchezDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {/* Büyük komuta masası — diğer odalardaki masalardan belirgin şekilde büyük */}
      <div className="absolute bottom-[10%] left-1/2 h-[18%] w-[56%] -translate-x-1/2 rounded-lg border border-amber-400/40 bg-amber-500/10 shadow-[0_0_18px_-6px_rgba(251,191,36,0.35)]" />

      {/* İkili ekran, masanın üzerinde yan yana */}
      <div className="absolute bottom-[26%] left-1/2 flex -translate-x-1/2 gap-[6%]">
        <div className="flex h-[9%] w-[13%] items-center justify-center rounded-md border border-amber-400/40 bg-amber-500/15">
          <Monitor className="h-3.5 w-3.5 text-amber-300/80" />
        </div>
        <div className="flex h-[9%] w-[13%] items-center justify-center rounded-md border border-amber-400/40 bg-amber-500/15">
          <Monitor className="h-3.5 w-3.5 text-amber-300/80" />
        </div>
      </div>

      {/* Bitki, köşede */}
      <div className="absolute right-[6%] top-[10%] flex h-[13%] w-[13%] items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10">
        <Leaf className="h-4 w-4 text-amber-300/70" />
      </div>

      {/* Küçük dolap/raf */}
      <div className="absolute bottom-[10%] right-[8%] flex h-[14%] w-[10%] items-center justify-center rounded-md border border-amber-400/25 bg-amber-500/10">
        <Archive className="h-3.5 w-3.5 text-amber-300/60" />
      </div>
    </div>
  )
}

export default function RoomSanchez() {
  return (
    <div className="relative rounded-2xl border border-amber-500/20 bg-amber-500/5">
      <span className="absolute left-3 top-3 z-10 text-2xs font-medium uppercase tracking-wide text-amber-200/70">
        Sanchez
      </span>
      <RoomSanchezDecor />
      <div className="absolute bottom-[30%] left-1/2 z-10 -translate-x-1/2">
        <PixelAvatar colorScheme="sanchez" name="Sanchez" />
      </div>
    </div>
  )
}
