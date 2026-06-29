'use client'

import { useState, useEffect } from 'react'
import { dbLoadModules, dbExecuteAction } from '@/lib/db'

// ── types ────────────────────────────────────────────────────────────────────

type SchoolStatus = 'arastiriliyor' | 'hedef' | 'basvuruldu' | 'elendi'

interface School {
  id: string
  name: string
  location: string
  scholarshipType: string
  acceptanceRate: string
  seeksProfile: string
  strengthsFocus: string[]
  notes: string
  officialUrl: string
  status: SchoolStatus
}

// ── seed data ────────────────────────────────────────────────────────────────

const SEED_SCHOOLS: School[] = [
  {
    id: 'berea',
    name: 'Berea College',
    location: 'Kentucky, ABD',
    scholarshipType: 'İhtiyaç bazlı %100',
    acceptanceRate: '~32%',
    seeksProfile: 'Finansal ihtiyacı olan ve çalışmaya istekli öğrencileri destekler; tüm öğrenciler haftada 10 saat zorunlu çalışma programına katılır. Birinci nesil üniversite öğrencilerini ve uluslararası adayları özellikle karşılar — öğrenim ücreti yoktur.',
    strengthsFocus: ['Motivasyon', 'İhtiyaç', 'Hikaye', 'Çalışma Azmi'],
    notes: 'Dünyada eşi nadir bir model: sıfır öğrenim ücreti. Uluslararası başvurular için özel form ve belgeler gerekir.',
    officialUrl: 'https://www.berea.edu/admissions/international-students/',
    status: 'arastiriliyor',
  },
  {
    id: 'amherst',
    name: 'Amherst College',
    location: 'Massachusetts, ABD',
    scholarshipType: 'İhtiyaç bazlı %100',
    acceptanceRate: '~11%',
    seeksProfile: 'Kabul edilen tüm öğrencilerin %100 finansal ihtiyacını borçsuz paketlerle karşılar; uluslararası öğrenciler dahil. Fikri meraklı, topluma katkı sağlayan ve akademik tutkusu güçlü adayları tercih eder.',
    strengthsFocus: ['Akademik', 'Araştırma', 'Liderlik', 'Hikaye'],
    notes: 'Uluslararası başvurular need-aware olabilir — kabul sonrası tam finansal ihtiyaç karşılanır. En güncel politikayı doğrula.',
    officialUrl: 'https://www.amherst.edu/offices/financial_aid/international',
    status: 'arastiriliyor',
  },
  {
    id: 'williams',
    name: 'Williams College',
    location: 'Massachusetts, ABD',
    scholarshipType: 'İhtiyaç bazlı %100',
    acceptanceRate: '~13%',
    seeksProfile: 'Kabul edilen uluslararası öğrencilerin %100 finansal ihtiyacını borçsuz paketlerle karşılar. Fikri bağımsız, topluluk odaklı ve akademik açıdan istekli öğrenciler arıyor.',
    strengthsFocus: ['Akademik', 'Topluluk', 'Merak', 'Liderlik'],
    notes: 'Uluslararası başvurularda need-aware politika uygulanabilir — resmi siteden güncel bilgiyi doğrula.',
    officialUrl: 'https://admission.williams.edu/financial-aid/',
    status: 'arastiriliyor',
  },
  {
    id: 'mit',
    name: 'MIT',
    location: 'Massachusetts, ABD',
    scholarshipType: 'İhtiyaç bazlı %100',
    acceptanceRate: '~4%',
    seeksProfile: 'STEM alanında olağanüstü başarı ve problem çözme yetkinliği arıyor. Finansal ihtiyacı olan uluslararası öğrencilere de destek sağlar; özgün projeler ve araştırma deneyimi öne çıkar.',
    strengthsFocus: ['STEM', 'Araştırma', 'Proje', 'Akademik'],
    notes: 'Uluslararası öğrencilere yönelik finansal yardım politikası değişkenlik gösterebilir — resmi sayfadan doğrula.',
    officialUrl: 'https://mitadmissions.org/apply/finaid/international/',
    status: 'arastiriliyor',
  },
  {
    id: 'harvard',
    name: 'Harvard University',
    location: 'Massachusetts, ABD',
    scholarshipType: 'İhtiyaç bazlı %100',
    acceptanceRate: '~4%',
    seeksProfile: 'Uluslararası öğrenciler dahil tüm kabul edilenlerin %100 finansal ihtiyacını karşılar. Olağanüstü akademik başarı, liderlik ve toplumsal etki peşindeki öğrencileri arar.',
    strengthsFocus: ['Akademik', 'Liderlik', 'Sosyal Etki', 'Hikaye'],
    notes: 'Need-blind uluslararası burs politikası dünyanın en güçlü paketlerinden biri. Rekabet son derece yüksek.',
    officialUrl: 'https://college.harvard.edu/financial-aid/international-students',
    status: 'arastiriliyor',
  },
  {
    id: 'princeton',
    name: 'Princeton University',
    location: 'New Jersey, ABD',
    scholarshipType: 'İhtiyaç bazlı %100',
    acceptanceRate: '~7%',
    seeksProfile: 'Uluslararası öğrenciler dahil tüm kabul edilenlerin %100 finansal ihtiyacını borçsuz paketlerle karşılar. Fikri derinlik, özgünlük ve araştırma potansiyeli ön planda tutulur.',
    strengthsFocus: ['Akademik', 'Araştırma', 'Özgünlük', 'Sosyal Etki'],
    notes: 'Need-blind uluslararası kabul politikası var. Burs paketleri borç içermez — hibe ve çalışma programından oluşur.',
    officialUrl: 'https://admission.princeton.edu/cost-aid/types-aid',
    status: 'arastiriliyor',
  },
  {
    id: 'davidson',
    name: 'Davidson College',
    location: 'Kuzey Carolina, ABD',
    scholarshipType: 'İhtiyaç bazlı %100',
    acceptanceRate: '~19%',
    seeksProfile: 'Dürüstlük, toplum değerleri ve güçlü akademik profil arıyor. Uluslararası öğrenciler için finansal yardım mevcut; küçük liberal arts ortamında yakın öğretim-öğrenci ilişkisi öne çıkar.',
    strengthsFocus: ['Liderlik', 'Dürüstlük', 'Akademik', 'Topluluk'],
    notes: 'Uluslararası öğrencilere yönelik burs kapasitesi sınırlı olabilir — en güncel politikayı resmi siteden doğrula.',
    officialUrl: 'https://www.davidson.edu/offices/financial-aid/international-students',
    status: 'arastiriliyor',
  },
  {
    id: 'grinnell',
    name: 'Grinnell College',
    location: 'Iowa, ABD',
    scholarshipType: 'İhtiyaç bazlı %100',
    acceptanceRate: '~20%',
    seeksProfile: 'Uluslararası öğrenciler dahil finansal ihtiyacı olan tüm öğrencileri kapsamlı burslarla desteklemeyi hedefler. Sosyal adalet bilinci yüksek, özerk düşünen ve meraklı öğrencilere öncelik verir.',
    strengthsFocus: ['Sosyal Etki', 'Merak', 'Özgünlük', 'Akademik'],
    notes: 'Yüksek endowment kapasitesi sayesinde güçlü financial aid sunuyor. Küçük sınıf boyutu avantajlı.',
    officialUrl: 'https://www.grinnell.edu/admission/financial-aid/international',
    status: 'arastiriliyor',
  },
  {
    id: 'macalester',
    name: 'Macalester College',
    location: 'Minnesota, ABD',
    scholarshipType: 'İhtiyaç bazlı (sınırlı)',
    acceptanceRate: '~40%',
    seeksProfile: 'Küresel bakış açısına sahip, çok kültürlülüğü önemseyen öğrencilere yönelik aktif bir kampüs ortamı sunar. Uluslararası öğrencilere finansal yardım sağlar; tam ihtiyaç karşılaması garanti değildir.',
    strengthsFocus: ['Küresel Bakış', 'Topluluk', 'Çeşitlilik', 'Liderlik'],
    notes: 'Tam burs garantisi yok. Mevcut fonlar için erken başvuru ve detaylı araştırma önerilir.',
    officialUrl: 'https://www.macalester.edu/admission/financialaid/international/',
    status: 'arastiriliyor',
  },
  {
    id: 'oberlin',
    name: 'Oberlin College',
    location: 'Ohio, ABD',
    scholarshipType: 'İhtiyaç bazlı (sınırlı)',
    acceptanceRate: '~35%',
    seeksProfile: 'Sanat, müzik, sosyal adalet ve aktivizme ilgi duyan öğrenciler için güçlü bir akademik-sanatsal ekosistem sunar. Uluslararası öğrencilere finansal yardım sağlar; konservatuar için ayrı burs seçenekleri mevcut.',
    strengthsFocus: ['Sanat', 'Müzik', 'Sosyal Etki', 'Özgünlük'],
    notes: 'Uluslararası öğrenciler için finansal yardım sınırlı. Konservatuar ve Sanat Koleji için burs politikaları farklı olabilir.',
    officialUrl: 'https://www.oberlin.edu/admissions-and-aid/financial-aid/international-students',
    status: 'arastiriliyor',
  },
]

// ── constants ────────────────────────────────────────────────────────────────

const GOLD = '#c8a96e'

const STATUS_META: Record<SchoolStatus, { label: string; color: string; bg: string; dot: string }> = {
  arastiriliyor: { label: 'Araştırılıyor', color: '#a0a0a0', bg: 'rgba(160,160,160,0.08)', dot: 'bg-muted/50' },
  hedef:         { label: 'Hedef',         color: GOLD,      bg: 'rgba(200,169,110,0.10)', dot: 'bg-gold animate-pulse' },
  basvuruldu:    { label: 'Başvuruldu',    color: '#6eb5c8', bg: 'rgba(110,181,200,0.10)', dot: 'bg-sky-400' },
  elendi:        { label: 'Elendi',        color: '#c86e6e', bg: 'rgba(200,110,110,0.08)', dot: 'bg-red-400/60' },
}

const TYPE_COLOR: Record<string, string> = {
  'İhtiyaç bazlı %100':      GOLD,
  'İhtiyaç bazlı (sınırlı)': '#c8956e',
  'Merit + İhtiyaç':          '#6eb5c8',
}

function typeColor(t: string): string { return TYPE_COLOR[t] ?? '#a0a0a0' }

// ── small atoms ──────────────────────────────────────────────────────────────

function ScholarshipBadge({ type }: { type: string }) {
  const c = typeColor(type)
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none"
      style={{ background: `${c}18`, color: c, border: `1px solid ${c}30` }}>
      {type}
    </span>
  )
}

function FocusTag({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium text-muted/70"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {tag}
    </span>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
      style={active
        ? { background: GOLD, color: '#0a0a0a' }
        : { background: 'rgba(255,255,255,0.04)', color: '#a0a0a0', border: '1px solid rgba(255,255,255,0.08)' }
      }
    >
      {children}
    </button>
  )
}

// ── school card ───────────────────────────────────────────────────────────────

function SchoolCard({ school, onClick }: { school: School; onClick: () => void }) {
  const sm = STATUS_META[school.status]
  const isTarget = school.status === 'hedef'
  const tc = typeColor(school.scholarshipType)

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 flex flex-col overflow-hidden"
      style={{
        background: '#0f0f0f',
        borderColor: isTarget ? `${GOLD}50` : '#1e1e1e',
        borderTopColor: isTarget ? GOLD : tc,
        borderTopWidth: '2px',
        boxShadow: isTarget ? `0 0 24px ${GOLD}12` : '0 1px 3px rgba(0,0,0,0.3)',
      }}
    >
      {/* ── header ── */}
      <div className="px-5 pt-5 pb-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-display text-[17px] font-semibold text-foreground leading-snug line-clamp-1 group-hover:text-gold transition-colors">
              {school.name}
            </p>
            <p className="text-[11px] text-muted/50 mt-0.5">{school.location}</p>
          </div>
          {/* status dot */}
          <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
            <span className="text-[9px] font-medium" style={{ color: sm.color }}>{sm.label}</span>
          </div>
        </div>

        <ScholarshipBadge type={school.scholarshipType} />

        {/* profile snippet */}
        <p className="text-[11px] text-muted/60 leading-relaxed line-clamp-2">{school.seeksProfile}</p>
      </div>

      {/* ── footer ── */}
      <div className="px-5 pb-4 flex flex-wrap gap-1.5 items-center">
        {school.strengthsFocus.map((tag) => (
          <FocusTag key={tag} tag={tag} />
        ))}
        <span className="ml-auto text-[10px] text-muted/30">{school.acceptanceRate}</span>
      </div>

      {/* bottom accent line for hedef */}
      {isTarget && (
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}40, transparent)` }} />
      )}
    </button>
  )
}

// ── detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  school,
  onClose,
  onStatusChange,
  onDeepen,
  deepenLoading,
}: {
  school: School
  onClose: () => void
  onStatusChange: (id: string, status: SchoolStatus) => void
  onDeepen: (id: string) => void
  deepenLoading: boolean
}) {
  const sm = STATUS_META[school.status]
  const tc = typeColor(school.scholarshipType)

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-background border-l border-border overflow-y-auto"
        style={{ boxShadow: '-8px 0 40px rgba(0,0,0,0.6)' }}>

        {/* accent line */}
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${tc}, ${tc}, transparent)` }} />

        <div className="px-8 py-8">
          <button onClick={onClose}
            className="absolute top-6 right-6 text-muted/40 hover:text-foreground text-xl leading-none transition-colors">
            ×
          </button>

          {/* name + location */}
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-foreground leading-tight mb-1">{school.name}</h2>
            <p className="text-sm text-muted/60">{school.location}</p>
          </div>

          {/* quick stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl border border-border p-3" style={{ background: '#0f0f0f' }}>
              <p className="text-[9px] text-muted/40 uppercase tracking-widest font-medium mb-1">Kabul Oranı</p>
              <p className="text-base font-semibold text-foreground">{school.acceptanceRate}</p>
            </div>
            <div className="rounded-xl border border-border p-3" style={{ background: '#0f0f0f' }}>
              <p className="text-[9px] text-muted/40 uppercase tracking-widest font-medium mb-1">Burs Türü</p>
              <p className="text-xs font-semibold" style={{ color: tc }}>{school.scholarshipType}</p>
            </div>
          </div>

          {/* status selector */}
          <div className="mb-6">
            <p className="text-[9px] text-muted/40 uppercase tracking-widest font-medium mb-2.5">Durum</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(STATUS_META) as [SchoolStatus, typeof STATUS_META[SchoolStatus]][]).map(([key, meta]) => (
                <button key={key}
                  onClick={() => onStatusChange(school.id, key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={school.status === key
                    ? { background: meta.bg, color: meta.color, border: `1px solid ${meta.color}50` }
                    : { background: 'rgba(255,255,255,0.03)', color: '#a0a0a0', border: '1px solid rgba(255,255,255,0.07)' }
                  }
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* seeks profile */}
          <div className="mb-5">
            <p className="text-[9px] text-muted/40 uppercase tracking-widest font-medium mb-2">Nasıl Öğrenci Arıyor</p>
            <div className="rounded-xl border border-border p-4 text-sm text-foreground/80 leading-relaxed"
              style={{ background: '#0f0f0f', borderLeftColor: tc, borderLeftWidth: '2px' }}>
              {school.seeksProfile}
            </div>
          </div>

          {/* strengths */}
          <div className="mb-5">
            <p className="text-[9px] text-muted/40 uppercase tracking-widest font-medium mb-2">Güç Odakları</p>
            <div className="flex flex-wrap gap-2">
              {school.strengthsFocus.map((tag) => (
                <span key={tag}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: `${tc}14`, color: tc, border: `1px solid ${tc}30` }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* notes */}
          {school.notes && (
            <div className="mb-6">
              <p className="text-[9px] text-muted/40 uppercase tracking-widest font-medium mb-2">Notlar</p>
              <div className="rounded-xl border border-border/50 p-3.5 text-xs text-muted/70 leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                {school.notes}
              </div>
            </div>
          )}

          {/* deepen button */}
          <button
            onClick={() => onDeepen(school.id)}
            disabled={deepenLoading}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50 mb-3"
            style={{ background: `${GOLD}14`, color: GOLD, border: `1px solid ${GOLD}30` }}
          >
            {deepenLoading ? (
              <span className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1 h-1 rounded-full animate-bounce"
                    style={{ background: GOLD, animationDelay: `${i * 100}ms` }} />
                ))}
              </span>
            ) : (
              'Bu okulu derinleştir'
            )}
          </button>

          {/* official link */}
          <a
            href={school.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: GOLD, color: '#0a0a0a' }}
          >
            Resmi Sayfayı Aç
            <span className="text-base leading-none">↗</span>
          </a>
        </div>
      </div>
    </>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function BursAkademiPage() {
  const [schools,        setSchools]        = useState<School[]>([])
  const [loaded,         setLoaded]         = useState(false)
  const [filterType,     setFilterType]     = useState('all')
  const [filterStatus,   setFilterStatus]   = useState('all')
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
  const [researchLoading, setResearchLoading] = useState(false)
  const [deepenLoading,   setDeepenLoading]   = useState<string | null>(null)

  useEffect(() => {
    dbLoadModules().then((mods) => {
      const mod = mods.find((m) => m.id === 'burs-akademisi')
      if (mod) {
        const stored = (mod.data.schools as School[] | undefined) ?? []
        setSchools(stored.length > 0 ? stored : SEED_SCHOOLS)
      } else {
        dbExecuteAction({
          type: 'CREATE_MODULE',
          payload: { id: 'burs-akademisi', name: 'Burs Akademisi', icon: '🎓', color: GOLD, data: { schools: SEED_SCHOOLS } },
        }).catch(() => {})
        setSchools(SEED_SCHOOLS)
      }
    }).catch(() => setSchools(SEED_SCHOOLS)).finally(() => setLoaded(true))
  }, [])

  const researchMoreSchools = async () => {
    if (researchLoading) return
    setResearchLoading(true)
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: 'burs-toplu-arastirma',
          input: { count: 5, existingSchoolNames: schools.map((s) => s.name) },
        }),
      })
      const run = await res.json()
      const newSchools = (run.output?.schools as School[] | undefined) ?? []
      if (newSchools.length > 0) {
        const existingIds   = new Set(schools.map((s) => s.id))
        const existingNames = new Set(schools.map((s) => s.name.toLowerCase()))
        const deduped = newSchools.filter(
          (s) => !existingIds.has(s.id) && !existingNames.has(s.name.toLowerCase())
        )
        if (deduped.length > 0) {
          const merged = [...schools, ...deduped]
          setSchools(merged)
          await dbExecuteAction({
            type: 'UPDATE_MODULE',
            payload: { id: 'burs-akademisi', patch: { schools: merged } },
          }).catch(() => {})
        }
      }
    } catch {
      // silently fail
    } finally {
      setResearchLoading(false)
    }
  }

  const deepenSchool = async (schoolId: string) => {
    if (deepenLoading) return
    setDeepenLoading(schoolId)
    const school = schools.find((s) => s.id === schoolId)
    if (!school) { setDeepenLoading(null); return }
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: 'burs-derinlestir',
          input: { schoolName: school.name, schoolId: school.id },
        }),
      })
      const run = await res.json()
      const patch = run.output as Partial<School> | undefined
      if (patch && typeof patch === 'object') {
        const updated = schools.map((s) => s.id === schoolId ? { ...s, ...patch } : s)
        setSchools(updated)
        setSelectedSchool((p) => (p?.id === schoolId ? { ...p, ...patch } : p))
        await dbExecuteAction({
          type: 'UPDATE_MODULE',
          payload: { id: 'burs-akademisi', patch: { schools: updated } },
        }).catch(() => {})
      }
    } catch {
      // silently fail
    } finally {
      setDeepenLoading(null)
    }
  }

  const updateStatus = (schoolId: string, status: SchoolStatus) => {
    const updated = schools.map((s) => s.id === schoolId ? { ...s, status } : s)
    setSchools(updated)
    if (selectedSchool?.id === schoolId) setSelectedSchool((p) => p ? { ...p, status } : null)
    dbExecuteAction({
      type: 'UPDATE_MODULE',
      payload: { id: 'burs-akademisi', patch: { schools: updated } },
    }).catch(() => {})
  }

  const filtered = schools
    .filter((s) => filterType   === 'all' || s.scholarshipType === filterType)
    .filter((s) => filterStatus === 'all' || s.status          === filterStatus)

  const types    = [...new Set(schools.map((s) => s.scholarshipType))]
  const hedefN   = schools.filter((s) => s.status === 'hedef').length
  const basvN    = schools.filter((s) => s.status === 'basvuruldu').length

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: GOLD, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* ── header ── */}
        <div className="mb-8">
          <div className="flex items-end justify-between gap-4 mb-2">
            <h1 className="font-display text-3xl font-bold text-foreground">Burs Akademisi</h1>
            <div className="flex items-center gap-3 pb-0.5">
              {hedefN > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GOLD }} />
                  <span className="text-xs text-muted/60"><span style={{ color: GOLD }} className="font-semibold">{hedefN}</span> hedef</span>
                </div>
              )}
              {basvN > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  <span className="text-xs text-muted/60"><span className="text-sky-400 font-semibold">{basvN}</span> başvuruldu</span>
                </div>
              )}
              <span className="text-xs text-muted/40">{schools.length} okul</span>
              <button
                onClick={researchMoreSchools}
                disabled={researchLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all disabled:opacity-60"
                style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}30` }}
              >
                {researchLoading ? (
                  <>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1 h-1 rounded-full animate-bounce"
                        style={{ background: GOLD, animationDelay: `${i * 100}ms` }} />
                    ))}
                  </>
                ) : (
                  '+ Daha fazla okul araştır'
                )}
              </button>
            </div>
          </div>
          <p className="text-sm text-muted/50">ABD'de tam burs veren üniversiteler — uluslararası öğrenciler için</p>
        </div>

        {/* ── filter bar ── */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {/* type filters */}
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={filterType === 'all'} onClick={() => setFilterType('all')}>Tüm Türler</FilterPill>
            {types.map((t) => (
              <FilterPill key={t} active={filterType === t} onClick={() => setFilterType(t)}>{t}</FilterPill>
            ))}
          </div>

          <div className="w-px h-4 bg-border/50 hidden sm:block" />

          {/* status filters */}
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>Tümü</FilterPill>
            {(Object.entries(STATUS_META) as [SchoolStatus, typeof STATUS_META[SchoolStatus]][]).map(([key, meta]) => (
              <FilterPill key={key} active={filterStatus === key} onClick={() => setFilterStatus(key)}>
                {meta.label}
              </FilterPill>
            ))}
          </div>
        </div>

        {/* ── grid ── */}
        {filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-muted/30 text-sm">Bu filtreye uyan okul bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((school) => (
              <SchoolCard
                key={school.id}
                school={school}
                onClick={() => setSelectedSchool(school)}
              />
            ))}
          </div>
        )}

      </div>

      {/* ── detail panel ── */}
      {selectedSchool && (
        <DetailPanel
          school={selectedSchool}
          onClose={() => setSelectedSchool(null)}
          onStatusChange={updateStatus}
          onDeepen={deepenSchool}
          deepenLoading={deepenLoading === selectedSchool.id}
        />
      )}
    </div>
  )
}
