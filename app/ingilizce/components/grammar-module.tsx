'use client'

import { LevelTabsLayout, FullGrammarBox, type LevelContent } from './level-tabs'

const CONTENT: LevelContent = {
  A1: [
    {
      id: 'to-be',
      title: 'To Be — am / is / are',
      body: <FullGrammarBox
        descTR="'To be' fiili Türkçedeki 'olmak' fiiline karşılık gelir. Kişiye göre am / is / are şeklinde değişir. I ile her zaman 'am' kullanılır; he, she, it ile 'is'; we, you, they ile 'are' kullanılır."
        formula={`I am       → I'm
He / She / It is  → He's / She's / It's
We / You / They are → We're / They're
(-) I am not → I'm not / She is not → She isn't
(?) Am I? / Is she? / Are they?`}
        examples={[
          "I am a student. (Ben bir öğrenciyim.)",
          "She is my teacher. (O benim öğretmenim.)",
          "They are friends. (Onlar arkadaş.)",
          "It is cold today. (Bugün hava soğuk.)",
          "We are from Turkey. (Biz Türkiye'deniz.)",
        ]}
        exercises={[
          "Boşluğu doldur: My brother ___ 15 years old. (is / am / are)",
          "Cümleyi olumsuz yap: She is tired. → She ___ not tired.",
          "Soru kur: You are a doctor. → ___ you a doctor?",
        ]}
        errors={[
          { wrong: "He am happy.", correct: "He is happy." },
          { wrong: "I is from Istanbul.", correct: "I am from Istanbul." },
          { wrong: "They is students.", correct: "They are students." },
        ]}
      />,
    },
    {
      id: 'have-has',
      title: 'Have / Has — Sahip Olmak',
      body: <FullGrammarBox
        descTR="'Have' ve 'has' bir şeye sahip olduğumuzu ifade etmek için kullanılır. I, you, we, they ile 'have'; he, she, it ile 'has' kullanılır. Olumsuzda 'don't have' veya 'doesn't have' kullanılır."
        formula={`I / You / We / They have
He / She / It has
(-) don't have / doesn't have
(?) Do you have...? / Does he have...?`}
        examples={[
          "I have a dog. (Bir köpeğim var.)",
          "She has blue eyes. (Onun mavi gözleri var.)",
          "We have two cars. (İki arabamız var.)",
          "He doesn't have a sister. (Onun kız kardeşi yok.)",
          "Do you have any brothers? (Erkek kardeşin var mı?)",
        ]}
        exercises={[
          "Boşluğu doldur: My father ___ a new car. (have / has)",
          "Olumsuz yap: She has a cat. → She ___ a cat.",
          "Soru kur: They have a big house. → ___ they ___ a big house?",
        ]}
        errors={[
          { wrong: "She have a sister.", correct: "She has a sister." },
          { wrong: "He don't have money.", correct: "He doesn't have money." },
          { wrong: "I has a question.", correct: "I have a question." },
        ]}
      />,
    },
    {
      id: 'this-that',
      title: 'This / That / These / Those — İşaret Sıfatları',
      body: <FullGrammarBox
        descTR="'This' ve 'these' yakındaki nesneler için; 'that' ve 'those' uzaktaki nesneler için kullanılır. Tekil isimlerle 'this/that', çoğul isimlerle 'these/those' kullanılır."
        formula={`Yakın + Tekil: this book (bu kitap)
Yakın + Çoğul: these books (bu kitaplar)
Uzak + Tekil: that car (şu araba)
Uzak + Çoğul: those cars (şu arabalar)`}
        examples={[
          "This is my pen. (Bu benim kalemim.)",
          "That building is very old. (Şu bina çok eski.)",
          "These are my friends. (Bunlar benim arkadaşlarım.)",
          "Those shoes are beautiful. (Şu ayakkabılar çok güzel.)",
          "Is this your bag? (Bu senin çantan mı?)",
        ]}
        exercises={[
          "Boşluğu doldur: ___ are my keys. (This / These) — anahtarlar yakında.",
          "Çevir: Şu adam benim amcamdır. → ___ man is my uncle.",
          "Soru kur: These are nice shoes. → ___ ___ nice shoes?",
        ]}
        errors={[
          { wrong: "This are my friends.", correct: "These are my friends." },
          { wrong: "Those is my pen.", correct: "That is my pen." },
          { wrong: "These book is interesting.", correct: "This book is interesting." },
        ]}
      />,
    },
    {
      id: 'simple-present',
      title: 'Simple Present — Geniş Zaman',
      body: <FullGrammarBox
        descTR="Geniş zaman, her zaman doğru olan gerçekleri, alışkanlıkları ve rutinleri anlatmak için kullanılır. He/she/it ile fiil sonuna -(e)s eklenir. Olumsuzda 'don't/doesn't' yardımcı fiili kullanılır."
        formula={`(+) I / You / We / They work
(+) He / She / It works  ← -(e)s ekle!
(-) I don't work / He doesn't work
(?) Do you work? / Does he work?`}
        examples={[
          "I wake up at 7 every morning. (Her sabah 7'de kalkıyorum.)",
          "She works at a bank. (Bankada çalışıyor.)",
          "They don't eat meat. (Et yemiyorlar.)",
          "Does he play football? (Futbol oynuyor mu?)",
          "Water boils at 100 degrees. (Su 100 derecede kaynar.)",
        ]}
        exercises={[
          "Fiili doğru biçimde yaz: She (study) ___ every evening.",
          "Olumsuz yap: They drink coffee. → They ___ coffee.",
          "Soru kur: He goes to school. → ___ he ___ to school?",
        ]}
        errors={[
          { wrong: "She don't like spicy food.", correct: "She doesn't like spicy food." },
          { wrong: "He work in a hospital.", correct: "He works in a hospital." },
          { wrong: "Do she live here?", correct: "Does she live here?" },
        ]}
      />,
    },
    {
      id: 'wh-questions',
      title: 'Wh- Questions — Soru Kelimeleri',
      body: <FullGrammarBox
        descTR="Wh- soruları bilgi soran sorulardır ve evet/hayır cevabı almazlar. Who (kim), What (ne), Where (nerede), When (ne zaman), Why (neden), How (nasıl) ile başlarlar. Soru kelimesi + yardımcı fiil + özne + fiil sırasıyla kurulur."
        formula={`Who / What / Where / When / Why / How
+ yardımcı fiil (do/does/is/are) + özne + fiil?
What do you do? / Where does she live?
Who is that? / How are you?`}
        examples={[
          "What is your name? (İsmin ne?)",
          "Where do you live? (Nerede yaşıyorsun?)",
          "When does the lesson start? (Ders ne zaman başlıyor?)",
          "Why are you sad? (Neden üzgünsün?)",
          "How do you go to school? (Okula nasıl gidiyorsun?)",
        ]}
        exercises={[
          "Doğru soru kelimesini seç: ___ is your favourite colour? (Who / What / Where)",
          "Soru kur: She is from Spain. → ___ is she from?",
          "Cevaba uygun soruyu yaz: 'I go to school by bus.' → ___ do you go to school?",
        ]}
        errors={[
          { wrong: "Where you live?", correct: "Where do you live?" },
          { wrong: "What she is doing?", correct: "What is she doing?" },
          { wrong: "Why he is late?", correct: "Why is he late?" },
        ]}
      />,
    },
    {
      id: 'plurals',
      title: 'Plurals — İsimlerin Çoğulu',
      body: <FullGrammarBox
        descTR="İngilizce'de çoğul genellikle ismin sonuna -s veya -es eklenerek yapılır. Bazı isimler düzensiz çoğul alır ve ezberlenmeleri gerekir. -s, -sh, -ch, -x, -z ile biten isimlere -es eklenir."
        formula={`Normal: +s → book → books
-s/-sh/-ch/-x/-z: +es → bus → buses
-y (ünsüz+y): y→i+es → city → cities
Düzensiz: man→men, child→children, tooth→teeth, foot→feet, mouse→mice, sheep→sheep`}
        examples={[
          "One cat → two cats (kedi → kediler)",
          "One bus → two buses (otobüs → otobüsler)",
          "One city → three cities (şehir → şehirler)",
          "One child → many children (çocuk → çocuklar)",
          "One tooth → my teeth hurt (diş → dişler)",
        ]}
        exercises={[
          "Çoğul yaz: woman → ___, foot → ___, sheep → ___",
          "Cümleyi çoğul yap: There is a box on the table. → There are ___ on the table.",
          "Hatalı olanı düzelt: I have three childs.",
        ]}
        errors={[
          { wrong: "There are two mans.", correct: "There are two men." },
          { wrong: "I see many sheeps.", correct: "I see many sheep." },
          { wrong: "She has two childs.", correct: "She has two children." },
        ]}
      />,
    },
    {
      id: 'articles',
      title: 'Articles — a / an / the',
      body: <FullGrammarBox
        descTR="'A' ve 'an' belirsiz artikel olup ilk kez bahsedilen tekil, sayılabilir isimler önünde kullanılır. Sesli harfle başlayan isimler önünde 'an' kullanılır. 'The' belirli artikel olup daha önce söz edilen veya her ikisi tarafından da bilinen şeyler için kullanılır."
        formula={`a + ünsüz sesle başlayan isim: a cat, a book
an + sesli sesle başlayan isim: an apple, an hour
the + bilinen/belirli isim: the moon, the president
Artikel YOK: genel kavramlar, özel isimler`}
        examples={[
          "I have a cat. The cat is black. (İlk kez → sonra bilinen)",
          "She is an engineer. (Meslek belirtirken a/an)",
          "Can you close the door? (İkimiz de bildiğimiz kapı)",
          "The sun rises in the east. (Genel gerçek)",
          "I like chocolate. (Genel → artikel yok!)",
        ]}
        exercises={[
          "Boşluğu doldur: I need ___ umbrella. (a / an / the)",
          "Boşluğu doldur: ___ Eiffel Tower is in Paris.",
          "Doğru mu yanlış mı? 'She is a honest person.' → ___",
        ]}
        errors={[
          { wrong: "She is a engineer.", correct: "She is an engineer." },
          { wrong: "I like the chocolate. (genel olarak)", correct: "I like chocolate." },
          { wrong: "A sun is very hot.", correct: "The sun is very hot." },
        ]}
      />,
    },
    {
      id: 'possessives',
      title: 'Possessives — İyelik',
      body: <FullGrammarBox
        descTR="İngilizce'de iyelik iki şekilde ifade edilir: iyelik sıfatları (my/your/his/her/its/our/their) bir ismin önünde kullanılır. İyelik zamirleri (mine/yours/his/hers/ours/theirs) bağımsız olarak kullanılır. İsim + 's de iyelik gösterir."
        formula={`Sıfat + isim: my bag, his phone, their house
Bağımsız zamir: This is mine. / That's hers.
İsim + 's: Sara's book, the teacher's car`}
        examples={[
          "This is my bag. (Bu benim çantam.)",
          "His car is red. (Onun arabası kırmızı.)",
          "Sara's phone is new. (Sara'nın telefonu yeni.)",
          "Their house is near the school. (Onların evi okulun yakınında.)",
          "It's her book, not mine. (Bu onun kitabı, benimki değil.)",
        ]}
        exercises={[
          "Boşluğu doldur: Is this ___ bag? (you / your / yours)",
          "Çevir: Bu Ali'nin kalemi. → This is ___ pen.",
          "Yanlışı düzelt: The cat licked it's paw.",
        ]}
        errors={[
          { wrong: "This is hers bag.", correct: "This is her bag." },
          { wrong: "The cat licked it's paw.", correct: "The cat licked its paw. (it's = it is!)" },
          { wrong: "That is mine car.", correct: "That is my car." },
        ]}
      />,
    },
    {
      id: 'prepositions-place',
      title: 'Prepositions of Place — Yer Edatları',
      body: <FullGrammarBox
        descTR="Yer edatları, nesnelerin birbirine göre konumunu anlatmak için kullanılır. 'In' bir şeyin içinde; 'on' bir şeyin üzerinde; 'at' belirli bir noktada; 'under' altında; 'next to' yanında anlamına gelir. Şehirler ve ülkeler için 'in' kullanılır."
        formula={`in  → içinde: in the box, in London
on  → üzerinde: on the table, on the wall
at  → noktada: at the door, at the station
under → altında: under the bed
next to → yanında: next to the shop
between → arasında: between A and B`}
        examples={[
          "The cat is in the box. (Kedi kutunun içinde.)",
          "The book is on the table. (Kitap masanın üzerinde.)",
          "She is at the bus stop. (O otobüs durağında.)",
          "The dog is under the chair. (Köpek sandalyenin altında.)",
          "The bank is next to the pharmacy. (Banka eczanenin yanında.)",
        ]}
        exercises={[
          "Boşluğu doldur: The keys are ___ the drawer. (in / on / at)",
          "Resmi tarif et: The café is ___ the library and the school.",
          "Çevir: Kitap rafın üzerinde. → The book is ___ the shelf.",
        ]}
        errors={[
          { wrong: "I am in the bus stop.", correct: "I am at the bus stop." },
          { wrong: "The picture is in the wall.", correct: "The picture is on the wall." },
          { wrong: "She lives on London.", correct: "She lives in London." },
        ]}
      />,
    },
  ],
  A2: [
    {
      id: 'simple-past',
      title: 'Simple Past — Geçmiş Zaman',
      body: <FullGrammarBox
        descTR="Geçmiş zaman, geçmişte tamamlanmış eylemler için kullanılır. Düzenli fiiller -ed alır. Düzensiz fiillerin geçmiş formları (V2) ezberlenmelidir. Olumsuzda 'didn't' kullanılır ve fiil yalın hale döner."
        formula={`(+) I walked / She went / They ate
(-) I didn't walk / She didn't go
(?) Did you walk? / Did she go?
Zaman ifadeleri: yesterday, last night, ago, in 2020`}
        examples={[
          "I watched a film last night. (Dün gece film izledim.)",
          "She didn't come to the party. (Partiye gelmedi.)",
          "Did you eat breakfast this morning? (Bu sabah kahvaltı ettin mi?)",
          "He went to London two years ago. (İki yıl önce Londra'ya gitti.)",
          "They played football yesterday. (Dün futbol oynadılar.)",
        ]}
        exercises={[
          "Düzenli geçmiş yap: She (visit) ___ her grandmother last Sunday.",
          "Olumsuz yap: He went to school. → He ___ to school.",
          "Soru kur: They watched TV. → ___ they ___ TV?",
        ]}
        errors={[
          { wrong: "She didn't went to school.", correct: "She didn't go to school." },
          { wrong: "Did he went there?", correct: "Did he go there?" },
          { wrong: "I goed to the park.", correct: "I went to the park." },
        ]}
      />,
    },
    {
      id: 'past-continuous',
      title: 'Past Continuous — Geçmişte Süregelen Eylem',
      body: <FullGrammarBox
        descTR="Geçmişte belirli bir anda devam eden bir eylemi anlatır. Çoğunlukla Simple Past ile birlikte kullanılır: bir eylem devam ederken başka bir eylem olur. 'was/were + fiil-ing' yapısıyla kurulur."
        formula={`I / He / She / It + was + verb-ing
We / You / They + were + verb-ing
(-) wasn't / weren't + verb-ing
(?) Was she sleeping? / Were they working?`}
        examples={[
          "I was studying when she called. (O aradığında çalışıyordum.)",
          "It was raining all morning. (Bütün sabah yağmur yağıyordu.)",
          "What were you doing at 8 pm? (Saat 8'de ne yapıyordun?)",
          "She wasn't listening to the teacher. (Öğretmeni dinlemiyordu.)",
          "They were having dinner when I arrived. (Geldiğimde yemek yiyorlardı.)",
        ]}
        exercises={[
          "Boşluğu doldur: She ___ (read) a book when the phone rang.",
          "Olumsuz yap: He was watching TV. → He ___ TV.",
          "Soru kur: They were sleeping at midnight. → ___ they ___ at midnight?",
        ]}
        errors={[
          { wrong: "I was study when you called.", correct: "I was studying when you called." },
          { wrong: "She were cooking dinner.", correct: "She was cooking dinner." },
          { wrong: "They was playing football.", correct: "They were playing football." },
        ]}
      />,
    },
    {
      id: 'future',
      title: 'Future — Gelecek Zaman (will / going to)',
      body: <FullGrammarBox
        descTR="'Will' ani kararlar, tahminler ve vaatler için kullanılır. 'Going to' önceden planlanmış eylemler ve mevcut kanıta dayalı tahminler için kullanılır. Fark önemlidir — ikisini karıştırmayın!"
        formula={`will + V (yalın): ani karar, söz, tahmin
am/is/are + going to + V: plan, kanıta dayalı tahmin
Will: I will help you. (Şimdi karar verdim.)
Going to: I'm going to study. (Önceden planladım.)`}
        examples={[
          "I will help you with your homework. (Sana yardım edeceğim.) — ani karar",
          "She is going to visit her parents next week. — plan",
          "It's very cloudy. It's going to rain. — kanıta dayalı tahmin",
          "Will you open the window, please? — rica",
          "I think prices will rise next year. — genel tahmin",
        ]}
        exercises={[
          "Will mi Going to mu? 'I have a dentist appointment tomorrow.' → I ___ go to the dentist.",
          "Cümleyi tamamla: A: The phone is ringing! B: I ___ answer it.",
          "Yanlışı düzelt: I will to call you later.",
        ]}
        errors={[
          { wrong: "I will to call you.", correct: "I will call you." },
          { wrong: "She is going study tonight.", correct: "She is going to study tonight." },
          { wrong: "Will you to help me?", correct: "Will you help me?" },
        ]}
      />,
    },
    {
      id: 'comparatives',
      title: 'Comparatives & Superlatives — Karşılaştırma',
      body: <FullGrammarBox
        descTR="Karşılaştırma sıfatları iki şeyi kıyaslar; üstünlük sıfatları bir gruptaki en üstünü gösterir. Kısa sıfatlar -er/-est alır; iki veya daha fazla heceli sıfatlar 'more/most' alır. Karşılaştırmada 'than' kullanılır."
        formula={`Kısa (1 hece): tall → taller than → the tallest
Uzun (2+ hece): beautiful → more beautiful → the most beautiful
Düzensiz: good→better→best / bad→worse→worst / far→farther→farthest`}
        examples={[
          "She is taller than her brother. (O, kardeşinden daha uzun.)",
          "This film is more interesting than the last one.",
          "Istanbul is the biggest city in Turkey.",
          "Today is worse than yesterday. (Bugün dünden daha kötü.)",
          "She is the best student in the class.",
        ]}
        exercises={[
          "Karşılaştırma yap: My bag is (heavy) ___ than yours.",
          "Üstünlük yaz: He is (good) ___ player on the team.",
          "Yanlışı düzelt: This book is more better than that one.",
        ]}
        errors={[
          { wrong: "She is more tall than him.", correct: "She is taller than him." },
          { wrong: "He is the most fast runner.", correct: "He is the fastest runner." },
          { wrong: "This is more better.", correct: "This is better." },
        ]}
      />,
    },
    {
      id: 'modals-1',
      title: 'Modal Verbs — can / could / should',
      body: <FullGrammarBox
        descTR="Modal fiiller yardımcı fiillerdir ve asıl fiilin önünde gelir. 'Can' yetenek veya izin; 'could' kibarca istek veya geçmiş yetenek; 'should' tavsiye anlamında kullanılır. Modal sonrasında daima fiilin yalın hali (bare infinitive) gelir."
        formula={`can / could / should + VERB (yalın — to'suz!)
(+) She can swim. / Could you help me?
(-) She can't swim. / I shouldn't eat this.
(?) Can she swim? — Yes, she can.`}
        examples={[
          "I can speak three languages. — yetenek",
          "Could you help me, please? — kibar rica",
          "You should exercise every day. — tavsiye",
          "She couldn't come to the party. — geçmişteki yetersizlik",
          "Can I open the window? — izin",
        ]}
        exercises={[
          "Boşluğu doldur: He ___ play guitar very well. He practises every day.",
          "Tavsiye ver: She has a cold. → She ___ rest and drink water.",
          "Yanlışı düzelt: You should to eat more vegetables.",
        ]}
        errors={[
          { wrong: "She can to swim.", correct: "She can swim." },
          { wrong: "You should eats less sugar.", correct: "You should eat less sugar." },
          { wrong: "Can you to help me?", correct: "Can you help me?" },
        ]}
      />,
    },
    {
      id: 'there-is-are',
      title: 'There is / There are — Var / Yok',
      body: <FullGrammarBox
        descTR="'There is/are' yapısı bir yerde bir şeyin var olduğunu veya olmadığını anlatmak için kullanılır. Tekil ve sayılamaz isimler için 'there is'; çoğul isimler için 'there are' kullanılır. Geçmiş: there was/were."
        formula={`There is + tekil/sayılamaz isim
There are + çoğul isim
(-) There isn't / There aren't
(?) Is there...? / Are there...?
Geçmiş: There was / There were`}
        examples={[
          "There is a park near my house. (Evimin yakınında bir park var.)",
          "There are three students in the room.",
          "There isn't any milk in the fridge. (Buzdolabında süt yok.)",
          "Are there any hotels near here?",
          "There was a big storm last night.",
        ]}
        exercises={[
          "Doğru formu seç: ___ a good restaurant near here? (Is there / Are there)",
          "Olumsuz yap: There are some chairs in the room.",
          "Çevir: Sınıfta 20 öğrenci var.",
        ]}
        errors={[
          { wrong: "There is many people here.", correct: "There are many people here." },
          { wrong: "Are there a bank nearby?", correct: "Is there a bank nearby?" },
          { wrong: "There are a dog in the garden.", correct: "There is a dog in the garden." },
        ]}
      />,
    },
    {
      id: 'countable',
      title: 'Countable / Uncountable — Sayılabilir / Sayılamaz',
      body: <FullGrammarBox
        descTR="Sayılabilir isimler a/an alabilir ve çoğul olabilir. Sayılamaz isimler (su, süt, ekmek, bilgi vb.) genellikle çoğul olmaz ve a/an almaz. Miktarı belirtmek için farklı kelimeler kullanılır."
        formula={`Sayılabilir: a/an, many, a few, how many, few
Sayılamaz: -, much, a little, how much, little
Her ikisi: some (olumlu) / any (olumsuz & soru)
Sayılamaz birimlendirme: a cup of tea, a piece of bread`}
        examples={[
          "I have two apples. (sayılabilir — çoğul oldu)",
          "There is some milk in the glass. (sayılamaz — some)",
          "How many students are there? (sayılabilir)",
          "How much water do you drink? (sayılamaz)",
          "There isn't any bread left. (olumsuz)",
        ]}
        exercises={[
          "How much mi How many mi? ___ money do you have?",
          "Many mi Much mi? There aren't ___ seats left.",
          "Yanlışı düzelt: I need an information.",
        ]}
        errors={[
          { wrong: "I need an information.", correct: "I need some information." },
          { wrong: "How many money?", correct: "How much money?" },
          { wrong: "Can I have a water?", correct: "Can I have some water?" },
        ]}
      />,
    },
    {
      id: 'prepositions-time',
      title: 'Prepositions of Time — at / on / in',
      body: <FullGrammarBox
        descTR="Zaman edatları belirli bir kuralla kullanılır: 'at' saatler ve belirli zamanlar için; 'on' günler ve tarihler için; 'in' aylar, yıllar, mevsimler ve günün bölümleri için kullanılır. Bu üç edatı doğru seçmek çok önemlidir."
        formula={`at: at 3 o'clock / at midnight / at noon / at the weekend (BrE)
on: on Monday / on 5th March / on my birthday / on Christmas Day
in: in January / in 2020 / in summer / in the morning/afternoon/evening`}
        examples={[
          "The class starts at 9 o'clock.",
          "I was born on the 15th of April.",
          "She goes on holiday in August.",
          "I study in the evening.",
          "He arrived at noon.",
        ]}
        exercises={[
          "Doğru edatı seç: I have a meeting ___ Friday. (at / on / in)",
          "Boşluğu doldur: She was born ___ 1998.",
          "Yanlışı düzelt: I'll see you in Monday.",
        ]}
        errors={[
          { wrong: "I'll see you in Monday.", correct: "I'll see you on Monday." },
          { wrong: "He was born on 1995.", correct: "He was born in 1995." },
          { wrong: "The film starts in 8 pm.", correct: "The film starts at 8 pm." },
        ]}
      />,
    },
    {
      id: 'subject-object',
      title: 'Subject & Object Pronouns — Özne ve Nesne Zamirleri',
      body: <FullGrammarBox
        descTR="Özne zamirleri cümlenin öznesidir (eylemi yapan). Nesne zamirleri ise eylemin nesnesi olarak kullanılır (fiilden sonra gelir). 'Me and...' yerine '...and I' yapısı doğru İngilizcedir."
        formula={`Özne:  I / you / he / she / it / we / they
Nesne: me / you / him / her / it / us / them
İyelik zamiri: mine / yours / his / hers / ours / theirs`}
        examples={[
          "She likes him. (O, onu seviyor.)",
          "Can you help me? (Bana yardım eder misin?)",
          "Give the book to her. (Kitabı ona ver.)",
          "This bag is mine. (Bu çanta benim.)",
          "They called us last night.",
        ]}
        exercises={[
          "Boşluğu doldur: This is Sara's pen. Give it to ___. (her / she / hers)",
          "Doğru zamiri seç: ___ is my best friend. (Him / He)",
          "Yanlışı düzelt: Me and my sister went to the cinema.",
        ]}
        errors={[
          { wrong: "Me and Ali went shopping.", correct: "Ali and I went shopping." },
          { wrong: "Give it to she.", correct: "Give it to her." },
          { wrong: "This book is your.", correct: "This book is yours." },
        ]}
      />,
    },
    {
      id: 'how-much-many',
      title: 'How much / How many / Enough / Too',
      body: <FullGrammarBox
        descTR="'How many' sayılabilir isimlerle; 'how much' sayılamaz isimlerle kullanılır. 'Too' bir şeyin fazla olduğunu; 'enough' bir şeyin yeterli olduğunu (ya da olmadığını) anlatır. 'Too' sıfat/zarftan önce gelir; 'enough' sıfat/zarftan sonra gelir."
        formula={`How many + çoğul sayılabilir?
How much + sayılamaz?
too + sıfat/zarf: too hot, too quickly
sıfat/zarf + enough: fast enough, good enough`}
        examples={[
          "How many apples do you need?",
          "How much money do you have?",
          "This coffee is too hot to drink. (çok sıcak — içemiyorum)",
          "She isn't old enough to drive. (yeterince yaşlı değil)",
          "There aren't enough chairs for everyone.",
        ]}
        exercises={[
          "Doğru formu seç: ___ time do we have? (How much / How many)",
          "Too mu Enough mu? This bag is ___ heavy for me to carry.",
          "Yanlışı düzelt: She is enough tall to reach the shelf.",
        ]}
        errors={[
          { wrong: "How many water?", correct: "How much water?" },
          { wrong: "She is enough old.", correct: "She is old enough." },
          { wrong: "I have too much friends.", correct: "I have too many friends." },
        ]}
      />,
    },
  ],
  B1: [
    {
      id: 'present-perfect',
      title: 'Present Perfect — Yakın Geçmiş',
      body: <FullGrammarBox
        descTR="Present perfect, geçmişte başlayıp şimdiki zamanla bağlantısı olan eylemleri anlatır. Kesin geçmiş zaman ifadesiyle (yesterday, last year, in 2010) kullanılmaz — bunlar için Simple Past kullanılır. 'Have/has + past participle' yapısıyla kurulur."
        formula={`have/has + past participle (V3)
for + süre: I have lived here for 5 years.
since + başlangıç: since 2020, since Monday
just / already / yet / ever / never`}
        examples={[
          "I have lived in Istanbul for five years. (5 yıldır burada yaşıyorum.)",
          "She has just finished her homework. (Az önce bitirdi.)",
          "Have you ever eaten sushi? (Hiç sushi yedin mi?)",
          "They haven't replied yet. (Henüz cevap vermediler.)",
          "He has already left. (Zaten ayrıldı.)",
        ]}
        exercises={[
          "Fiili doğru biçimde yaz: She (never / try) ___ skydiving.",
          "For mu Since mu? I have known him ___ we were children.",
          "Simple Past mi Present Perfect mi? 'I ___ to Paris in 2019.' vs 'I ___ never ___ to Paris.'",
        ]}
        errors={[
          { wrong: "I have seen him yesterday.", correct: "I saw him yesterday." },
          { wrong: "She has went to Paris.", correct: "She has gone to Paris." },
          { wrong: "I have lived here since 3 years.", correct: "I have lived here for 3 years." },
        ]}
      />,
    },
    {
      id: 'past-perfect',
      title: 'Past Perfect — Geçmişten Önceki Geçmiş',
      body: <FullGrammarBox
        descTR="Past perfect, geçmişte başka bir geçmiş eylemden önce gerçekleşen eylemi anlatır. 'had + past participle' yapısıyla kurulur. Genellikle Simple Past ile birlikte 'before / after / when / by the time' bağlaçlarıyla kullanılır."
        formula={`had + past participle (V3)
By the time + Simple Past, had + V3
After she had eaten, she went to bed.
(-) hadn't + V3 / (?) Had + subject + V3?`}
        examples={[
          "By the time I arrived, she had already left.",
          "He felt tired because he hadn't slept.",
          "I had never seen snow before I visited Canada.",
          "She had studied hard, so she passed the exam.",
          "Had you met him before the party?",
        ]}
        exercises={[
          "Boşluğu doldur: When I got to the station, the train ___ (already / leave).",
          "Doğru sıralamayı göster: She passed the exam because she ___.",
          "Yanlışı düzelt: He didn't ate before he came.",
        ]}
        errors={[
          { wrong: "She had went home.", correct: "She had gone home." },
          { wrong: "By the time he came, I leave.", correct: "By the time he came, I had left." },
          { wrong: "I had saw that film before.", correct: "I had seen that film before." },
        ]}
      />,
    },
    {
      id: 'passive',
      title: 'Passive Voice — Edilgen Yapı',
      body: <FullGrammarBox
        descTR="Edilgen yapıda eylemin nesnesi özne konumuna gelir. Yapanın kim olduğu bilinmiyorsa, önemsizse veya vurgulamak istemiyorsak edilgen kullanılır. 'be (doğru zaman) + past participle' yapısıyla kurulur."
        formula={`Şimdiki:  am/is/are + V3
Geçmiş:  was/were + V3
Gelecek: will be + V3
Süregelen: is/are being + V3
Mükemmel: has/have been + V3
(by + yapan kişi) isteğe bağlıdır`}
        examples={[
          "The film was directed by Christopher Nolan.",
          "English is spoken in many countries.",
          "The house was built 100 years ago.",
          "The results will be announced tomorrow.",
          "The report is being written at the moment.",
        ]}
        exercises={[
          "Edilgene çevir: Someone stole my wallet. → My wallet ___.",
          "Doğru formu seç: The report (is writing / is being written) at the moment.",
          "Yanlışı düzelt: The book was wrote in 1950.",
        ]}
        errors={[
          { wrong: "The book was wrote in French.", correct: "The book was written in French." },
          { wrong: "English is speak all over the world.", correct: "English is spoken all over the world." },
          { wrong: "It is been done.", correct: "It has been done." },
        ]}
      />,
    },
    {
      id: 'first-conditional',
      title: '1st Conditional — Gerçekleşebilir Koşul',
      body: <FullGrammarBox
        descTR="Birinci koşul, gerçekleşmesi mümkün olan koşulları ve bunların sonuçlarını anlatır. 'If' ile başlayan koşul cümleciğinde Simple Present; sonuç cümleciğinde 'will + fiil' kullanılır. 'Unless' = 'if...not' anlamına gelir."
        formula={`If + Simple Present, will + V (yalın)
Unless + Simple Present, will + V
If = eğer / Unless = ...madeği sürece
Koşul cümleciğinde 'will' KULLANILMAZ!`}
        examples={[
          "If you study hard, you will pass the exam.",
          "She will call you if she has time.",
          "If it doesn't rain tomorrow, we will go to the beach.",
          "What will you do if you miss the bus?",
          "Unless you hurry, you'll miss the train. (Acele etmezsen, treni kaçırırsın.)",
        ]}
        exercises={[
          "Tamamla: If she ___ (not / hurry), she ___ (miss) the train.",
          "Birleştir: Study hard. You'll pass. → If you ___, you ___.",
          "Yanlışı düzelt: If it will rain, I'll stay at home.",
        ]}
        errors={[
          { wrong: "If it will rain, I'll take an umbrella.", correct: "If it rains, I'll take an umbrella." },
          { wrong: "If you will come, we'll be happy.", correct: "If you come, we'll be happy." },
          { wrong: "If I study, I will passed.", correct: "If I study, I will pass." },
        ]}
      />,
    },
    {
      id: 'second-conditional',
      title: '2nd Conditional — Hayali / Varsayımsal Durum',
      body: <FullGrammarBox
        descTR="İkinci koşul, şu anda gerçek olmayan veya gerçekleşmesi çok olası olmayan durumları hayal etmek için kullanılır. Koşul cümleciğinde Simple Past; sonuç cümleciğinde 'would + fiil' kullanılır. 'If I were you' önemli bir deyim kalıbıdır."
        formula={`If + Simple Past, would + V (yalın)
If I were rich, I would travel.
If I were you (her zaman 'were' — were, was değil!)
Sonuç: would / could / might + V`}
        examples={[
          "If I had more time, I would learn Spanish.",
          "If I were you, I would apologise immediately.",
          "She would travel more if she had money.",
          "What would you do if you won the lottery?",
          "If we lived in the countryside, life would be more peaceful.",
        ]}
        exercises={[
          "Doğru formu yaz: If he (know) the answer, he (tell) you.",
          "Hayali durum kur: 'I am not a pilot.' → If I ___ a pilot, I ___ around the world.",
          "Yanlışı düzelt: If I would have money, I would buy a house.",
        ]}
        errors={[
          { wrong: "If I would be rich, I would travel.", correct: "If I were rich, I would travel." },
          { wrong: "If he had time, he will come.", correct: "If he had time, he would come." },
          { wrong: "I would to go if I could.", correct: "I would go if I could." },
        ]}
      />,
    },
    {
      id: 'reported-speech',
      title: 'Reported Speech — Dolaylı Anlatım',
      body: <FullGrammarBox
        descTR="Birinin söylediklerini aktarırken (dolaylı anlatım), tırnak işaretlerini kaldırıp zamanı bir adım geri kaydırırız ve zamirleri değiştiririz. 'Say' nesnesiz kullanılır; 'tell' mutlaka bir nesne alır: 'He told me...'"
        formula={`Direct: "I am tired." → Reported: She said she was tired.
am/is→was | are→were | will→would | go→went
have gone→had gone | can→could
tell + nesne: She told me (that) she was tired.
say + (that): He said (that) he was fine.`}
        examples={[
          '"I love this city." → She said she loved that city.',
          '"We will come tomorrow." → They said they would come the next day.',
          '"I am studying." → He told me he was studying.',
          '"I have finished." → She said she had finished.',
          '"Don\'t worry." → He told me not to worry.',
        ]}
        exercises={[
          'Dolaylı aktarıma çevir: "I work in London." → He said he ___ in London.',
          'Tell mi Say mi? She ___ me that she was leaving.',
          'Yanlışı düzelt: She said me she was tired.',
        ]}
        errors={[
          { wrong: "She said me that she was tired.", correct: "She told me that she was tired." },
          { wrong: "He said he will come.", correct: "He said he would come." },
          { wrong: "They told that they were happy.", correct: "They said (that) they were happy." },
        ]}
      />,
    },
    {
      id: 'relative-clauses',
      title: 'Relative Clauses — İlgi Cümleleri',
      body: <FullGrammarBox
        descTR="İlgi cümleleri, bir ismi tanımlamak veya hakkında ek bilgi vermek için kullanılır. Tanımlayıcı (defining) ilgi cümlelerinde virgül kullanılmaz. Ekleyici (non-defining) ilgi cümlelerinde virgül kullanılır ve 'that' kullanılamaz."
        formula={`who → insanlar: the man who called
which → nesneler: the book which I read
that → her ikisi (defining only): the film that I watched
where → yerler: the city where I grew up
whose → iyelik: the girl whose bag was stolen`}
        examples={[
          "The woman who works here is very kind.",
          "The film which I saw last week was brilliant.",
          "This is the city where I was born.",
          "She is the student whose essay won the competition.",
          "My brother, who lives in London, is a doctor. (virgüllü — ekleyici)",
        ]}
        exercises={[
          "Boşluğu doldur: The restaurant ___ we ate last night was amazing. (who / which / where)",
          "Birleştir: I know a man. He speaks five languages. → I know a man ___.",
          "Yanlışı düzelt: She's the girl which won the prize.",
        ]}
        errors={[
          { wrong: "She's the girl which won.", correct: "She's the girl who won." },
          { wrong: "The city where I born.", correct: "The city where I was born." },
          { wrong: "That's the man who his car was stolen.", correct: "That's the man whose car was stolen." },
        ]}
      />,
    },
    {
      id: 'modals-2',
      title: 'Modal Verbs — must / might / should have',
      body: <FullGrammarBox
        descTR="'Must' kesin zorunluluk veya güçlü mantıksal çıkarım (deduction) için; 'might/may' %30-50 olasılık için; 'should have / must have + V3' geçmişe yönelik çıkarım veya pişmanlık için kullanılır."
        formula={`must + V: zorunluluk / güçlü çıkarım (emin)
might/may + V: olasılık (yarı emin)
can't + V: imkânsız çıkarım
should have + V3: geçmiş pişmanlık / eleştiri
must have + V3: geçmişe güçlü çıkarım`}
        examples={[
          "You must wear a seatbelt. — kural / zorunluluk",
          "She must be tired — she worked all day. — çıkarım",
          "It might rain later. Take an umbrella. — olasılık",
          "You should have studied harder. — pişmanlık/eleştiri",
          "He must have forgotten. He never arrives late. — güçlü çıkarım",
        ]}
        exercises={[
          "Çıkarım yap: 'The lights are off.' → They ___ be at home. (can't / must / might)",
          "Pişmanlık ifade et: 'I didn't call her.' → I ___ called her.",
          "Yanlışı düzelt: She might to come later.",
        ]}
        errors={[
          { wrong: "She might to come.", correct: "She might come." },
          { wrong: "You should have study harder.", correct: "You should have studied harder." },
          { wrong: "He must to leave now.", correct: "He must leave now." },
        ]}
      />,
    },
    {
      id: 'gerunds-infinitives',
      title: 'Gerunds & Infinitives — -ing mi, to + fiil mi?',
      body: <FullGrammarBox
        descTR="Bazı fiiller arkasından gerund (-ing) alır, bazıları infinitive (to+fiil) alır. 'Stop, remember, try, forget' gibi fiiller her ikisini de alır ama anlam değişir. Bu listeyi ezberlemek çok önemlidir."
        formula={`Gerund sonrası: enjoy / finish / avoid / mind / suggest / keep / consider / deny
Infinitive sonrası: want / decide / plan / hope / seem / afford / agree / refuse
Hem gerund hem infinitive (anlam DEĞİŞMEZ): like, love, hate, start, begin
Hem gerund hem infinitive (anlam DEĞİŞİR): stop, remember, try, forget`}
        examples={[
          "I enjoy reading in the evenings. — gerund",
          "She decided to move to another city. — infinitive",
          "He stopped smoking last year. (sigarayı bıraktı) — gerund",
          "He stopped to smoke. (sigara içmek için durdu) — infinitive",
          "I remember locking the door. (kilitlediğimi hatırlıyorum — geçmiş eylem)",
        ]}
        exercises={[
          "Gerund mı Infinitive mı? She avoided ___ (look) at him.",
          "Anlamı belirle: 'I tried calling her.' vs 'I tried to call her.'",
          "Yanlışı düzelt: I enjoy to cook at weekends.",
        ]}
        errors={[
          { wrong: "I enjoy to watch films.", correct: "I enjoy watching films." },
          { wrong: "She decided moving abroad.", correct: "She decided to move abroad." },
          { wrong: "He suggested to go by train.", correct: "He suggested going by train." },
        ]}
      />,
    },
  ],
}

export function GrammarModule() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Gramer</h2>
        <p style={{ color: '#a0a0a0', fontSize: 13 }}>
          Türkçe açıklama, formül, örnekler, pratik alıştırmaları ve yaygın hatalar.
        </p>
      </div>
      <LevelTabsLayout moduleKey="grammar" content={CONTENT} />
    </div>
  )
}
