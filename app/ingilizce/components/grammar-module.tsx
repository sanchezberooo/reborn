'use client'

import { useState, useEffect } from 'react'
import { dbLoadModules } from '@/lib/db'
import { LevelTabsLayout, type LevelContent, type TopicItem } from './level-tabs'

// ─── content types ────────────────────────────────────────────────────────────

interface GrammarExample { en: string; tr: string }
interface GrammarError   { yanlis: string; dogru: string; neden?: string }

interface GrammarTopicContent {
  kural?:    string
  ornekler?: GrammarExample[]
  hatalar?:  GrammarError[]
}

// ─── topic body ───────────────────────────────────────────────────────────────

function GrammarTopicBody({ content }: { content?: GrammarTopicContent }) {
  const hasContent = content && (content.kural || (content.ornekler?.length ?? 0) > 0 || (content.hatalar?.length ?? 0) > 0)

  if (!hasContent) {
    return (
      <div style={{ padding: '14px', textAlign: 'center', border: '1px dashed #1e1e1e', borderRadius: 8 }}>
        <p style={{ color: '#3a3a3a', fontSize: 12, fontStyle: 'italic' }}>İçerik yakında eklenecek.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Kural / Açıklama */}
      {content.kural && (
        <div style={{ background: 'rgba(200,169,110,0.06)', border: '1px solid rgba(200,169,110,0.2)', borderRadius: 8, padding: '10px 12px' }}>
          <p style={{ fontSize: 9, color: '#c8a96e', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Kural / Açıklama
          </p>
          <p style={{ color: '#d0d0d0', fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{content.kural}</p>
        </div>
      )}

      {/* Örnek Cümleler */}
      {content.ornekler && content.ornekler.length > 0 && (
        <div>
          <p style={{ fontSize: 9, color: '#c8a96e', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Örnek Cümleler
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {content.ornekler.map((ex, i) => (
              <div key={i} style={{ padding: '8px 11px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8 }}>
                <p style={{ color: '#ffffff', fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{ex.en}</p>
                {ex.tr && <p style={{ color: '#666', fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>{ex.tr}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Doğru vs Yanlış */}
      {content.hatalar && content.hatalar.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '10px 12px' }}>
          <p style={{ fontSize: 9, color: '#ef4444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Doğru vs Yanlış
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {content.hatalar.map((err, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#ef4444', fontSize: 12, textDecoration: 'line-through', fontStyle: 'italic' }}>
                    ✗ {err.yanlis}
                  </span>
                  <span style={{ color: '#2a2a2a' }}>→</span>
                  <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 500 }}>
                    ✓ {err.dogru}
                  </span>
                </div>
                {err.neden && (
                  <p style={{ color: '#555', fontSize: 11, marginTop: 3, lineHeight: 1.5, paddingLeft: 2 }}>
                    {err.neden}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── hardcoded fallback (used when DB has no content for a topic) ─────────────

const FALLBACK: Record<string, GrammarTopicContent> = {
  'present-simple': {
    kural: "Geniş zaman; alışkanlıkları, rutinleri ve her zaman doğru olan gerçekleri anlatır.\n\n(+) I/You/We/They work — He/She/It work-S\n(-) I don't / He doesn't work\n(?) Do you? / Does she?",
    ornekler: [
      { en: 'I wake up at 7 every morning.', tr: "Her sabah 7'de kalkıyorum." },
      { en: 'She works at a bank.', tr: 'Bankada çalışıyor.' },
      { en: "They don't eat meat.", tr: 'Et yemiyorlar.' },
      { en: 'Does he play football?', tr: 'Futbol oynuyor mu?' },
      { en: 'Water boils at 100°C.', tr: 'Su 100 derecede kaynar.' },
    ],
    hatalar: [
      { yanlis: "She don't like spicy food.", dogru: 'She doesn\'t like spicy food.', neden: "She (3. tekil) ile 'don't' değil 'doesn't' kullanılır." },
      { yanlis: 'He work in a hospital.', dogru: 'He works in a hospital.', neden: 'He/she/it ile fiil sonuna -(e)s eklenir.' },
      { yanlis: 'Do she live here?', dogru: 'Does she live here?', neden: "She ile 'do' değil 'does' kullanılır." },
    ],
  },
  'am-is-are': {
    kural: "'To be' fiili Türkçedeki 'olmak'a karşılık gelir. I ile 'am', he/she/it ile 'is', we/you/they ile 'are' kullanılır.\n\nI am → I'm   |   She is → She's   |   They are → They're\n(-) I am not → I'm not   |   She is not → She isn't\n(?) Am I? / Is she? / Are they?",
    ornekler: [
      { en: 'I am a student.', tr: 'Ben bir öğrenciyim.' },
      { en: 'She is my teacher.', tr: 'O benim öğretmenim.' },
      { en: 'They are friends.', tr: 'Onlar arkadaş.' },
      { en: "We're from Turkey.", tr: "Biz Türkiye'deniz." },
    ],
    hatalar: [
      { yanlis: 'He am happy.', dogru: 'He is happy.', neden: "He/she/it ile 'is' kullanılır." },
      { yanlis: 'I is from Istanbul.', dogru: 'I am from Istanbul.', neden: "I ile her zaman 'am' kullanılır." },
      { yanlis: 'They is students.', dogru: 'They are students.', neden: "They ile 'are' kullanılır." },
    ],
  },
  'there-is-are': {
    kural: "'There is/are' bir yerde bir şeyin var olduğunu ya da olmadığını anlatır.\n\nThere IS + tekil/sayılamaz isim\nThere ARE + çoğul isim\n(-) There isn't / There aren't\n(?) Is there...? / Are there...?\nGeçmiş: There was / There were",
    ornekler: [
      { en: 'There is a park near my house.', tr: 'Evimin yakınında bir park var.' },
      { en: 'There are three students in the room.', tr: 'Odada üç öğrenci var.' },
      { en: "There isn't any milk in the fridge.", tr: 'Buzdolabında süt yok.' },
      { en: 'Are there any hotels near here?', tr: 'Yakınlarda otel var mı?' },
    ],
    hatalar: [
      { yanlis: 'There is many people here.', dogru: 'There are many people here.', neden: "'Many people' çoğul → 'are' kullanılır." },
      { yanlis: 'Are there a bank nearby?', dogru: 'Is there a bank nearby?', neden: "'A bank' tekil → 'Is there' kullanılır." },
      { yanlis: 'There are a dog in the garden.', dogru: 'There is a dog in the garden.', neden: "'A dog' tekil → 'There is' kullanılır." },
    ],
  },
  'articles': {
    kural: "'A' ve 'an' belirsiz artikeldir; ilk kez bahsedilen tekil sayılabilir isimlerden önce gelir. Sesli sesle başlayan isimden önce 'an' kullanılır. 'The' belirli artikeldir; önceden söz edilen ya da her iki tarafın da bildiği isimler için kullanılır.\n\na + ünsüz ses: a cat, a book, a university\nan + sesli ses: an apple, an hour, an honest man\nthe + bilinen/belirli isim: the moon, the president",
    ornekler: [
      { en: 'I have a cat. The cat is black.', tr: 'İlk kez bahsederken a, sonradan the.' },
      { en: 'She is an engineer.', tr: 'Meslek belirtirken a/an kullanılır.' },
      { en: 'Can you close the door?', tr: 'Her ikimizin de bildiği kapı.' },
      { en: 'I like chocolate.', tr: 'Genel kural — artikel yok!' },
    ],
    hatalar: [
      { yanlis: 'She is a engineer.', dogru: 'She is an engineer.', neden: "'Engineer' sesli sesle başlar → 'an' kullanılır." },
      { yanlis: 'I like the chocolate. (genel)', dogru: 'I like chocolate.', neden: "Genel sevgi/tercih → artikel kullanılmaz." },
      { yanlis: 'A sun is very hot.', dogru: 'The sun is very hot.', neden: "Tek bir tane olan evrensel şeyler → 'the' kullanılır." },
    ],
  },
  'plurals': {
    kural: "Çoğul genellikle ismin sonuna -s veya -es eklenerek yapılır. Bazı isimler düzensiz çoğul alır.\n\n+s: book → books, cat → cats\n+es (-s/-sh/-ch/-x/-z): bus → buses, watch → watches\ny→ies (ünsüz+y): city → cities\nDüzensiz: man→men, child→children, tooth→teeth, foot→feet, sheep→sheep",
    ornekler: [
      { en: 'One cat → two cats', tr: 'Kedi → kediler' },
      { en: 'One bus → two buses', tr: 'Otobüs → otobüsler' },
      { en: 'One city → three cities', tr: 'Şehir → şehirler' },
      { en: 'One child → many children', tr: 'Çocuk → çocuklar' },
    ],
    hatalar: [
      { yanlis: 'There are two mans.', dogru: 'There are two men.', neden: "'Man' düzensiz çoğul alır: man → men." },
      { yanlis: 'I see many sheeps.', dogru: 'I see many sheep.', neden: "'Sheep' çoğulda değişmez: sheep → sheep." },
      { yanlis: 'She has two childs.', dogru: 'She has two children.', neden: "'Child' düzensiz çoğul alır: child → children." },
    ],
  },
  'this-that': {
    kural: "'This/these' yakındaki nesneler; 'that/those' uzaktaki nesneler için kullanılır.\n\nYakın + Tekil: this book\nYakın + Çoğul: these books\nUzak + Tekil: that car\nUzak + Çoğul: those cars",
    ornekler: [
      { en: 'This is my pen.', tr: 'Bu benim kalemim.' },
      { en: 'That building is very old.', tr: 'Şu bina çok eski.' },
      { en: 'These are my friends.', tr: 'Bunlar benim arkadaşlarım.' },
      { en: 'Those shoes are beautiful.', tr: 'Şu ayakkabılar çok güzel.' },
    ],
    hatalar: [
      { yanlis: 'This are my friends.', dogru: 'These are my friends.', neden: "'Friends' çoğul → 'these' kullanılır." },
      { yanlis: "Those is my pen.", dogru: 'That is my pen.', neden: "'Pen' tekil → 'that' kullanılır." },
      { yanlis: 'These book is interesting.', dogru: 'This book is interesting.', neden: "'Book' tekil → 'this' kullanılır." },
    ],
  },
  'possessives': {
    kural: "İyelik iki şekilde ifade edilir:\n1. İyelik sıfatları (ismin önünde): my/your/his/her/its/our/their\n2. İyelik zamirleri (bağımsız): mine/yours/his/hers/ours/theirs\n3. İsim + 's: Sara's book, the teacher's car",
    ornekler: [
      { en: 'This is my bag.', tr: 'Bu benim çantam.' },
      { en: "His car is red.", tr: 'Onun arabası kırmızı.' },
      { en: "Sara's phone is new.", tr: "Sara'nın telefonu yeni." },
      { en: "It's her book, not mine.", tr: 'Bu onun kitabı, benimki değil.' },
    ],
    hatalar: [
      { yanlis: "This is hers bag.", dogru: 'This is her bag.', neden: "İsmin önünde 'her' (sıfat), bağımsız 'hers' (zamir) kullanılır." },
      { yanlis: "The cat licked it's paw.", dogru: "The cat licked its paw.", neden: "'it's' = 'it is'; iyelik için 'its' (kesme işareti yok)." },
      { yanlis: 'That is mine car.', dogru: 'That is my car.', neden: "İsmin önünde 'my', bağımsız 'mine' kullanılır." },
    ],
  },
  'can-cant': {
    kural: "'Can' yetenek veya izin; 'can't' (cannot) bunların olmaması anlamına gelir. Modal fiil olduğu için sonrasında fiilin yalın hali (bare infinitive) gelir — 'to' kullanılmaz!\n\n(+) I / She / They can swim.\n(-) She can't swim.\n(?) Can she swim? — Yes, she can.",
    ornekler: [
      { en: 'I can speak three languages.', tr: 'Üç dil konuşabiliyorum.' },
      { en: "She can't drive — she's only 15.", tr: 'Araba süremez — o sadece 15 yaşında.' },
      { en: 'Can I open the window?', tr: 'Pencereyi açabilir miyim?' },
      { en: 'He can play guitar very well.', tr: 'Gitar çok iyi çalabiliyor.' },
    ],
    hatalar: [
      { yanlis: 'She can to swim.', dogru: 'She can swim.', neden: "Modal fiillerin ardından 'to' kullanılmaz." },
      { yanlis: 'Can you to help me?', dogru: 'Can you help me?', neden: "'Can' sonrası yalın fiil gelir." },
      { yanlis: "I can't to go.", dogru: "I can't go.", neden: "'can't' sonrası da yalın fiil kullanılır." },
    ],
  },
  'prepositions-place': {
    kural: "Yer edatları nesnelerin birbirine göre konumunu anlatır.\n\nin  → içinde: in the box, in London\non  → üzerinde: on the table, on the wall\nat  → noktada: at the door, at the station\nunder → altında: under the bed\nnext to → yanında: next to the shop\nbetween → arasında: between A and B",
    ornekler: [
      { en: 'The cat is in the box.', tr: 'Kedi kutunun içinde.' },
      { en: 'The book is on the table.', tr: 'Kitap masanın üzerinde.' },
      { en: 'She is at the bus stop.', tr: 'O otobüs durağında.' },
      { en: 'The bank is next to the pharmacy.', tr: 'Banka eczanenin yanında.' },
    ],
    hatalar: [
      { yanlis: 'I am in the bus stop.', dogru: 'I am at the bus stop.', neden: "Belirli bir nokta/konum → 'at' kullanılır." },
      { yanlis: 'The picture is in the wall.', dogru: 'The picture is on the wall.', neden: "Yüzey üzerinde → 'on' kullanılır." },
      { yanlis: 'She lives on London.', dogru: 'She lives in London.', neden: "Şehir ve ülke isimlerinde → 'in' kullanılır." },
    ],
  },
  'question-words': {
    kural: "Wh- soruları bilgi soran sorulardır; evet/hayır cevabı almazlar.\n\nWho (kim) / What (ne) / Where (nerede)\nWhen (ne zaman) / Why (neden) / How (nasıl)\n\nSıralama: Soru kelimesi + yardımcı fiil + özne + fiil?",
    ornekler: [
      { en: 'What is your name?', tr: 'İsmin ne?' },
      { en: 'Where do you live?', tr: 'Nerede yaşıyorsun?' },
      { en: 'When does the lesson start?', tr: 'Ders ne zaman başlıyor?' },
      { en: 'Why are you sad?', tr: 'Neden üzgünsün?' },
      { en: 'How do you go to school?', tr: 'Okula nasıl gidiyorsun?' },
    ],
    hatalar: [
      { yanlis: 'Where you live?', dogru: 'Where do you live?', neden: "Soru kelimesinden sonra yardımcı fiil gereklidir." },
      { yanlis: 'What she is doing?', dogru: 'What is she doing?', neden: "Yardımcı fiil özneden önce gelir." },
      { yanlis: 'Why he is late?', dogru: 'Why is he late?', neden: "'Is' yardımcı fiil olarak öznenin önüne alınır." },
    ],
  },
}

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
  { id: 'present-perfect',    title: 'Present Perfect — Yakın Geçmiş (have/has + V3)' },
  { id: 'past-perfect',       title: 'Past Perfect — Geçmişten Önceki Geçmiş' },
  { id: 'passive',            title: 'Passive Voice — Edilgen Yapı' },
  { id: 'first-conditional',  title: '1st Conditional — Gerçekleşebilir Koşul' },
  { id: 'second-conditional', title: '2nd Conditional — Hayali Koşul' },
  { id: 'reported-speech',    title: 'Reported Speech — Dolaylı Anlatım' },
  { id: 'relative-clauses',   title: 'Relative Clauses — İlgi Cümleleri' },
  { id: 'modals-deduction',   title: "Modal Verbs — must / might / can't (Çıkarım)" },
  { id: 'gerunds-infinitives', title: 'Gerunds & Infinitives — -ing mi, to + fiil mi?' },
]

// ─── module ────────────────────────────────────────────────────────────────────

export function GrammarModule() {
  const [dbContent, setDbContent] = useState<Record<string, GrammarTopicContent>>({})

  useEffect(() => {
    dbLoadModules()
      .then((mods) => {
        const eng = mods.find((m) => m.id === 'english')
        const gc = (eng?.data?.grammarContent ?? {}) as Record<string, GrammarTopicContent>
        setDbContent(gc)
      })
      .catch(() => {})
  }, [])

  // DB content takes precedence; fall back to FALLBACK if DB key absent
  function resolve(id: string): GrammarTopicContent | undefined {
    return dbContent[id] ?? FALLBACK[id]
  }

  function makeTopics(list: typeof A1_LIST): TopicItem[] {
    return list.map((t) => ({
      id: t.id,
      title: t.title,
      body: <GrammarTopicBody content={resolve(t.id)} />,
    }))
  }

  const content: LevelContent = {
    A1: makeTopics(A1_LIST),
    A2: makeTopics(A2_LIST),
    B1: makeTopics(B1_LIST),
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Gramer</h2>
        <p style={{ color: '#a0a0a0', fontSize: 13 }}>
          Kural/açıklama (Türkçe), örnek cümleler ve yaygın hata karşılaştırması.
        </p>
      </div>
      <LevelTabsLayout moduleKey="grammar" content={content} />
    </div>
  )
}
