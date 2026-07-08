import { Armchair, Coffee, Leaf } from 'lucide-react'

// Dekor katmanı: en sıcak/insani oda hissi — oturma grubu, masa yok.
// Avatar katmanı ileride bu dekorun önünde konumlanacak.
function RoomLoungeDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {/* Kahve makinesi, köşede */}
      <div className="absolute right-[8%] top-[10%] flex h-[14%] w-[13%] items-center justify-center rounded-md border border-orange-400/25 bg-orange-500/10">
        <Coffee className="h-4 w-4 text-orange-200/70" />
      </div>

      {/* Oturma grubu: 2 koltuk + küçük sehpa, masa yok */}
      <div className="absolute bottom-[12%] left-1/2 flex -translate-x-1/2 items-center gap-[6%]">
        <div className="flex h-[15%] w-[16%] items-center justify-center rounded-md border border-orange-400/25 bg-orange-500/10">
          <Armchair className="h-4 w-4 text-orange-200/70" />
        </div>
        <div className="h-[9%] w-[10%] rounded-md border border-orange-400/20 bg-orange-500/5" />
        <div className="flex h-[15%] w-[16%] items-center justify-center rounded-md border border-orange-400/25 bg-orange-500/10">
          <Armchair className="h-4 w-4 text-orange-200/70" />
        </div>
      </div>
      <div className="absolute bottom-[30%] left-1/2 flex h-[15%] w-[16%] -translate-x-1/2 items-center justify-center rounded-md border border-orange-400/25 bg-orange-500/10">
        <Armchair className="h-4 w-4 text-orange-200/70" />
      </div>

      {/* Bitki */}
      <div className="absolute bottom-[10%] left-[8%] flex h-[13%] w-[13%] items-center justify-center rounded-full border border-orange-400/25 bg-orange-500/10">
        <Leaf className="h-4 w-4 text-orange-200/70" />
      </div>
    </div>
  )
}

export default function RoomLounge() {
  return (
    <div className="relative rounded-2xl border border-orange-900/20 bg-orange-950/10">
      <span className="absolute left-3 top-3 z-10 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        Ortak Alan
      </span>
      <RoomLoungeDecor />
    </div>
  )
}
