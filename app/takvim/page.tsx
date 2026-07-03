'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  dbLoadCalendarEvents,
  dbCreateCalendarEvent,
  dbUpdateCalendarEventTime,
  dbUpdateCalendarEventMeta,
  dbDeleteCalendarEvent,
} from '@/lib/db'
import type { CalendarEvent } from '@/lib/db'

// ─── categories ───────────────────────────────────────────────────────────────

const CATEGORIES = {
  'İngilizce': '#6eb5c8',
  'Spor':      '#6ec8a9',
  'İş':        '#c8a96e',
  'Rutin':     '#956ec8',
  'Diğer':     '#8494a8',
} as const

type Category = keyof typeof CATEGORIES

// ─── types ────────────────────────────────────────────────────────────────────

type DBEvent = CalendarEvent

interface FcEvent {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  textColor: string
  extendedProps: { description: string; category: string }
}

function colorOf(cat: string): string {
  return CATEGORIES[(cat as Category)] ?? CATEGORIES['Diğer']
}

function toFcEvent(e: DBEvent): FcEvent {
  const color = colorOf(e.category ?? 'Diğer')
  return {
    id: e.id,
    title: e.title || 'Etkinlik',
    start: e.start_time,
    end: e.end_time,
    backgroundColor: color + '2a',
    borderColor: color,
    textColor: color,
    extendedProps: {
      description: e.description ?? '',
      category: e.category ?? 'Diğer',
    },
  }
}

// ─── dialog ──────────────────────────────────────────────────────────────────

interface Dialog {
  open: boolean
  mode: 'create' | 'edit'
  eventId?: string
  title: string
  description: string
  category: Category
  start: string
  end: string
}

const EMPTY: Dialog = {
  open: false, mode: 'create',
  title: '', description: '', category: 'Diğer', start: '', end: '',
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function TakvimPage() {
  const [mounted, setMounted] = useState(false)
  const [events,  setEvents]  = useState<FcEvent[]>([])
  const [dialog,  setDialog]  = useState<Dialog>(EMPTY)
  const rangeRef = useRef<{ start: string; end: string } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const loadEvents = useCallback(async (start: string, end: string) => {
    const data = await dbLoadCalendarEvents(start, end)
    if (data) setEvents(data.map(toFcEvent))
  }, [])

  // ── handlers ────────────────────────────────────────────────────────────────

  function handleDatesSet(arg: { startStr: string; endStr: string }) {
    rangeRef.current = { start: arg.startStr, end: arg.endStr }
    loadEvents(arg.startStr, arg.endStr)
  }

  function handleSelect(arg: { startStr: string; endStr: string }) {
    setDialog({ ...EMPTY, open: true, mode: 'create', start: arg.startStr, end: arg.endStr })
  }

  function handleEventClick(arg: {
    event: { id: string; title: string; startStr: string; endStr: string; extendedProps: Record<string, string> }
  }) {
    const ep = arg.event.extendedProps
    setDialog({
      open: true, mode: 'edit',
      eventId: arg.event.id,
      title: arg.event.title,
      description: ep.description ?? '',
      category: (ep.category as Category) ?? 'Diğer',
      start: arg.event.startStr,
      end: arg.event.endStr,
    })
  }

  async function handleEventDrop(arg: {
    event: { id: string; startStr: string; endStr: string }
  }) {
    await dbUpdateCalendarEventTime(arg.event.id, arg.event.startStr, arg.event.endStr)
  }

  async function handleEventResize(arg: {
    event: { id: string; startStr: string; endStr: string }
  }) {
    await dbUpdateCalendarEventTime(arg.event.id, arg.event.startStr, arg.event.endStr)
  }

  // ── dialog save / delete ─────────────────────────────────────────────────

  async function saveDialog() {
    if (!dialog.title.trim()) return
    const color = colorOf(dialog.category)

    if (dialog.mode === 'create') {
      const data = await dbCreateCalendarEvent({
        title: dialog.title,
        description: dialog.description || null,
        start_time: dialog.start,
        end_time: dialog.end,
        category: dialog.category,
      })
      if (data) setEvents((prev) => [...prev, toFcEvent(data)])
    } else {
      await dbUpdateCalendarEventMeta(dialog.eventId!, {
        title: dialog.title,
        description: dialog.description || null,
        category: dialog.category,
      })
      setEvents((prev) =>
        prev.map((e) =>
          e.id === dialog.eventId
            ? {
                ...e,
                title: dialog.title,
                backgroundColor: color + '2a',
                borderColor: color,
                textColor: color,
                extendedProps: { description: dialog.description, category: dialog.category },
              }
            : e,
        ),
      )
    }
    setDialog(EMPTY)
  }

  async function deleteEvent() {
    if (!dialog.eventId) return
    await dbDeleteCalendarEvent(dialog.eventId)
    setEvents((prev) => prev.filter((e) => e.id !== dialog.eventId))
    setDialog(EMPTY)
  }

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#0B0F14' }}>

      {/* header */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-8 py-4 border-b"
        style={{ background: '#0B0F14', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <Link
          href="/dashboard"
          className="text-[11px] font-semibold uppercase tracking-wider hover:opacity-70 transition-opacity"
          style={{ color: '#c8a96e' }}
        >
          ← Dashboard
        </Link>
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <span className="font-display text-base font-semibold text-white/90">Takvim</span>

        {/* legend */}
        <div className="ml-auto flex items-center gap-4">
          {(Object.entries(CATEGORIES) as [Category, string][]).map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1.5 text-[10px]"
              style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* calendar */}
      <div className="px-6 py-5">
        {mounted && (
          <div className="fc-reborn">
            <FullCalendar
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              firstDay={1}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              buttonText={{ today: 'Bugün' }}
              allDaySlot={false}
              slotMinTime="06:00:00"
              slotMaxTime="25:00:00"
              height="auto"
              expandRows={true}
              nowIndicator={true}
              selectable={true}
              selectMirror={true}
              editable={true}
              events={events}
              datesSet={handleDatesSet}
              select={handleSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
            />
          </div>
        )}
      </div>

      {/* event dialog */}
      {dialog.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setDialog(EMPTY)}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 flex flex-col gap-4 shadow-2xl"
            style={{ background: '#121821', borderColor: 'rgba(255,255,255,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {dialog.mode === 'create' ? 'Yeni Etkinlik' : 'Etkinliği Düzenle'}
            </h2>

            {/* title */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Başlık *
              </span>
              <input
                autoFocus
                value={dialog.title}
                onChange={(e) => setDialog((d) => ({ ...d, title: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && saveDialog()}
                placeholder="Etkinlik adı…"
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: '#0B0F14',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0',
                  caretColor: '#c8a96e',
                }}
              />
            </label>

            {/* category pills */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Kategori
              </span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORIES) as Category[]).map((cat) => {
                  const active = dialog.category === cat
                  const c = CATEGORIES[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => setDialog((d) => ({ ...d, category: cat }))}
                      className="px-3 py-1 rounded-full text-[11px] font-medium transition-all"
                      style={{
                        background: active ? c + '28' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${active ? c : 'rgba(255,255,255,0.1)'}`,
                        color: active ? c : 'rgba(255,255,255,0.45)',
                      }}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* description */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Not (opsiyonel)
              </span>
              <textarea
                value={dialog.description}
                onChange={(e) => setDialog((d) => ({ ...d, description: e.target.value }))}
                rows={2}
                placeholder="İsteğe bağlı açıklama…"
                className="rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={{
                  background: '#0B0F14',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0',
                  caretColor: '#c8a96e',
                }}
              />
            </label>

            {/* actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={saveDialog}
                disabled={!dialog.title.trim()}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ background: '#c8a96e', color: '#0B0F14' }}
              >
                {dialog.mode === 'create' ? 'Oluştur' : 'Kaydet'}
              </button>
              {dialog.mode === 'edit' && (
                <button
                  onClick={deleteEvent}
                  className="py-2 px-4 rounded-lg text-sm font-medium"
                  style={{
                    background: 'rgba(200,110,110,0.12)',
                    border: '1px solid rgba(200,110,110,0.3)',
                    color: '#c86e6e',
                  }}
                >
                  Sil
                </button>
              )}
              <button
                onClick={() => setDialog(EMPTY)}
                className="py-2 px-3 rounded-lg text-sm"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FullCalendar dark overrides */}
      <style>{`
        .fc-reborn {
          --fc-border-color: rgba(255,255,255,0.07);
          --fc-today-bg-color: rgba(200,169,110,0.05);
          --fc-now-indicator-color: #c8a96e;
          --fc-button-bg-color: #121821;
          --fc-button-border-color: rgba(255,255,255,0.12);
          --fc-button-hover-bg-color: rgba(200,169,110,0.12);
          --fc-button-hover-border-color: rgba(200,169,110,0.5);
          --fc-button-active-bg-color: rgba(200,169,110,0.18);
          --fc-button-active-border-color: #c8a96e;
          --fc-button-text-color: rgba(255,255,255,0.65);
          --fc-highlight-color: rgba(200,169,110,0.12);
          --fc-page-bg-color: #0B0F14;
          --fc-neutral-bg-color: #121821;
          --fc-event-bg-color: rgba(200,169,110,0.18);
          --fc-event-border-color: #c8a96e;
          --fc-event-text-color: #e2e8f0;
          --fc-event-selected-overlay-color: rgba(0,0,0,0.2);
        }
        .fc-reborn .fc-toolbar-title {
          color: rgba(255,255,255,0.85);
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .fc-reborn .fc-button {
          font-size: 11px;
          font-weight: 500;
          padding: 4px 11px;
          border-radius: 8px !important;
          text-transform: none;
        }
        .fc-reborn .fc-button:focus { box-shadow: 0 0 0 2px rgba(200,169,110,0.25) !important; }
        .fc-reborn .fc-button-primary:not(:disabled).fc-button-active { color: #c8a96e; }
        .fc-reborn .fc-col-header-cell-cushion {
          color: rgba(255,255,255,0.4);
          font-size: 11px;
          font-weight: 500;
          text-decoration: none;
        }
        .fc-reborn .fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion {
          color: #c8a96e;
          font-weight: 600;
        }
        .fc-reborn .fc-timegrid-slot-label-cushion {
          color: rgba(255,255,255,0.3);
          font-size: 10px;
        }
        .fc-reborn .fc-event {
          border-radius: 5px;
          border-left-width: 3px;
          cursor: pointer;
          font-size: 11px;
        }
        .fc-reborn .fc-event-title { font-weight: 500; padding: 0 2px; }
        .fc-reborn .fc-timegrid-now-indicator-line { border-color: #c8a96e; }
        .fc-reborn .fc-timegrid-now-indicator-arrow { border-color: #c8a96e; }
        .fc-reborn .fc-highlight {
          background: rgba(200,169,110,0.1) !important;
          border: 1px dashed rgba(200,169,110,0.4) !important;
        }
        .fc-reborn td, .fc-reborn th {
          border-color: rgba(255,255,255,0.06) !important;
        }
        .fc-reborn .fc-scrollgrid { border-color: rgba(255,255,255,0.06) !important; }
        .fc-reborn a { color: inherit; text-decoration: none; }
        .fc-reborn .fc-timegrid-event-harness { margin-right: 2px; }
      `}</style>
    </div>
  )
}
