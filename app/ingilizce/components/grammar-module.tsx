'use client'

import { LevelTabsLayout, type LevelContent, type TopicItem } from './level-tabs'

// ─── static topic lists ───────────────────────────────────────────────────────

const A1_LIST = [
  { id: 'present-simple',     title: 'Present Simple — Geniş Zaman' },
  { id: 'am-is-are',          title: 'am / is / are — To Be' },
  { id: 'there-is-are',       title: 'there is / there are — Var/Yok' },
  { id: 'articles',           title: 'Articles — a / an / the' },
  { id: 'plurals',            title: 'Plurals — İsimlerin Çoğulu' },
  { id: 'this-that',          title: 'this / that / these / those — İşaret Sıfatları' },
  { id: 'possessives',        title: 'Possessives — İyelik' },
  { id: 'can-cant',           title: "can / can't — Yetenek ve İzin" },
  { id: 'prepositions-place', title: 'Prepositions of Place — Yer Edatları' },
  { id: 'question-words',     title: 'Question Words — Soru Kelimeleri' },
]

const A2_LIST = [
  { id: 'simple-past',         title: 'Simple Past — Geçmiş Zaman' },
  { id: 'past-continuous',     title: 'Past Continuous — Geçmişte Süregelen' },
  { id: 'future',              title: 'Future — Gelecek Zaman (will / going to)' },
  { id: 'comparatives',        title: 'Comparatives & Superlatives — Karşılaştırma' },
  { id: 'modals-could-should', title: 'could / should — Kibarlık ve Tavsiye' },
  { id: 'countable',           title: 'Countable / Uncountable — Sayılabilir/Sayılamaz' },
  { id: 'prepositions-time',   title: 'Prepositions of Time — at / on / in' },
  { id: 'pronouns',            title: 'Subject & Object Pronouns — Zamirler' },
  { id: 'how-much-many',       title: 'How much / How many / Too / Enough' },
]

const B1_LIST = [
  { id: 'present-perfect',     title: 'Present Perfect — Yakın Geçmiş (have/has + V3)' },
  { id: 'past-perfect',        title: 'Past Perfect — Geçmişten Önceki Geçmiş' },
  { id: 'passive',             title: 'Passive Voice — Edilgen Yapı' },
  { id: 'first-conditional',   title: '1st Conditional — Gerçekleşebilir Koşul' },
  { id: 'second-conditional',  title: '2nd Conditional — Hayali Koşul' },
  { id: 'reported-speech',     title: 'Reported Speech — Dolaylı Anlatım' },
  { id: 'relative-clauses',    title: 'Relative Clauses — İlgi Cümleleri' },
  { id: 'modals-deduction',    title: "Modal Verbs — must / might / can't (Çıkarım)" },
  { id: 'gerunds-infinitives', title: 'Gerunds & Infinitives — -ing mi, to + fiil mi?' },
]

function makeTopics(list: typeof A1_LIST): TopicItem[] {
  return list.map((t) => ({
    id:   t.id,
    title: t.title,
    href: `/ingilizce/gramer/${t.id}`,
  }))
}

const CONTENT: LevelContent = {
  A1: makeTopics(A1_LIST),
  A2: makeTopics(A2_LIST),
  B1: makeTopics(B1_LIST),
}

// ─── module ────────────────────────────────────────────────────────────────────

export function GrammarModule() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Gramer</h2>
        <p style={{ color: '#a0a0a0', fontSize: 13 }}>
          Konuya tıkla → tam ders sayfasına git.
        </p>
      </div>
      <LevelTabsLayout moduleKey="grammar" content={CONTENT} />
    </div>
  )
}
