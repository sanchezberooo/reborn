// Journal yazma yolunun sunucu ucu (Faz 2, Görev 1). İstemci (lib/db.ts
// dbSaveJournalEntry) buraya POST'lar; iş mantığı lib/db-server.ts'tedir —
// silo upsert + entities köprü senkronu (embedding sunucuda hesaplanır,
// LocalEmbeddingProvider istemci bundle'ına giremez).

import {
  deleteJournalEntry,
  resolveSingleUserId,
  saveJournalEntry,
  type JournalEntryData,
} from '@/lib/db-server'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseEntry(body: unknown): JournalEntryData | null {
  const b = body as Partial<JournalEntryData> | null
  if (!b || typeof b.date !== 'string' || !DATE_RE.test(b.date)) return null
  return {
    date: b.date,
    mood: typeof b.mood === 'number' ? b.mood : 5,
    day_score: typeof b.day_score === 'number' ? b.day_score : 5,
    question_1: typeof b.question_1 === 'string' ? b.question_1 : '',
    answer_1: typeof b.answer_1 === 'string' ? b.answer_1 : '',
    question_2: typeof b.question_2 === 'string' ? b.question_2 : '',
    answer_2: typeof b.answer_2 === 'string' ? b.answer_2 : '',
    free_write: typeof b.free_write === 'string' ? b.free_write : '',
  }
}

export async function POST(req: Request) {
  const entry = parseEntry(await req.json().catch(() => null))
  if (!entry) {
    return Response.json({ error: 'Geçersiz gövde — date (YYYY-MM-DD) zorunlu.' }, { status: 400 })
  }

  try {
    const userId = await resolveSingleUserId()
    const result = await saveJournalEntry(userId, entry)
    return Response.json(result)
  } catch (error) {
    console.error('[api/journal] POST hata:', error)
    return Response.json({ error: 'Günlük kaydedilemedi.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const date = new URL(req.url).searchParams.get('date')
  if (!date || !DATE_RE.test(date)) {
    return Response.json({ error: 'date (YYYY-MM-DD) query parametresi zorunlu.' }, { status: 400 })
  }

  try {
    const userId = await resolveSingleUserId()
    const deleted = await deleteJournalEntry(userId, date)
    return Response.json({ deleted })
  } catch (error) {
    console.error('[api/journal] DELETE hata:', error)
    return Response.json({ error: 'Günlük silinemedi.' }, { status: 500 })
  }
}
