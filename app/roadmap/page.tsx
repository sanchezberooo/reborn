'use client'

import { useState, useEffect } from 'react'
import { dbLoadModules, dbExecuteAction } from '@/lib/db'
import type { ModuleItem } from '@/lib/modules'

// ─── types ────────────────────────────────────────────────────────────────────

interface Milestone {
  title: string
  date: string
  type: 'milestone' | 'task' | 'goal' | 'deadline'
  status: 'pending' | 'in_progress' | 'done' | 'overdue'
  notes?: string
  category?: string
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function formatDateTR(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function urgencyColor(days: number, status: string): string {
  if (status === 'done') return '#6ec8a9'
  if (days < 0) return '#c86e6e'
  if (days <= 30) return '#c86e6e'
  if (days <= 90) return '#c8a96e'
  return '#6eb5c8'
}

const TYPE_LABELS: Record<string, string> = {
  milestone: 'Kilometre Taşı',
  task: 'Görev',
  goal: 'Hedef',
  deadline: 'Son Tarih',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  in_progress: 'Devam Ediyor',
  done: 'Tamamlandı',
  overdue: 'Gecikti',
}

// Default scholarship timeline
const DEFAULT_MILESTONES: Milestone[] = [
  { title: 'IELTS Sınavı', date: '2026-09-01', type: 'deadline', status: 'pending', category: 'ielts', notes: 'Hedef: 7.0+' },
  { title: 'Ortak Başvuru Formu (Common App) Açılışı', date: '2026-08-01', type: 'milestone', status: 'pending', category: 'scholarship' },
  { title: 'Burs Deneme Makalesi Taslağı', date: '2026-06-01', type: 'task', status: 'pending', category: 'scholarship', notes: '"Why us?" + "Why CS?" + "Who are you?"' },
  { title: 'Berea College Başvuru Son Tarihi', date: '2026-11-01', type: 'deadline', status: 'pending', category: 'scholarship' },
  { title: 'Grinnell College Başvuru Son Tarihi', date: '2026-11-01', type: 'deadline', status: 'pending', category: 'scholarship' },
  { title: 'Davidson College Başvuru Son Tarihi', date: '2026-11-15', type: 'deadline', status: 'pending', category: 'scholarship' },
  { title: 'Macalester College Başvuru Son Tarihi', date: '2026-11-15', type: 'deadline', status: 'pending', category: 'scholarship' },
  { title: 'Reborn v1 Demo Hazır', date: '2026-07-01', type: 'goal', status: 'pending', category: 'project', notes: 'Burs portfolyo parçası olarak gösterilecek' },
  { title: 'Tavsiye Mektubu Talepleri', date: '2026-08-15', type: 'task', status: 'pending', category: 'scholarship', notes: 'En az 2 öğretmen + 1 mentor' },
  { title: 'İngilizce B2 Seviyesi', date: '2026-07-01', type: 'goal', status: 'pending', category: 'ielts' },
  { title: 'Portfolyo Website Yayına Alma', date: '2026-08-01', type: 'task', status: 'pending', category: 'project' },
]

// ─── add milestone modal ──────────────────────────────────────────────────────

function AddModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (m: Omit<Milestone, 'status'>) => void
}) {
  const [title, setTitle]    = useState('')
  const [date, setDate]      = useState('')
  const [type, setType]      = useState<Milestone['type']>('milestone')
  const [notes, setNotes]    = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    onAdd({ title: title.trim(), date, type, notes: notes.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#111111', border: '1px solid #2a2a2a', borderTop: '2px solid #c8a96e' }}>
        <h3 className="font-display text-lg font-semibold text-foreground mb-5">Yeni Hedef Ekle</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted/50 uppercase tracking-wider font-semibold">Başlık</label>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder="Hedef veya görev adı..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted/25 focus:outline-none focus:border-[#c8a96e]/50 transition"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-muted/50 uppercase tracking-wider font-semibold">Tarih</label>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#c8a96e]/50 transition"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-muted/50 uppercase tracking-wider font-semibold">Tür</label>
              <select
                value={type} onChange={(e) => setType(e.target.value as Milestone['type'])}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#c8a96e]/50 transition"
              >
                <option value="milestone">Kilometre Taşı</option>
                <option value="task">Görev</option>
                <option value="goal">Hedef</option>
                <option value="deadline">Son Tarih</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-muted/50 uppercase tracking-wider font-semibold">Notlar (opsiyonel)</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} placeholder="Ek detaylar..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted/25 resize-none focus:outline-none focus:border-[#c8a96e]/50 transition"
            />
          </div>
          <div className="flex gap-3 mt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-muted hover:text-foreground hover:border-foreground/20 transition"
            >
              İptal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
              style={{ background: '#c8a96e', color: '#0a0a0a' }}
            >
              Ekle
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── milestone card ───────────────────────────────────────────────────────────

function MilestoneCard({
  milestone, index, onStatusChange,
}: {
  milestone: Milestone
  index: number
  onStatusChange: (index: number, status: Milestone['status']) => void
}) {
  const days = daysUntil(milestone.date)
  const color = urgencyColor(days, milestone.status)
  const isDone = milestone.status === 'done'

  const statusCycle: Milestone['status'][] = ['pending', 'in_progress', 'done']
  function nextStatus() {
    const i = statusCycle.indexOf(milestone.status)
    onStatusChange(index, statusCycle[(i + 1) % statusCycle.length])
  }

  return (
    <div
      className={`flex gap-4 p-4 rounded-2xl border transition-all ${isDone ? 'opacity-50' : ''}`}
      style={{ background: '#111111', borderColor: '#2a2a2a', borderLeft: `3px solid ${color}` }}
    >
      {/* Status toggle */}
      <button
        onClick={nextStatus}
        className="mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all"
        style={{
          borderColor: isDone ? '#6ec8a9' : color,
          background: isDone ? '#6ec8a920' : 'transparent',
        }}
      >
        {isDone && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3l2 2 4-4" stroke="#6ec8a9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {milestone.status === 'in_progress' && (
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-muted/40' : 'text-foreground'}`}>
            {milestone.title}
          </h3>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-[10px] font-semibold" style={{ color }}>
              {isDone ? '✓ Bitti' : days < 0 ? `${Math.abs(days)}g geçti` : days === 0 ? 'Bugün!' : `${days}g kaldı`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted/40">{formatDateTR(milestone.date)}</span>
          <span className="w-1 h-1 rounded-full bg-muted/20" />
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{ background: `${color}18`, color }}
          >
            {TYPE_LABELS[milestone.type] ?? milestone.type}
          </span>
          <span className="text-[10px] text-muted/30">{STATUS_LABELS[milestone.status]}</span>
        </div>

        {milestone.notes && (
          <p className="text-[11px] text-muted/50 mt-1.5 leading-relaxed">{milestone.notes}</p>
        )}
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const [module, setModule]   = useState<ModuleItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter]   = useState<'all' | 'pending' | 'done'>('all')

  useEffect(() => {
    dbLoadModules().then((mods) => {
      const roadmap = mods.find((m) => m.id === 'roadmap')
      if (roadmap) {
        // Seed defaults if empty
        if (!roadmap.data.milestones || (roadmap.data.milestones as unknown[]).length === 0) {
          dbExecuteAction({
            type: 'UPDATE_MODULE',
            payload: { id: 'roadmap', patch: { milestones: DEFAULT_MILESTONES } },
          }).then((updated) => {
            const m = updated.find((m) => m.id === 'roadmap')
            if (m) setModule(m)
          }).catch(() => setModule(roadmap))
        } else {
          setModule(roadmap)
        }
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const milestones: Milestone[] = (module?.data?.milestones as Milestone[]) ?? []

  const sorted = [...milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const filtered = sorted.filter((m) => {
    if (filter === 'pending') return m.status !== 'done'
    if (filter === 'done') return m.status === 'done'
    return true
  })

  const doneCount    = milestones.filter((m) => m.status === 'done').length
  const pendingCount = milestones.filter((m) => m.status === 'pending' || m.status === 'in_progress').length
  const progress     = milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0

  async function handleStatusChange(index: number, status: Milestone['status']) {
    const updated = sorted.map((m, i) => i === index ? { ...m, status } : m)
    // Sync with Supabase (reorder to original unsorted order)
    const newMilestones = milestones.map((orig) => {
      const found = updated.find((u) => u.title === orig.title && u.date === orig.date)
      return found ?? orig
    })
    setModule((prev) => prev ? { ...prev, data: { ...prev.data, milestones: newMilestones } } : prev)
    dbExecuteAction({
      type: 'UPDATE_MODULE',
      payload: { id: 'roadmap', patch: { milestones: newMilestones } },
    }).catch(() => {})
  }

  async function handleAdd(milestone: Omit<Milestone, 'status'>) {
    const newMilestone: Milestone = { ...milestone, status: 'pending' }
    const newMilestones = [...milestones, newMilestone]
    setModule((prev) => prev ? { ...prev, data: { ...prev.data, milestones: newMilestones } } : prev)
    dbExecuteAction({
      type: 'APPEND_TO_FIELD',
      payload: { id: 'roadmap', field: 'milestones', item: newMilestone },
    }).catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex gap-1.5">
          {[0,1,2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-gold/50 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const nextDeadline = sorted.find((m) => m.status !== 'done' && daysUntil(m.date) >= 0)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">Yol Haritası</h1>
            <p className="text-sm text-muted mt-1">Burs başvurusu — Kasım 2026</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ background: '#c8a96e', color: '#0a0a0a' }}
          >
            + Ekle
          </button>
        </div>

        {/* Progress overview */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-2xl p-4"
            style={{ borderTop: '2px solid #6eb5c8' }}>
            <div className="text-2xl font-semibold text-foreground font-display">{milestones.length}</div>
            <div className="text-xs text-muted mt-1">Toplam Hedef</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4"
            style={{ borderTop: '2px solid #c86e6e' }}>
            <div className="text-2xl font-semibold text-foreground font-display">{pendingCount}</div>
            <div className="text-xs text-muted mt-1">Bekleyen</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-4"
            style={{ borderTop: '2px solid #6ec8a9' }}>
            <div className="text-2xl font-semibold text-foreground font-display">{doneCount}</div>
            <div className="text-xs text-muted mt-1">Tamamlanan</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">Genel İlerleme</span>
            <span className="text-sm font-bold" style={{ color: progress >= 70 ? '#6ec8a9' : '#c8a96e' }}>
              {progress}%
            </span>
          </div>
          <div className="h-2 bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: progress >= 70 ? '#6ec8a9' : '#c8a96e' }}
            />
          </div>
          {nextDeadline && (
            <p className="text-xs text-muted mt-3">
              Sonraki: <span className="text-foreground font-medium">{nextDeadline.title}</span>
              {' '}— <span style={{ color: urgencyColor(daysUntil(nextDeadline.date), nextDeadline.status) }}>
                {daysUntil(nextDeadline.date)} gün kaldı
              </span>
            </p>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4">
          {([['all', 'Tümü'], ['pending', 'Aktif'], ['done', 'Bitti']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`text-xs px-4 py-2 rounded-xl font-medium transition-colors ${
                filter === id
                  ? 'bg-gold text-background'
                  : 'text-muted hover:text-foreground border border-border/50 hover:border-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Milestones */}
        <div className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted/40 text-sm">
              {filter === 'done' ? 'Henüz tamamlanan hedef yok.' : 'Hedef bulunamadı.'}
            </div>
          ) : (
            filtered.map((m, i) => (
              <MilestoneCard
                key={`${m.title}-${m.date}-${i}`}
                milestone={m}
                index={i}
                onStatusChange={handleStatusChange}
              />
            ))
          )}
        </div>

      </div>

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
