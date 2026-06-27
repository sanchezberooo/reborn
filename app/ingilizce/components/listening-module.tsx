'use client'

const LEVELS = [
  { label: 'A1', color: '#22c55e', desc: 'Basit diyaloglar, sayılar, selamlaşmalar' },
  { label: 'A2', color: '#3b82f6', desc: 'Kısa haberler, yön tarifleri, alışveriş diyalogları' },
  { label: 'B1', color: '#c8a96e', desc: 'Podcast klipleri, akademik konuşmalar, IELTS Listening pratik' },
  { label: 'B2', color: '#8b5cf6', desc: 'İleri seviye — Haziran 2026\'da açılıyor' },
]

function PlaceholderCard({ level, color, desc }: { level: string; color: string; desc: string }) {
  return (
    <div
      style={{
        background: '#111111',
        border: `1px solid ${color}25`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        opacity: level === 'B2' ? 0.5 : 1,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          background: color + '15',
          border: `1px solid ${color}30`,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {level === 'B2' ? (
          <span style={{ fontSize: 20 }}>🔒</span>
        ) : (
          <span style={{ fontSize: 20 }}>🎧</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color,
              background: color + '20',
              border: `1px solid ${color}40`,
              borderRadius: 4,
              padding: '2px 6px',
            }}
          >
            {level}
          </span>
          {level !== 'B2' && (
            <span
              style={{
                fontSize: 10,
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 4,
                padding: '2px 6px',
              }}
            >
              Yakında eklenecek
            </span>
          )}
        </div>
        <p style={{ color: '#ffffff', fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
          {level} Seviyesi Dinleme
        </p>
        <p style={{ color: '#a0a0a0', fontSize: 12 }}>{desc}</p>
      </div>
    </div>
  )
}

export function ListeningModule() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Dinleme</h2>
        <p style={{ color: '#a0a0a0', fontSize: 13 }}>Tüm seviyeler için dinleme materyalleri hazırlanıyor.</p>
      </div>

      <div
        style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>🚧</span>
        <div>
          <p style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Bu modül hazırlanıyor</p>
          <p style={{ color: '#a0a0a0', fontSize: 12 }}>
            Dinleme materyalleri (podcast klipleri, konuşmalar, IELTS pratik) yakında eklenecek.
            Sanchez seni bilgilendirecek!
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {LEVELS.map((lv) => (
          <PlaceholderCard key={lv.label} level={lv.label} color={lv.color} desc={lv.desc} />
        ))}
      </div>
    </div>
  )
}
