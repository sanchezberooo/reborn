export default function CommunityPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <div>
        <p className="text-foreground font-semibold text-lg">Topluluk</p>
        <p className="text-muted text-sm mt-1.5 max-w-xs leading-relaxed">
          Burs hedefli öğrencilerin buluşma noktası. Yakında açılıyor.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted/50">
        <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-pulse" />
        Geliştirme aşamasında
      </div>
    </div>
  )
}
