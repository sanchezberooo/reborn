import RoomWorkspace from './RoomWorkspace'
import RoomBrain from './RoomBrain'
import RoomLounge from './RoomLounge'
import RoomSanchez from './RoomSanchez'

// 2x2 asimetrik oda grid'i: Çalışma Alanı en büyük oda (sol üst), diğer
// üçü ona göre daha küçük. Odalar arasındaki gap koridor boşluğunu temsil
// eder; ortadaki kesikli çerçeve ileride dekorasyonu gelecek ara-geçit
// alanının yer tutucusudur.
// Uzay zemini: merkezden kenara koyulaşan lacivert-siyah radial gradient +
// iki katmanlı, farklı boyutlarda tekrar eden nokta (yıldız) deseni. Yakın
// katman çok yavaş bir opacity nabzı ile hafifçe titreşir; uzak katman
// sabit kalır (derinlik hissi). Odaların kendi arkaplanı değişmedi — bu
// zemin yalnızca grid'in gap/padding boşluklarından görünür.
const FAR_STARS = {
  backgroundImage: `
    radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.55) 50%, transparent 100%),
    radial-gradient(1px 1px at 90px 70px, rgba(255,255,255,0.4) 50%, transparent 100%),
    radial-gradient(1px 1px at 130px 20px, rgba(255,255,255,0.35) 50%, transparent 100%),
    radial-gradient(1px 1px at 50px 110px, rgba(255,255,255,0.45) 50%, transparent 100%)
  `,
  backgroundRepeat: 'repeat',
  backgroundSize: '160px 160px',
}

const NEAR_STARS = {
  backgroundImage: `
    radial-gradient(1.5px 1.5px at 40px 60px, rgba(255,255,255,0.8) 50%, transparent 100%),
    radial-gradient(1.5px 1.5px at 180px 30px, rgba(255,255,255,0.65) 50%, transparent 100%),
    radial-gradient(1px 1px at 110px 150px, rgba(255,255,255,0.6) 50%, transparent 100%),
    radial-gradient(1.5px 1.5px at 220px 190px, rgba(255,255,255,0.7) 50%, transparent 100%)
  `,
  backgroundRepeat: 'repeat',
  backgroundSize: '240px 240px',
}

export default function OfficeLayout() {
  return (
    <div
      className="relative h-full min-h-[520px] w-full overflow-hidden p-[6%]"
      style={{
        background: 'radial-gradient(ellipse at center, #131b3a 0%, #070a16 55%, #000000 100%)',
      }}
    >
      <style>{`
        @keyframes maxaiStarPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.85; }
        }
        .maxai-star-pulse {
          animation: maxaiStarPulse 6s ease-in-out infinite;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0" style={FAR_STARS} />
      <div className="maxai-star-pulse pointer-events-none absolute inset-0" style={NEAR_STARS} />
      <div
        className="relative z-10 grid h-full w-full gap-[6%]"
        style={{ gridTemplateColumns: '1.35fr 1fr', gridTemplateRows: '1.25fr 1fr' }}
      >
        <RoomWorkspace />
        <RoomBrain />
        <RoomLounge />
        <RoomSanchez />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-border/40" />
    </div>
  )
}
