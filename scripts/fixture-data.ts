// Faz 1 retrieval fixture seti — scripts/import-fixtures.ts tarafından
// canlı Supabase'e yazılır, lib/ai/retrieval.test.ts tarafından okunur.
//
// İşaretleme: tüm fixture kayıtları FIXTURE_USER_ID altında yaşar. Gerçek
// kullanıcı verisiyle hiçbir zaman karışmaz (retrieval user_id ile filtreli);
// temizlik tek bir delete'tir (import-fixtures.ts --clean).
//
// Kompozisyon (roadmap kriteri "100+ öğelik fixture seti"):
//   *  4 vizyon belgesi (docs/vision/*.md — gerçek içerik, script okur)
//   * 17 elle yazılmış tematik parça (IELTS, burs, spor, Reborn, kişisel)
//   * 84 deterministik dolgu (21 konu × 4 varyant) — retrieval'ın gürültü
//     içinde doğru sonucu bulduğunu ölçmek için gerçekçi çeldiriciler.
//     Dolgu konuları bilinçli olarak test sorgusu temalarından (IELTS, burs,
//     spor/antrenman, Reborn/vizyon) uzak seçildi.

import type { EntityType } from '../lib/db'

/** Fixture verisinin sahibi — sentinel uuid, gerçek profiles kaydı değil. */
export const FIXTURE_USER_ID = '00000000-0000-4000-a000-000000000001'

export interface FixtureItem {
  /** Link tanımları ve test beklentileri için kararlı anahtar. */
  key: string
  type: EntityType
  title: string
  content: string
  /** created_at = şimdi - daysAgo gün (recency ağırlığını test edilebilir kılar). */
  daysAgo: number
}

export interface FixtureLink {
  source: string
  target: string
  kind: 'user' | 'semantic'
  label?: string
  strength?: number
}

// ── Vizyon belgeleri (içerik dosyadan okunur) ────────────────────────────────

export interface VisionDoc {
  key: string
  file: string
  title: string
  daysAgo: number
}

export const VISION_DOCS: VisionDoc[] = [
  { key: 'vision-01', file: 'docs/vision/01-nihai-amac.md', title: "Reborn'un Nihai Amacı (Ultimate Goal)", daysAgo: 85 },
  { key: 'vision-02', file: 'docs/vision/02-uzun-vadeli-vizyon.md', title: "Reborn'un Uzun Vadeli Vizyonu", daysAgo: 84 },
  { key: 'vision-03', file: 'docs/vision/03-tasarim-prensipleri.md', title: 'Reborn Tasarım Prensipleri', daysAgo: 83 },
  { key: 'vision-04', file: 'docs/vision/04-kurucu-ortak-talimati.md', title: 'Kurucu Ortak Talimatı', daysAgo: 82 },
]

// ── Elle yazılmış tematik parçalar ───────────────────────────────────────────

export const HANDCRAFTED: FixtureItem[] = [
  // Tema: IELTS / İngilizce
  {
    key: 'goal-ielts',
    type: 'goal',
    title: 'Achieve IELTS band 7.5 overall by September 2026',
    content:
      'Reading and listening are already strong. Writing task 2 essays and speaking fluency need consistent daily practice. Weekly plan: two full mock exams, daily speaking recordings, academic vocabulary review.',
    daysAgo: 60,
  },
  {
    key: 'journal-ielts-reading',
    type: 'journal',
    title: 'IELTS reading denemesi',
    content:
      "Bugün Cambridge 18'den tam bir IELTS reading denemesi çözdüm. 40 soruda 33 doğru — band 7.0 civarı. True/False/Not Given sorularında hâlâ acele ediyorum; yarın sadece o soru tipine çalışacağım.",
    daysAgo: 12,
  },
  {
    key: 'journal-ielts-speaking',
    type: 'journal',
    title: 'Speaking pratiği ve akıcılık sorunu',
    content:
      "IELTS speaking part 2'de kartta çıkan konuyu anlatırken çok duraksadım. Kelime bilgim var ama cümleye dökerken donuyorum. Her akşam iki dakikalık sesli anlatım kaydı almaya karar verdim.",
    daysAgo: 5,
  },
  {
    key: 'note-vocab',
    type: 'note',
    title: 'Akademik kelime listesi çalışması',
    content:
      "AWL (Academic Word List) üzerinden 30 yeni kelime çıkardım: mitigate, coherent, paradigm, empirical... Her kelimeyi IELTS writing'de kullanabileceğim örnek cümleyle beraber deftere yazdım.",
    daysAgo: 20,
  },

  // Tema: Burs / yurtdışı
  {
    key: 'goal-scholarship',
    type: 'goal',
    title: 'Win a full scholarship for computer science abroad',
    content:
      'Target: fully funded undergraduate computer science programs in Europe and the US. Requirements to line up: IELTS score, strong motivation letter, reference letters, portfolio project (Reborn). Applications open in autumn.',
    daysAgo: 70,
  },
  {
    key: 'note-deadlines',
    type: 'note',
    title: 'Burs başvuru takvimi',
    content:
      'Yurtdışı burs başvuruları için son tarihler: Jacobs University erken başvuru aralık başı, Bocconi ocak ortası, ABD common app aralık sonu. Gerekli belgeler: transkript, iki referans mektubu, motivasyon mektubu, IELTS sonucu.',
    daysAgo: 25,
  },
  {
    key: 'journal-essay',
    type: 'journal',
    title: "Başvuru essay'i ile boğuşma",
    content:
      'Burs başvurusu için motivasyon mektubunun giriş paragrafını dört kez silip baştan yazdım. Kendimi övmeden güçlü göstermek zor. Sonunda kendi hikayemden — kendi kendime kod öğrenmekten — başlamaya karar verdim.',
    daysAgo: 8,
  },
  {
    key: 'essay-draft',
    type: 'essay',
    title: 'Scholarship motivation letter draft',
    content:
      'Growing up in Istanbul, I taught myself to code before anyone told me it could become a career. What began as curiosity became a discipline: building projects end to end, failing, rebuilding. A full scholarship would let me turn that discipline into formal depth.',
    daysAgo: 7,
  },

  // Tema: Spor / fitness
  {
    key: 'goal-fitness',
    type: 'goal',
    title: 'Haftada dört gün antrenman yapmak',
    content:
      'Pazartesi ve perşembe spor salonunda ağırlık antrenmanı, salı sabah koşusu, cumartesi serbest hareket günü. Amaç: düzenli antrenman alışkanlığını üç ay boyunca hiç bozmamak.',
    daysAgo: 50,
  },
  {
    key: 'journal-gym',
    type: 'journal',
    title: 'Spor salonunda ağırlık antrenmanı',
    content:
      "Bugün spor salonunda göğüs ve sırt çalıştım. Bench press'te 60 kiloya çıktım, form bozulmadan üç set tamamladım. Antrenman sonrası esneme yapmayı yine unuttum — yarınki koşudan önce mutlaka esneyeceğim.",
    daysAgo: 3,
  },
  {
    key: 'journal-run',
    type: 'journal',
    title: 'Sabah koşusu',
    content:
      'Sabah erkenden sahilde 5 kilometre koştum. Tempom kilometrede 6 dakikaya indi. Koşarken kafam berraklaşıyor; antrenman günlerinde derslerim de daha verimli geçiyor.',
    daysAgo: 10,
  },

  // Tema: Reborn projesi
  {
    key: 'project-reborn',
    type: 'project',
    title: 'Reborn — Life OS inşası',
    content:
      'Kişisel yaşam işletim sistemi projem. Çekirdek ürün hafıza katmanı: entities, links ve embedding tabanlı semantik arama. Kullanıcıya dönük tek AI muhatabı Sanchez. Aynı zamanda burs başvurularım için portfolyo projem.',
    daysAgo: 90,
  },
  {
    key: 'journal-reborn-dev',
    type: 'journal',
    title: 'Hafıza katmanı kodlaması',
    content:
      "Bugün pgvector üzerinde embedding saklama işini bitirdim. bge-m3 modeli lokalde çalışıyor, Türkçe metinlerde benzerlik sonuçları şaşırtıcı derecede iyi. Sıradaki iş: link grafı üzerinden bağlantılı getirme.",
    daysAgo: 2,
  },
  {
    key: 'note-sanchez',
    type: 'note',
    title: 'Sanchez karakteri üzerine notlar',
    content:
      'Sanchez bir chatbot değil, mentor: soru soran, hatırlayan, pohpohlamayan bir karakter. Kullanıcının niyetini anlayıp arka plandaki ajanlara iş dağıtacak ama kullanıcı hep tek bir muhatap görecek.',
    daysAgo: 15,
  },

  // Tema: Kişisel
  {
    key: 'journal-lonely',
    type: 'journal',
    title: 'Yalnızlık ve odak',
    content:
      'Bu hafta yine lone wolf modundaydım; kimseyle plan yapmadım, sabahtan geceye çalıştım. Yalnızlık bazen ağırlaşıyor ama odak süremi de ciddi artırıyor. Dengeyi nasıl kuracağımı hâlâ bilmiyorum.',
    daysAgo: 6,
  },
  {
    key: 'journal-family',
    type: 'journal',
    title: 'Aile yemeği',
    content:
      'Akşam ailemle uzun bir yemek yedik. Annem yurtdışı planlarımı sordu; anlatınca hem gurur hem endişe gördüm yüzünde. Gitmek istediğimden hiç şüphem yok ama onları özleyeceğimi de biliyorum.',
    daysAgo: 30,
  },

  // Tema: Okuma
  {
    key: 'note-atomic-habits',
    type: 'note',
    title: 'Atomic Habits — identity-based habits',
    content:
      'Key idea from the book: every action is a vote for the type of person you wish to become. Do not aim to run a marathon; aim to become a runner. Habit stacking and two-minute rule are the practical tools.',
    daysAgo: 40,
  },
]

// ── Linkler ──────────────────────────────────────────────────────────────────
// Vizyon belgeleri birbirinin devamı niteliğinde — elle kurulmuş (kind:'user')
// kanonik bağlar. Tematik linkler journal→goal deseninin gerçek örnekleri.

export const FIXTURE_LINKS: FixtureLink[] = [
  // Vizyon belgeleri arası
  { source: 'vision-01', target: 'vision-02', kind: 'user', label: 'vizyonu genişletir' },
  { source: 'vision-01', target: 'vision-03', kind: 'user', label: 'ilkelerin kaynağı' },
  { source: 'vision-03', target: 'vision-04', kind: 'user', label: 'uygulama talimatı' },
  { source: 'vision-01', target: 'vision-04', kind: 'user', label: 'kurucu talimatın bağlamı' },

  // IELTS teması
  { source: 'journal-ielts-reading', target: 'goal-ielts', kind: 'user', label: 'hedefe katkı' },
  { source: 'journal-ielts-speaking', target: 'goal-ielts', kind: 'user', label: 'hedefe katkı' },
  { source: 'note-vocab', target: 'goal-ielts', kind: 'user', label: 'çalışma materyali' },
  { source: 'goal-ielts', target: 'goal-scholarship', kind: 'user', label: 'önkoşul' },

  // Burs teması
  { source: 'note-deadlines', target: 'goal-scholarship', kind: 'user', label: 'takvim' },
  { source: 'journal-essay', target: 'goal-scholarship', kind: 'user', label: 'hedefe katkı' },
  { source: 'essay-draft', target: 'goal-scholarship', kind: 'user', label: 'başvuru belgesi' },

  // Spor teması
  { source: 'journal-gym', target: 'goal-fitness', kind: 'user', label: 'hedefe katkı' },
  { source: 'journal-run', target: 'goal-fitness', kind: 'user', label: 'hedefe katkı' },
  { source: 'note-atomic-habits', target: 'goal-fitness', kind: 'user', label: 'alışkanlık teorisi' },

  // Reborn teması
  { source: 'journal-reborn-dev', target: 'project-reborn', kind: 'user', label: 'geliştirme günlüğü' },
  { source: 'note-sanchez', target: 'project-reborn', kind: 'user', label: 'karakter tasarımı' },
  { source: 'project-reborn', target: 'vision-01', kind: 'user', label: 'vizyon belgesi' },
  { source: 'project-reborn', target: 'goal-scholarship', kind: 'user', label: 'portfolyo projesi' },
]

// ── Dolgu üreteci (deterministik) ────────────────────────────────────────────

interface FillerTopic {
  key: string
  type: EntityType
  variants: Array<{ title: string; content: string }>
}

const FILLER_TOPICS: FillerTopic[] = [
  {
    key: 'yemek',
    type: 'journal',
    variants: [
      { title: 'Akşam yemeği denemesi', content: 'Bu akşam ilk kez fırında sebzeli makarna yaptım. Peyniri fazla kaçırmışım ama genel olarak fena olmadı.' },
      { title: 'Kahvaltı keyfi', content: 'Sabah menemen yaptım, yanına demli çay. Hafta sonu kahvaltıları günün en sakin anı.' },
      { title: 'Yeni tarif: mercimek köftesi', content: 'İnternetten bakarak mercimek köftesi denedim. Bulguru az koymuşum, biraz dağıldı ama tadı yerindeydi.' },
      { title: 'Dışarıda yemek', content: 'Arkadaşımla çiğ köfteciye gittik. Acısı gözümü yaşarttı, yine de bitirdim.' },
    ],
  },
  {
    key: 'hava',
    type: 'note',
    variants: [
      { title: 'Yağmurlu gün', content: 'Bütün gün yağmur yağdı, şemsiyesiz çıktığıma pişman oldum. Islanınca eve dönüp üstümü değiştirdim.' },
      { title: 'Lodos', content: 'İstanbul’da lodos var, vapur seferleri iptal olmuş. Pencereler bütün gece takırdadı.' },
      { title: 'İlk kar', content: 'Bu sabah yılın ilk karı yağdı. Sokaktaki çocuklar kartopu oynuyordu, bir süre izledim.' },
      { title: 'Sıcak dalgası', content: 'Hava bugün bunaltıcı sıcaktı. Klimasız evde durmak imkansız, kütüphaneye kaçtım.' },
    ],
  },
  {
    key: 'trafik',
    type: 'journal',
    variants: [
      { title: 'Trafik çilesi', content: 'Köprü trafiğinde bir buçuk saat kaldım. Otobüste podcast dinleyerek oyalandım.' },
      { title: 'Metro arızası', content: 'Metro seferleri arıza yüzünden gecikti. Peronda yarım saat bekledik, herkes gergindi.' },
      { title: 'Gece yolculuğu', content: 'Gece yarısı boş yollarda eve dönmek gündüz trafiğinden sonra terapi gibi geldi.' },
      { title: 'Dolmuş sohbeti', content: 'Dolmuşta yaşlı bir amca gençliğindeki İstanbul’u anlattı. Yol kısa geldi.' },
    ],
  },
  {
    key: 'film',
    type: 'note',
    variants: [
      { title: 'Film gecesi', content: 'Akşam eski bir bilim kurgu filmi izledim. Efektler eskimiş ama hikaye hâlâ sağlam.' },
      { title: 'Sinema dönüşü', content: 'Sinemada yeni çıkan animasyon filmini izledik. Beklediğimden çok daha duygusaldı.' },
      { title: 'Belgesel notu', content: 'Derin deniz canlıları belgeseli izledim. Fener balığının avlanma şekli inanılmaz.' },
      { title: 'Kısa film keşfi', content: 'İnternette ödüllü bir kısa film buldum. On dakikada koca bir hayat anlatmışlar.' },
    ],
  },
  {
    key: 'dizi',
    type: 'note',
    variants: [
      { title: 'Dizi maratonu', content: 'Hafta sonu bir dizinin ilk sezonunu bitirdim. Son bölümdeki ters köşeyi hiç beklemiyordum.' },
      { title: 'Dizi önerisi', content: 'Arkadaşımın önerdiği polisiye diziye başladım. İlk bölüm yavaştı ama ikincide açıldı.' },
      { title: 'Final hayal kırıklığı', content: 'Yıllardır izlediğim dizinin finali beni tatmin etmedi. Karakterlerin sonu aceleye gelmiş.' },
      { title: 'Tekrar izleme', content: 'Eski bir komedi dizisini baştan izliyorum. Replikleri ezbere bilmeme rağmen hâlâ gülüyorum.' },
    ],
  },
  {
    key: 'kahve',
    type: 'journal',
    variants: [
      { title: 'Kahve denemesi', content: 'Yeni aldığım filtre kahveyi denedim. Öğütülmüşü biraz ince olmuş, ikinci demleme daha iyi çıktı.' },
      { title: 'Kafede çalışma', content: 'Mahalledeki kafede birkaç saat oturdum. Fon gürültüsü tuhaf şekilde konsantrasyonumu artırıyor.' },
      { title: 'Türk kahvesi', content: 'Babaannem telvesiz Türk kahvesi olmaz diyor. Bugün onun yöntemiyle pişirdim, haklıymış.' },
      { title: 'Kahve molası', content: 'Öğleden sonra kahve molasında balkonda oturdum. On dakikalık duraklama bütün günü toparladı.' },
    ],
  },
  {
    key: 'temizlik',
    type: 'journal',
    variants: [
      { title: 'Oda düzenleme', content: 'Bugün odamı baştan aşağı topladım. Masanın üstü boşalınca kafam da boşalmış gibi hissettim.' },
      { title: 'Dolap temizliği', content: 'Giymediğim kıyafetleri ayırdım, iki torba bağışa gidecek. Dolap nefes aldı.' },
      { title: 'Cam silme günü', content: 'Camları sildim, perdeleri yıkadım. Eve giren ışık bile değişti sanki.' },
      { title: 'Mutfak nöbeti', content: 'Mutfakta biriken bulaşıkları bitirip tezgahı sildim. Küçük iş, büyük rahatlama.' },
    ],
  },
  {
    key: 'bitki',
    type: 'note',
    variants: [
      { title: 'Sukulent bakımı', content: 'Sukulentlerin toprağını değiştirdim. Birinin yaprakları buruşmuş, az su vermişim.' },
      { title: 'Yeni bitki', content: 'Eve bir paşa kılıcı aldım. Az bakım istiyormuş, benim gibi unutkanlara birebir.' },
      { title: 'Fesleğen serüveni', content: 'Balkondaki fesleğen nihayet büyüdü. Akşam makarnanın üstüne ilk hasadı yaptım.' },
      { title: 'Yaprak sararması', content: 'Devetabanının yaprakları sararıyor. Araştırdım, fazla sudan olabilirmiş.' },
    ],
  },
  {
    key: 'komsu',
    type: 'journal',
    variants: [
      { title: 'Komşu ziyareti', content: 'Alt kattaki teyze börek getirdi. Karşılığında annemin yaptığı reçelden verdim.' },
      { title: 'Apartman toplantısı', content: 'Apartman toplantısında asansör tamiri konuşuldu. İki saat sürdü, karar yine çıkmadı.' },
      { title: 'Gürültü sorunu', content: 'Üst kattaki dairede tadilat başladı. Sabah dokuzdan akşama kadar matkap sesi.' },
      { title: 'Kapıda sohbet', content: 'Kapı önünde komşuyla on dakika ayaküstü konuştuk. Mahalleli olmak böyle bir şey.' },
    ],
  },
  {
    key: 'telefon',
    type: 'note',
    variants: [
      { title: 'Telefon tamiri', content: 'Telefonun ekranı çatlamıştı, nihayet değiştirttim. Cam koruyucu da taktırdım bu sefer.' },
      { title: 'Pil sorunu', content: 'Telefonun şarjı öğleni görmeden bitiyor. Pil sağlığı yüzde yetmişe düşmüş.' },
      { title: 'Yeni kılıf', content: 'Telefona darbeye dayanıklı bir kılıf aldım. Görünüşü hantal ama içim rahat.' },
      { title: 'Depolama temizliği', content: 'Telefonda yer kalmamıştı. Eski videoları bilgisayara aktarıp yirmi gigabayt açtım.' },
    ],
  },
  {
    key: 'banka',
    type: 'note',
    variants: [
      { title: 'Banka işlemleri', content: 'Bankada sıra numarası alıp kırk dakika bekledim. İşlem beş dakika sürdü.' },
      { title: 'Kart yenileme', content: 'Bankamatik kartımın süresi dolmuş. Yenisi bir hafta içinde adrese gelecekmiş.' },
      { title: 'Otomatik ödeme', content: 'Faturaları otomatik ödemeye bağladım. Her ay son gün telaşı bitti.' },
      { title: 'Hesap özeti', content: 'Aylık hesap özetine baktım. Küçük harcamalar toplanınca ciddi bir rakam olmuş.' },
    ],
  },
  {
    key: 'ulasim',
    type: 'journal',
    variants: [
      { title: 'Vapur keyfi', content: 'Karşıya vapurla geçtim. Martılara simit atan çocukları izlemek iyi geldi.' },
      { title: 'Bisiklet turu', content: 'Sahil yolunda bisiklet sürdüm. Bacaklarım ağrıdı ama manzara değdi.' },
      { title: 'Yürüyerek dönüş', content: 'Otobüse binmek yerine eve yürüdüm. Kırk beş dakikalık yol düşünmek için ideal.' },
      { title: 'Taksi macerası', content: 'Taksici yolu yanlış bildiğim için beni de yanlış götürdü. Navigasyona bakmamak iddiaymış.' },
    ],
  },
  {
    key: 'kedi',
    type: 'journal',
    variants: [
      { title: 'Sokak kedisi', content: 'Kapının önündeki sarman yine mama bekliyordu. Artık sabah rutinimizin parçası oldu.' },
      { title: 'Kedi ziyareti', content: 'Arkadaşımın kedisi kucağımdan hiç inmedi. Kazağım tüy içinde kaldı, değdi ama.' },
      { title: 'Veteriner günü', content: 'Mahallenin kedisini veterinere götürdük. Aşıları yapıldı, kulağı işaretlendi.' },
      { title: 'Kedi evi', content: 'Kartondan sokak kedileri için küçük bir barınak yaptım. İçine eski bir battaniye koydum.' },
    ],
  },
  {
    key: 'roman',
    type: 'note',
    variants: [
      { title: 'Roman bitti', content: 'Uzun zamandır elimde sürünen romanı nihayet bitirdim. Son elli sayfa bir solukta gitti.' },
      { title: 'Sahaf keşfi', content: 'Sahafta eski baskı bir roman buldum. Sayfalarındaki eski sahibinin notları ayrı hikaye.' },
      { title: 'Gece okuması', content: 'Bir bölüm deyip başladım, saat üçte hâlâ okuyordum. Uykusuzluğa değen kitaplardan.' },
      { title: 'Kitap kulübü', content: 'Kitap kulübünün bu ayki romanı hakkında tartıştık. Herkes farklı bir sonu savundu.' },
    ],
  },
  {
    key: 'gitar',
    type: 'journal',
    variants: [
      { title: 'Gitar pratiği', content: 'Akşam yarım saat gitar çaldım. Barre akorları hâlâ zorluyor ama F artık temiz çıkıyor.' },
      { title: 'Yeni şarkı', content: 'Sevdiğim bir şarkının akorlarını çıkardım. Nakarat kısmındaki geçiş parmaklarımı düğümlüyor.' },
      { title: 'Tel değişimi', content: 'Gitarın tellerini değiştirdim. Yeni tellerin sesi bambaşka, çalması bile keyifli.' },
      { title: 'Metronomla çalışma', content: 'Metronomla ritim çalıştım. Yavaş tempoda temiz çalmak hızlı çalmaktan zormuş.' },
    ],
  },
  {
    key: 'fotograf',
    type: 'note',
    variants: [
      { title: 'Sokak fotoğrafçılığı', content: 'Eski mahallelerde fotoğraf çektim. En iyi kare, camdan sarkan bir teyzenin gülümsemesi.' },
      { title: 'Gün batımı karesi', content: 'Sahilde gün batımını çektim. Telefon kamerası o turuncuyu bir türlü tam veremiyor.' },
      { title: 'Arşiv düzenleme', content: 'Yıllardır biriken fotoğrafları klasörlere ayırdım. Unuttuğum anılar tek tek geri geldi.' },
      { title: 'Makro deneme', content: 'Yağmur damlalarının makro çekimini denedim. Odak tutturmak sabır işi.' },
    ],
  },
  {
    key: 'uyku',
    type: 'journal',
    variants: [
      { title: 'Uyku düzeni', content: 'Gece ikiden önce yatamıyorum bir türlü. Sabahları da kalkmak işkence oluyor.' },
      { title: 'Erken kalkma denemesi', content: 'Bugün alarmla altı buçukta kalktım. Öğleden sonra uyuklamamak için direndim.' },
      { title: 'Rüya notu', content: 'Çok garip bir rüya gördüm: eski evimizde bilmediğim bir oda buluyordum. Uyanınca tuhaf bir his kaldı.' },
      { title: 'Öğle uykusu', content: 'Yirmi dakikalık öğle uykusu bütün günü kurtardı. Fazlası sersemletiyor, azı yetmiyor.' },
    ],
  },
  {
    key: 'market',
    type: 'note',
    variants: [
      { title: 'Market alışverişi', content: 'Haftalık market alışverişini yaptım. Listeye sadık kalınca hem hızlı hem ucuz bitti.' },
      { title: 'Pazar sabahı', content: 'Semt pazarından domates ve yeşillik aldım. Pazarcıyla fiyat pazarlığı geleneği bozulmadı.' },
      { title: 'Unutulan malzeme', content: 'Markete gidip asıl alacağım şeyi almadan döndüm. Liste yazmadan çıkmak böyle bitiyor.' },
      { title: 'İndirim avı', content: 'Marketin indirim reyonundan makul fiyata zeytinyağı buldum. Stok yaptım.' },
    ],
  },
  {
    key: 'resim',
    type: 'journal',
    variants: [
      { title: 'Suluboya denemesi', content: 'İlk kez suluboya denedim. Kağıt buruştu, renkler birbirine karıştı ama süreç çok dinlendirici.' },
      { title: 'Karakalem çalışması', content: 'Akşam karakalemle el çizimi çalıştım. Parmaklar hâlâ sosis gibi görünüyor.' },
      { title: 'Boyama kitabı', content: 'Kafa dağıtmak için boyama kitabı aldım. Çocukça gelmişti, meğer meditasyon gibiymiş.' },
      { title: 'Sergi ziyareti', content: 'Modern sanat sergisine gittim. Bazı eserleri anlamadım ama renk kullanımları etkileyiciydi.' },
    ],
  },
  {
    key: 'muzik',
    type: 'note',
    variants: [
      { title: 'Yeni albüm', content: 'Sevdiğim grubun yeni albümü çıktı. İlk dinleyişte üç şarkı hemen listeme girdi.' },
      { title: 'Konser anısı', content: 'Açık hava konserine gittik. Bis faslında herkes telefon ışıklarını salladı.' },
      { title: 'Çalma listesi', content: 'Odaklanma çalma listemi yeniledim. Sözsüz parçalar çalışırken daha iyi gidiyor.' },
      { title: 'Plak merakı', content: 'İkinci el bir pikap baktım. Plak toplamak pahalı bir hobiye benziyor, şimdilik vazgeçtim.' },
    ],
  },
  {
    key: 'misafir',
    type: 'journal',
    variants: [
      { title: 'Misafir ağırlama', content: 'Akşam kuzenler geldi. Tavla turnuvası gece yarısına kadar sürdü.' },
      { title: 'Sürpriz ziyaret', content: 'Eski bir arkadaşım habersiz uğradı. İki saat eski günleri andık.' },
      { title: 'Doğum günü hazırlığı', content: 'Kardeşimin doğum günü için evi süsledik. Pastayı saklamak en zor kısımdı.' },
      { title: 'Çay saati', content: 'Teyzemler çaya geldi. Annemin kurabiye tarifini herkes istedi.' },
    ],
  },
]

/** 21 konu × 4 varyant = 84 deterministik dolgu kaydı. */
export function generateFiller(): FixtureItem[] {
  const items: FixtureItem[] = []
  FILLER_TOPICS.forEach((topic, t) => {
    topic.variants.forEach((v, i) => {
      items.push({
        key: `filler-${topic.key}-${i + 1}`,
        type: topic.type,
        title: v.title,
        content: v.content,
        // 1-88 gün arasına deterministik yayılım (recency çeşitliliği için).
        daysAgo: ((t * 17 + i * 23) % 88) + 1,
      })
    })
  })
  return items
}

/** Test beklentileri için: key → başlık. */
export function fixtureTitle(key: string): string {
  const vision = VISION_DOCS.find((d) => d.key === key)
  if (vision) return vision.title
  const item = HANDCRAFTED.find((h) => h.key === key)
  if (item) return item.title
  throw new Error(`fixtureTitle: bilinmeyen key '${key}'`)
}
