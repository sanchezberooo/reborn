import { Archive, Computer } from 'lucide-react'
import PixelAvatar from './PixelAvatar'

// Dekor katmanı: en "dolu/kalabalık" oda hissi — açık ofis referansı,
// çok masa. Avatar katmanı ileride bu dekorun önünde konumlanacak.
function RoomWorkspaceDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {/* Arka taraf: dosya dolapları */}
      <div className="absolute right-[6%] top-[10%] flex gap-[3%]">
        <div className="flex h-[13%] w-[9%] items-center justify-center rounded-md border border-border bg-card/60">
          <Archive className="h-3.5 w-3.5 text-muted-foreground/70" />
        </div>
        <div className="flex h-[13%] w-[9%] items-center justify-center rounded-md border border-border bg-card/60">
          <Archive className="h-3.5 w-3.5 text-muted-foreground/70" />
        </div>
      </div>

      {/* Masa sırası — 4 masa, her birinde bilgisayar ikonu */}
      <div className="absolute bottom-[10%] left-[6%] right-[6%] grid grid-cols-2 gap-[5%] sm:grid-cols-4">
        <div className="flex h-[20%] flex-col items-center justify-center gap-1 rounded-md border border-border bg-card/60 py-2">
          <Computer className="h-3.5 w-3.5 text-muted-foreground/80" />
        </div>
        <div className="flex h-[20%] flex-col items-center justify-center gap-1 rounded-md border border-border bg-card/60 py-2">
          <Computer className="h-3.5 w-3.5 text-muted-foreground/80" />
        </div>
        <div className="flex h-[20%] flex-col items-center justify-center gap-1 rounded-md border border-border bg-card/60 py-2">
          <Computer className="h-3.5 w-3.5 text-muted-foreground/80" />
        </div>
        <div className="flex h-[20%] flex-col items-center justify-center gap-1 rounded-md border border-border bg-card/60 py-2">
          <Computer className="h-3.5 w-3.5 text-muted-foreground/80" />
        </div>
      </div>

      {/* Küçük aksesuar detayları: minimal not kağıdı öğeleri */}
      <div className="absolute bottom-[32%] left-[10%] h-[3%] w-[6%] rounded-sm bg-muted-foreground/20" />
      <div className="absolute bottom-[32%] left-[38%] h-[3%] w-[6%] rounded-sm bg-muted-foreground/20" />
      <div className="absolute bottom-[32%] right-[16%] h-[3%] w-[6%] rounded-sm bg-muted-foreground/20" />
    </div>
  )
}

export default function RoomWorkspace() {
  return (
    <div className="relative rounded-2xl border border-border bg-card/40">
      <span className="absolute left-3 top-3 z-10 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        Çalışma Alanı
      </span>
      <RoomWorkspaceDecor />
      <div className="absolute bottom-[34%] left-[20%] z-10">
        <PixelAvatar colorScheme="knowledge" name="Knowledge Agent" />
      </div>
      <div className="absolute bottom-[34%] right-[20%] z-10">
        <PixelAvatar colorScheme="marketing" name="Marketing Agent" />
      </div>
    </div>
  )
}
