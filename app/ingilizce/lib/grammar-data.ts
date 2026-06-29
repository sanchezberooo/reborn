// ─── types ────────────────────────────────────────────────────────────────────

export interface GrammarExample { en: string; tr: string }
export interface GrammarError   { yanlis: string; dogru: string; neden?: string }

export interface GrammarTopicContent {
  kural?:    string
  ornekler?: GrammarExample[]
  hatalar?:  GrammarError[]
  kaliplar?: string[]
}

// ─── topic metadata (id → label + level) ─────────────────────────────────────

export const GRAMMAR_TOPIC_META: Record<string, { label: string; level: string }> = {
  // A1
  'present-simple':     { label: 'Present Simple — Geniş Zaman',                level: 'A1' },
  'am-is-are':          { label: 'am / is / are — To Be',                        level: 'A1' },
  'there-is-are':       { label: 'there is / there are — Var/Yok',               level: 'A1' },
  'articles':           { label: 'Articles — a / an / the',                      level: 'A1' },
  'plurals':            { label: 'Plurals — İsimlerin Çoğulu',                   level: 'A1' },
  'this-that':          { label: 'this / that / these / those — İşaret Sıfatları', level: 'A1' },
  'possessives':        { label: 'Possessives — İyelik',                         level: 'A1' },
  'can-cant':           { label: "can / can't — Yetenek ve İzin",                level: 'A1' },
  'prepositions-place': { label: 'Prepositions of Place — Yer Edatları',         level: 'A1' },
  'question-words':     { label: 'Question Words — Soru Kelimeleri',             level: 'A1' },
  // A2
  'simple-past':         { label: 'Simple Past — Geçmiş Zaman',                  level: 'A2' },
  'past-continuous':     { label: 'Past Continuous — Geçmişte Süregelen',        level: 'A2' },
  'future':              { label: 'Future — Gelecek Zaman (will / going to)',     level: 'A2' },
  'comparatives':        { label: 'Comparatives & Superlatives — Karşılaştırma', level: 'A2' },
  'modals-could-should': { label: 'could / should — Kibarlık ve Tavsiye',        level: 'A2' },
  'countable':           { label: 'Countable / Uncountable — Sayılabilir/Sayılamaz', level: 'A2' },
  'prepositions-time':   { label: 'Prepositions of Time — at / on / in',         level: 'A2' },
  'pronouns':            { label: 'Subject & Object Pronouns — Zamirler',        level: 'A2' },
  'how-much-many':       { label: 'How much / How many / Too / Enough',           level: 'A2' },
  // B1
  'present-perfect':     { label: 'Present Perfect — Yakın Geçmiş',              level: 'B1' },
  'past-perfect':        { label: 'Past Perfect — Geçmişten Önceki Geçmiş',      level: 'B1' },
  'passive':             { label: 'Passive Voice — Edilgen Yapı',                 level: 'B1' },
  'first-conditional':   { label: '1st Conditional — Gerçekleşebilir Koşul',     level: 'B1' },
  'second-conditional':  { label: '2nd Conditional — Hayali Koşul',              level: 'B1' },
  'reported-speech':     { label: 'Reported Speech — Dolaylı Anlatım',           level: 'B1' },
  'relative-clauses':    { label: 'Relative Clauses — İlgi Cümleleri',           level: 'B1' },
  'modals-deduction':    { label: "Modal Verbs — must / might / can't (Çıkarım)",level: 'B1' },
  'gerunds-infinitives': { label: 'Gerunds & Infinitives — -ing mi, to + fiil mi?', level: 'B1' },
}

// ─── fallback content (used when DB has no entry for a topic) ─────────────────

export const GRAMMAR_FALLBACK: Record<string, GrammarTopicContent> = {
  'present-simple': {
    kural: "Geniş zaman; alışkanlıkları, rutinleri ve her zaman doğru olan gerçekleri anlatır.\n\n(+) I/You/We/They work\n(+) He/She/It work-S  ← -(e)s ekle!\n(-) I don't work / He doesn't work\n(?) Do you work? / Does he work?",
    ornekler: [
      { en: 'I wake up at 7 every morning.', tr: "Her sabah 7'de kalkıyorum." },
      { en: 'She works at a bank.', tr: 'Bankada çalışıyor.' },
      { en: "They don't eat meat.", tr: 'Et yemiyorlar.' },
      { en: 'Does he play football?', tr: 'Futbol oynuyor mu?' },
      { en: 'Water boils at 100°C.', tr: 'Su 100 derecede kaynar.' },
    ],
    hatalar: [
      { yanlis: "She don't like spicy food.", dogru: "She doesn't like spicy food.", neden: "She (3. tekil) ile 'don't' değil 'doesn't' kullanılır." },
      { yanlis: 'He work in a hospital.',     dogru: 'He works in a hospital.',      neden: 'He/she/it ile fiil sonuna -(e)s eklenir.' },
      { yanlis: 'Do she live here?',          dogru: 'Does she live here?',           neden: "She ile 'do' değil 'does' kullanılır." },
    ],
  },
  'am-is-are': {
    kural: "'To be' fiili Türkçedeki 'olmak'a karşılık gelir.\n\nI → am    (I am → I'm)\nHe / She / It → is    (She is → She's)\nWe / You / They → are    (They are → They're)\n\n(-) I'm not / She isn't / They aren't\n(?) Am I? / Is she? / Are they?",
    ornekler: [
      { en: 'I am a student.',     tr: 'Ben bir öğrenciyim.' },
      { en: 'She is my teacher.',  tr: 'O benim öğretmenim.' },
      { en: 'They are friends.',   tr: 'Onlar arkadaş.' },
      { en: "We're from Turkey.",  tr: "Biz Türkiye'deniz." },
      { en: 'It is cold today.',   tr: 'Bugün hava soğuk.' },
    ],
    hatalar: [
      { yanlis: 'He am happy.',          dogru: 'He is happy.',          neden: "He/she/it ile 'is' kullanılır." },
      { yanlis: 'I is from Istanbul.',   dogru: 'I am from Istanbul.',   neden: "I ile her zaman 'am' kullanılır." },
      { yanlis: 'They is students.',     dogru: 'They are students.',    neden: "They ile 'are' kullanılır." },
    ],
  },
  'there-is-are': {
    kural: "'There is/are' bir yerde bir şeyin var olduğunu ya da olmadığını anlatır.\n\nThere IS  + tekil / sayılamaz isim\nThere ARE + çoğul isim\n(-) There isn't / There aren't\n(?) Is there...? / Are there...?\nGeçmiş: There was / There were",
    ornekler: [
      { en: 'There is a park near my house.',    tr: 'Evimin yakınında bir park var.' },
      { en: 'There are three students in the room.', tr: 'Odada üç öğrenci var.' },
      { en: "There isn't any milk in the fridge.", tr: 'Buzdolabında süt yok.' },
      { en: 'Are there any hotels near here?',   tr: 'Yakınlarda otel var mı?' },
      { en: 'There was a big storm last night.',  tr: 'Dün gece büyük bir fırtına vardı.' },
    ],
    hatalar: [
      { yanlis: 'There is many people here.',   dogru: 'There are many people here.',  neden: "'Many people' çoğul → 'are' kullanılır." },
      { yanlis: 'Are there a bank nearby?',     dogru: 'Is there a bank nearby?',      neden: "'A bank' tekil → 'Is there' kullanılır." },
      { yanlis: 'There are a dog in the garden.', dogru: 'There is a dog in the garden.', neden: "'A dog' tekil → 'There is' kullanılır." },
    ],
  },
  'articles': {
    kural: "'A' ve 'an' belirsiz artikel; ilk kez bahsedilen tekil sayılabilir isimlerden önce gelir.\n'An' sesli sesle başlayan isimden önce kullanılır.\n'The' belirli artikel; önceden söz edilen ya da her iki tarafın bildiği isimler için.\n\na + ünsüz ses: a cat, a book, a university\nan + sesli ses: an apple, an hour, an honest man\nthe + bilinen isim: the moon, the president\nArtikel YOK: genel kavramlar, özel isimler",
    ornekler: [
      { en: 'I have a cat. The cat is black.',  tr: 'İlk kez → a; sonradan bilinen → the.' },
      { en: 'She is an engineer.',              tr: 'Meslek → a/an kullanılır.' },
      { en: 'Can you close the door?',          tr: 'Her ikimizin bildiği kapı → the.' },
      { en: 'I like chocolate.',                tr: 'Genel sevgi/tercih → artikel yok!' },
      { en: 'The sun rises in the east.',       tr: 'Evrende tek olan → the.' },
    ],
    hatalar: [
      { yanlis: 'She is a engineer.',          dogru: 'She is an engineer.',    neden: "'Engineer' sesli sesle başlar → 'an' kullanılır." },
      { yanlis: 'I like the chocolate. (genel)', dogru: 'I like chocolate.',   neden: 'Genel sevgi → artikel kullanılmaz.' },
      { yanlis: 'A sun is very hot.',           dogru: 'The sun is very hot.', neden: "Evrende tek olan → 'the' kullanılır." },
    ],
  },
  'plurals': {
    kural: "Çoğul genellikle ismin sonuna -s veya -es eklenerek yapılır.\n\n+s → book → books, cat → cats\n+es (-s/-sh/-ch/-x/-z) → bus → buses, watch → watches\ny → ies (ünsüz+y) → city → cities\nDüzensiz: man→men, child→children, tooth→teeth, foot→feet, sheep→sheep, mouse→mice",
    ornekler: [
      { en: 'One cat → two cats',          tr: 'Kedi → kediler' },
      { en: 'One bus → two buses',         tr: 'Otobüs → otobüsler' },
      { en: 'One city → three cities',     tr: 'Şehir → şehirler' },
      { en: 'One child → many children',   tr: 'Çocuk → çocuklar' },
      { en: 'One tooth → my teeth hurt',   tr: 'Diş → dişler' },
    ],
    hatalar: [
      { yanlis: 'There are two mans.',    dogru: 'There are two men.',       neden: "'Man' düzensiz çoğul: man → men." },
      { yanlis: 'I see many sheeps.',     dogru: 'I see many sheep.',        neden: "'Sheep' çoğulda değişmez: sheep → sheep." },
      { yanlis: 'She has two childs.',    dogru: 'She has two children.',    neden: "'Child' düzensiz çoğul: child → children." },
    ],
  },
  'this-that': {
    kural: "'This/these' yakındaki nesneler; 'that/those' uzaktaki nesneler için kullanılır.\n\nYakın + Tekil:  this book   (bu kitap)\nYakın + Çoğul:  these books (bu kitaplar)\nUzak  + Tekil:  that car    (şu araba)\nUzak  + Çoğul:  those cars  (şu arabalar)",
    ornekler: [
      { en: 'This is my pen.',            tr: 'Bu benim kalemim.' },
      { en: 'That building is very old.', tr: 'Şu bina çok eski.' },
      { en: 'These are my friends.',      tr: 'Bunlar benim arkadaşlarım.' },
      { en: 'Those shoes are beautiful.', tr: 'Şu ayakkabılar çok güzel.' },
      { en: 'Is this your bag?',          tr: 'Bu senin çantan mı?' },
    ],
    hatalar: [
      { yanlis: 'This are my friends.',      dogru: 'These are my friends.',   neden: "'Friends' çoğul → 'these' kullanılır." },
      { yanlis: 'Those is my pen.',          dogru: 'That is my pen.',         neden: "'Pen' tekil → 'that' kullanılır." },
      { yanlis: 'These book is interesting.', dogru: 'This book is interesting.', neden: "'Book' tekil → 'this' kullanılır." },
    ],
  },
  'possessives': {
    kural: "İyelik iki şekilde ifade edilir:\n\n1. İyelik sıfatları (ismin önünde):\n   my / your / his / her / its / our / their\n\n2. İyelik zamirleri (bağımsız — isimsiz):\n   mine / yours / his / hers / ours / theirs\n\n3. İsim + 's → Sara's book, the teacher's car",
    ornekler: [
      { en: 'This is my bag.',             tr: 'Bu benim çantam.' },
      { en: "His car is red.",             tr: 'Onun arabası kırmızı.' },
      { en: "Sara's phone is new.",        tr: "Sara'nın telefonu yeni." },
      { en: "Their house is near school.", tr: 'Onların evi okula yakın.' },
      { en: "It's her book, not mine.",    tr: 'Bu onun kitabı, benimki değil.' },
    ],
    hatalar: [
      { yanlis: "This is hers bag.",          dogru: 'This is her bag.',           neden: "İsmin önünde → 'her' (sıfat); bağımsız → 'hers' (zamir)." },
      { yanlis: "The cat licked it's paw.",   dogru: "The cat licked its paw.",    neden: "'it's' = 'it is'; iyelik için kesme işareti olmayan 'its' kullanılır." },
      { yanlis: 'That is mine car.',          dogru: 'That is my car.',            neden: "İsmin önünde → 'my'; bağımsız → 'mine'." },
    ],
  },
  'can-cant': {
    kural: "'Can' yetenek veya izin; 'can't' (cannot) bunların olmaması anlamı taşır.\nModal fiil → sonrasında fiilin YALIN hali kullanılır, 'to' kullanılmaz!\n\n(+) I / She / They can swim.\n(-) She can't swim. / She cannot swim.\n(?) Can she swim? — Yes, she can. / No, she can't.",
    ornekler: [
      { en: 'I can speak three languages.',      tr: 'Üç dil konuşabiliyorum.' },
      { en: "She can't drive — she's only 15.",  tr: 'Araba süremez — sadece 15 yaşında.' },
      { en: 'Can I open the window?',            tr: 'Pencereyi açabilir miyim? — izin' },
      { en: 'He can play guitar very well.',     tr: 'Gitar çok iyi çalabiliyor.' },
      { en: "We can't come tonight — sorry.",    tr: 'Bu gece gelemiyoruz — özür dileriz.' },
    ],
    hatalar: [
      { yanlis: 'She can to swim.',    dogru: 'She can swim.',    neden: "Modal fiillerin ardından 'to' kullanılmaz." },
      { yanlis: 'Can you to help me?', dogru: 'Can you help me?', neden: "'Can' sonrası yalın fiil gelir, 'to' eklenmez." },
      { yanlis: "I can't to go.",      dogru: "I can't go.",      neden: "'can't' sonrası da yalın fiil kullanılır." },
    ],
  },
  'prepositions-place': {
    kural: "Yer edatları nesnelerin birbirine göre konumunu anlatır.\n\nin    → içinde:  in the box, in London\non    → üzerinde: on the table, on the wall\nat    → noktada:  at the door, at the station\nunder → altında:  under the bed\nnext to → yanında:  next to the shop\nbetween → arasında: between the bank and the school",
    ornekler: [
      { en: 'The cat is in the box.',         tr: 'Kedi kutunun içinde.' },
      { en: 'The book is on the table.',      tr: 'Kitap masanın üzerinde.' },
      { en: 'She is at the bus stop.',        tr: 'O otobüs durağında.' },
      { en: 'The dog is under the chair.',    tr: 'Köpek sandalyenin altında.' },
      { en: 'The bank is next to the pharmacy.', tr: 'Banka eczanenin yanında.' },
    ],
    hatalar: [
      { yanlis: 'I am in the bus stop.',   dogru: 'I am at the bus stop.',     neden: "Belirli bir nokta/konum için → 'at' kullanılır." },
      { yanlis: 'The picture is in the wall.', dogru: 'The picture is on the wall.', neden: "Yüzey üzerinde → 'on' kullanılır." },
      { yanlis: 'She lives on London.',    dogru: 'She lives in London.',      neden: "Şehir ve ülke isimlerinde → 'in' kullanılır." },
    ],
  },
  'question-words': {
    kural: "Wh- soruları bilgi soran sorulardır; evet/hayır cevabı almazlar.\n\nWho   → kim\nWhat  → ne\nWhere → nerede\nWhen  → ne zaman\nWhy   → neden\nHow   → nasıl\n\nSıralama: Soru kelimesi + yardımcı fiil + özne + fiil?",
    ornekler: [
      { en: 'What is your name?',               tr: 'İsmin ne?' },
      { en: 'Where do you live?',               tr: 'Nerede yaşıyorsun?' },
      { en: 'When does the lesson start?',      tr: 'Ders ne zaman başlıyor?' },
      { en: 'Why are you sad?',                 tr: 'Neden üzgünsün?' },
      { en: 'How do you go to school?',         tr: 'Okula nasıl gidiyorsun?' },
    ],
    hatalar: [
      { yanlis: 'Where you live?',        dogru: 'Where do you live?',       neden: "Soru kelimesinden sonra yardımcı fiil gereklidir." },
      { yanlis: 'What she is doing?',     dogru: 'What is she doing?',       neden: "Yardımcı fiil öznenin önüne alınır." },
      { yanlis: 'Why he is late?',        dogru: 'Why is he late?',          neden: "'Is' yardımcı fiil olarak öne çıkar." },
    ],
  },
}
