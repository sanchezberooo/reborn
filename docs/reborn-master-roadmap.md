# REBORN MASTER ROADMAP

> Yaşayan doküman — **v1.1** (2 Temmuz 2026)
> Tek referans: Reborn'un nihai vizyonu, amacı ve tasarım prensipleri.
> v1.1 değişiklikleri: (1) Mevcut kod tabanı başlangıç noktası — evrim, yeniden yazım değil. (2) API'siz geliştirme stratejisi — üretken AI ertelendi, hafıza altyapısı ertelenmedi.

---

## 0. Roadmap'in Mantığı

Vizyon bir Life Operating System tanımlıyor. Bu sisteme giden yol tek bir mimari karara dayanıyor:

**Reborn'un çekirdeği modüller değil, hafıza katmanıdır.**

Vizyonun her ilkesi ("her şey birbirine bağlı", "tek doğru bilgi kaynağı", "Sanchez bütün sistemi anlar", "yıllar geçtikçe güçlenen AI") tek bir teknik temele iner: tüm yaşam verisinin tek, bağlantılı, sorgulanabilir bir modelde durması ve Sanchez'in bunun üzerinde akıl yürütmesi. Bu temel doğru kurulursa her yeni modül ucuz ve hızlı eklenir. Yanlış kurulursa Reborn "birbirinden kopuk modüller" olur — vizyonun açıkça yasakladığı şey.

Fazlar: **analiz → veri ve hafıza altyapısı → yaşam verisi → yüzey → ajan altyapısı → AI aktivasyonu → güven ve yayın.**

---

## 1. Kalıcı Teknik Kararlar

**Stack**
- **Next.js 16 (App Router) + TypeScript** — tek codebase. (Mevcut kod farklı bir stack'teyse Faz 0 denetimi geçiş/koruma kararını verir.)
- **Supabase (PostgreSQL + pgvector + Auth + Storage)** — tek doğru bilgi kaynağı altyapısı.
- **Tailwind + shadcn/ui** — sadelik ilkesi; özel tasarım kimliği Faz 3'te.

**AI Katmanı Mimarisi (v1.1'in kalbi)**

AI katmanı iki bağımsız parçaya ayrılır ve tamamı `AIProvider` soyutlaması arkasındadır:

| Parça | Ne yapar | Maliyet | Durum |
|---|---|---|---|
| **Embedding & Retrieval** | Semantik arama, hafıza grafı, bağlantı keşfi | Lokal, ücretsiz (bge-m3 vb. çok dilli açık model) | **Ertelenemez** — hafıza mimarisi bununla inşa edilir |
| **Üretken (Generative)** | Sanchez'in konuşması, memory write çıkarımları, ajan davranışları | Anthropic API | **Ertelendi** — MockProvider ile geliştirilir, bakiye gelince config'le aktive edilir |

- `AIProvider` interface: `complete()`, `stream()`, `embed()`. Implementasyonlar: `AnthropicProvider`, `LocalEmbeddingProvider`, `MockProvider`.
- **MockProvider:** Deterministik senaryo fixture'ları (tanışma sohbeti, hedef konuşması, hafıza çağrısı, hata durumu). Streaming, onay akışı, hata toleransı dahil tüm UI/pipeline uçtan uca API'siz test edilir.
- Bu soyutlama aynı zamanda vizyonun 18. ilkesinin ("yeni modeller çıktıkça uyum sağlar, model-agnostik") doğrudan uygulamasıdır — geçici bir çözüm değil, kalıcı mimari.

**Mimari İlkeler (koda çevrilen vizyon)**
1. **Unified Entity Model:** Journal, hedef, not, proje, kişi, görev — hepsi tek `entities` çekirdeğinden türer; embedding'i ve `links`'i vardır. "Her şey birbirine bağlı" ilkesi şemanın kendisidir.
2. **Memory Pipeline:** Retrieval = semantik arama + graf komşuluğu + zaman ağırlığı. Her mesajda her şey değil, ilgili olan yüklenir (hız + maliyet). Memory write üretken katmana bağlıdır → arayüzü şimdi, gerçek davranışı AI aktivasyonunda.
3. **Tek Muhatap:** Kullanıcıya dönük tek arayüz Sanchez. Agent Office yalnızca izleme penceresi.
4. **Kontrol Kullanıcıda:** Kalıcı işlemler öneri + kullanıcı onayıyla uygulanır.
5. **Şeffaflık:** Her önemli çıkarım "neden"iyle kaydedilir ve gösterilebilir.

---

## 2. Fazlar

Süreler tempo referansıdır; asıl kapı başarı kriterleridir.

---

### FAZ 0 — Analiz ve Evrim Planı (1 hafta)

**Amaç:** Mevcut Reborn kod tabanını nihai vizyona evrimleştirecek planı çıkarmak. Sıfırdan proje YOK; yeniden yazım yalnızca denetimin kanıtladığı yerlerde.

**Kapsam:**
- **Kod denetimi:** Mevcut sistemin tam haritası — mimari, veri modeli, bağımlılıklar, AI entegrasyonu, teknik borç.
- **Koru / Refactor / Yeniden Yaz matrisi:** Her ana parça için karar + gerekçe + tahmini efor. Karar filtresi: "Bu parça Unified Entity Model ve AIProvider mimarisine evrimleşebilir mi, yoksa direnir mi?"
- **CLAUDE.md:** Vizyon özeti, mimari ilkeler, kod standartları, mevcut yapının haritası, evrim kararları — Claude Code'un anayasası.
- **AIProvider soyutlaması:** Mevcut Anthropic çağrılarının interface arkasına alınması + MockProvider v1. (Bu, mevcut koda yapılacak ilk cerrahi müdahale — küçük, güvenli, her şeyin önkoşulu.)
- Test altyapısı (Vitest) + git disiplini + migration sistemi kurulumu.

**Çıktı:** Denetim raporu + evrim planı + CLAUDE.md + mevcut uygulamanın MockProvider ile API'siz çalışır hali.

**Başarı Kriterleri:**
- Mevcut kodun her ana modülü için yazılı koru/refactor/yeniden-yaz kararı var.
- Uygulama API anahtarı ve bakiye olmadan ayağa kalkıyor; sohbet ekranı MockProvider ile akıyor.
- CLAUDE.md'yi okuyan yeni bir Claude Code oturumu, ek açıklamasız doğru yapıda kod üretebiliyor.

---

### FAZ 1 — Veri Çekirdeği ve Hafıza Altyapısı (3 hafta)

**Amaç:** Reborn'un asıl ürünü olan hafıza mimarisini inşa etmek ve **API'siz, gerçek verilerle test etmek**.

**Kapsam:**
- **Şema:** `entities`, `links`, `messages`, `memories` + pgvector; mevcut verinin bu modele migration'ı.
- **Lokal embedding pipeline:** Çok dilli açık model (bge-m3 veya eşdeğeri — Türkçe kritik) ile her entity/memory'nin embedding'i. Tamamen ücretsiz, tamamen test edilebilir.
- **Hibrit retrieval:** Semantik arama + link grafı + recency ağırlığı. Fixture veri setiyle (örnek journal'lar, hedefler, notlar) ölçülebilir testler.
- **Memory write arayüzü:** Konuşma → yapılandırılmış hafıza pipeline'ının iskeleti; üretken kısmı MockProvider senaryolarıyla simüle edilir, gerçek çıkarım AI Aktivasyon fazında devreye girer.
- **Hafıza görünürlüğü:** Kullanıcı sistemin ne bildiğini görür, düzeltir, siler (güven ilkesi — ilk günden).

**Çıktı:** İçine gerçek veri konulduğunda ilgili bilgiyi semantik olarak bulup bağlantılarıyla getiren, ölçülmüş bir hafıza motoru.

**Başarı Kriterleri:**
- 100+ öğelik fixture setinde retrieval testleri: ilgili sorguda doğru hafızalar ilk 5 sonuçta (ölçülür, log'lanır).
- Türkçe içerikte semantik arama doğru çalışıyor (Türkçe test seti ile doğrulanır).
- İki ilişkili entity (ör. journal→goal) link grafı üzerinden retrieval'a birlikte geliyor.
- Silinen hafıza retrieval'a bir daha çıkmıyor.
- Retrieval gecikmesi < 500ms.

---

### FAZ 2 — Yaşam Verisi: Journal, Goals ve Modül Çerçevesi (3 hafta)

**Amaç:** Hafızaya beslenecek gerçek yaşam verisini toplayan modülleri, API'siz tam çalışır halde inşa etmek.

**Kapsam:**
- **Journal modülü:** Serbest yazım; girdiler entity'dir, embedding'lenir, linklenebilir.
- **Goal sistemi:** "Olmak istediğin kişi" → hedefler → alt hedefler → ölçülebilir ilerleme. Dönüşümün ölçüm birimi.
- **Modül çerçevesi v1:** Aç/kapat altyapısı; Journal ve Goals bu çerçevenin ilk iki modülü olarak yazılır, hard-coded değil.
- **Import v1 — Obsidian vault senkronu:** kullanıcının kasası (path env'den) okunur, dosyalar entity+embedding olarak işlenir, [[link]]'ler links grafına çevrilir; dosya değişiminde yeniden işlenir.
- **İlk sohbet (onboarding) akışı:** MockProvider senaryosuyla uçtan uca kurulur; gerçek Sanchez kişiliği AI Aktivasyonda bağlanır.

**Çıktı:** Günlük tutulan, hedef takip eden, verisi hafıza motoruna akan, tamamen API'siz çalışan Life OS çekirdeği.

**Başarı Kriterleri:**
- Journal'a yazılan bir tema, global semantik aramada ve ilgili hedefin bağlam panelinde kendiliğinden görünüyor.
- Bir modül kapatıldığında UI'dan kayboluyor, verisi korunuyor.
- Import edilen eski bir metin aranabilir ve linklenebilir hale geliyor.
- Onboarding akışı mock senaryoyla baştan sona tıklanabiliyor.

---

### FAZ 3 — Yüzey: Dashboard, Bloklar ve Bilgi Grafiği (2,5 hafta)

**Amaç:** Sistemin gücünü görünür kılmak — sadelik ilkesini bozmadan. Bu fazın tamamı API'sizdir.

**Kapsam:**
- **Modüler dashboard:** Taşınabilir blok sistemi (goal ilerlemesi, journal akışı, istatistikler, "Sanchez'in gündemi" bloğu — mock içerikle).
- **Bilgi grafiği görünümü (ilke 13):** Entity'ler ve linkler görsel graf; düğüme tıkla → içeriğe git.
- **Global semantik arama** (Faz 1 motorunun UI'ı).
- **Tasarım sistemi:** Reborn'a özgü görsel kimlik — "template gibi görünen ürün" tuzağından çıkış. Portfolyo için kritik.

**Çıktı:** İlk bakışta sade, keşfedildikçe derinleşen; kullanıcının zihin haritasını gösteren arayüz.

**Başarı Kriterleri:**
- Bloklar sürükle-bırak ile düzenlenebiliyor, tercih kalıcı.
- Grafta journal→goal→project zinciri tıklanarak gezilebiliyor.
- Ana ekran etkileşimleri < 200ms.
- Dış gözle test: ürünü ilk kez gören biri 2 dakikada ne işe yaradığını söyleyebiliyor.

---

### FAZ 4 — Agent Office Altyapısı (2,5 hafta)

**Amaç:** Çok ajanlı orkestrasyonun tüm altyapısını — kuyruk, durum makinesi, izleme paneli — üretken AI olmadan inşa etmek.

**Kapsam:**
- **Job queue + orchestration çekirdeği:** Görev → alt görevlere dağıtım → durum takibi → sonuç birleştirme. Ajan davranışları MockProvider senaryolarıyla (sahte araştırma adımları, sahte raporlar) simüle edilir.
- **Agent Office paneli:** Hangi ajan ne üzerinde, hangi adımda, ne buldu — canlı izleme. Opsiyonel giriş (ilke 2).
- **Workflow v1:** Kaydedilebilir, tekrar çalıştırılabilir görev zincirleri.
- Hata toleransı: ajan hatası kullanıcıya Sanchez'in dilinde iletilir, teknik döküm olarak değil.

**Çıktı:** Mock ajanlarla uçtan uca izlenebilen, gerçek ajan davranışının "takılacağı" hazır orkestrasyon iskeleti.

**Başarı Kriterleri:**
- Çok adımlı mock görev (araştır → analiz → raporla) kuyrukta uçtan uca akıyor, panelde gerçek zamanlı izleniyor.
- Bir workflow kaydedilip ikinci kez farklı girdiyle çalıştırılabiliyor.
- Bir ajan bilerek düşürüldüğünde sistem toparlanıyor, kullanıcıya anlaşılır mesaj gidiyor.

---

### FAZ AI — Aktivasyon: Sanchez Canlanıyor (2-3 hafta, bakiye geldiğinde)

**Amaç:** Hazır altyapıya gerçek zekayı bağlamak. Bu faz bakiye gelir gelmez başlar; öncesindeki hiçbir fazı bloklamaz.

**Kapsam:**
- **Sanchez karakter sistemi:** Mentor kimliği tek system prompt dosyasında; "cevap yerine soru sorar", "varsayımları sorgular", "dayatmaz" ilkeleri burada kodlanır ve gerçek konuşmalarla kalibre edilir.
- **Memory write gerçek davranışı:** Konuşmalardan çıkarım (gerçek/tercih/hedef/örüntü, kaynak referanslı) + haftalık consolidation.
- **Onboarding'in gerçek hali:** Tanışma sohbeti canlı Sanchez ile.
- **Gerçek ajanlar (2-3):** Araştırma ajanı (web search), üretim ajanı (web tasarım workflow'un ilk gerçek şablon vakası), analiz ajanı ("beni analiz et" — vizyonun nihai vaadi).
- **Maliyet koruması:** Mesaj başına bağlam bütçesi, kullanıcı başına limit, maliyet log'u.

**Çıktı:** Hatırlayan, bağlantı kuran, soru soran, arka planda ajan çalıştıran gerçek Sanchez.

**Başarı Kriterleri:**
- **Soğuk hatırlama testi:** 1. gün anlatılan bilgi, 5 oturum sonra ilgili soruda kendiliğinden doğru kullanılıyor.
- **Bağlantı testi:** İki farklı konuşmadaki ilişkili bilgiler (ör. bir korku + bir hedef) Sanchez tarafından bağlanıyor.
- Çok adımlı gerçek görev tek komutla uçtan uca tamamlanıyor; Agent Office'te izi var.
- Ortalama cevap gecikmesi < 5 sn; mesaj başına bağlam retrieval çıktısıyla sınırlı (log'la doğrulanır).

---

### FAZ 5 — Güven, Yayın ve Portfolyo (2 hafta)

**Amaç:** Reborn'u "lokalde çalışan proje"den güvenilir, gösterilebilir ürüne taşımak.

**Kapsam:**
- **Güven altyapısı (ilke 9):** Auth (Supabase), veri şifreleme, tam export, kalıcı silme, otomatik yedekleme.
- **Deploy:** Vercel + Supabase production; hata izleme.
- **Dayanıklılık:** API kesintisinde zarif düşüş — veri asla kaybolmaz, API'siz çalışan her şey (journal, goals, arama, graf) çalışmaya devam eder. (v1.1 mimarisinin doğal armağanı: uygulama zaten API'siz yaşayabiliyor.)
- **Portfolyo paketi:** Canlı demo hesabı, 2-3 dk ürün videosu, mimari doküman (özellikle hafıza katmanı + AIProvider soyutlaması — teknik derinliğin kanıtı), vizyon → ürün hikayesi.
- Gerçek kullanıcı testi: 3-5 kişi bir hafta kullanır.

**Çıktı:** URL'si olan, başkasının kayıt olup kullanabildiği, anlatısı hazır Reborn v1.

**Başarı Kriterleri:**
- Yabancı bir kullanıcı: kayıt → ilk sohbet → ilk hedef → ertesi gün hatırlanma döngüsünü yardımsız tamamlıyor.
- Export arşivi tüm entity ve hafızaları içeriyor; silme sonrası iz kalmıyor (doğrulanır).
- 3+ test kullanıcısından en az biri "Sanchez beni hatırladı" anını kendiliğinden raporluyor.
- Demo videosu + mimari doküman başvuru dosyası kalitesinde.

---

### FAZ 6+ — Vizyon Ufku (v1 sonrası)

Modül genişlemesi (Fitness, Finance, Learning, Career…), MCP client entegrasyonları ("açık ekosistem"in somut hali), topluluk → marketplace, çoklu model desteği (AIProvider zaten hazır), geliştirici API'si, çoklu cihaz. Her faz değerlendirmesinde gözden geçirilir; v1 kapsamına sızmaz.

---

## 3. Geliştirme Döngüsü (her faz boyunca)

1. Ben sıradaki en önemli işi belirler, **eksiksiz Claude Code promptunu** hazırlarım (bağlam + hedef + kabul kriterleri + dosya kapsamı).
2. Sen çalıştırır, çıktıyı gönderirsin.
3. Ben incelerim: vizyon ilkeleri + kod kalitesi + eksikler.
4. Gerekirse düzeltme promptu; değilse **sonraki prompt anında hazır**.
5. Faz sonunda: başarı kriterleri testi → roadmap değerlendirmesi → gerekirse güncelleme (vizyon sabit).

---

## 4. Değişmezler

1. Bu iş temel soruya hizmet ediyor mu? ("Kim olmak istiyorsun ve AI buna nasıl yardım eder?")
2. Tek muhatap Sanchez ilkesini koruyor mu?
3. Veri tek kaynakta ve bağlantılı mı?
4. Kontrol ve güven kullanıcıda mı?
5. Yüzey sade, güç arka planda mı?

Bir özellik bu filtrelerden geçemiyorsa Reborn'da yeri yoktur.
