# REBORN — TAM FAZ PLANI

## FAZ 1 — TEMEL (BİTTİ)
- Next.js + Supabase + Anthropic API kurulumu
- Auth kaldırma, tek kullanıcı
- Veri katmanı (modules / data jsonb)
- Sanchez temel chat (okuma, yazma, hafıza)
- İlk modüller: Günlük, Rutin/Alışkanlık, Finans, Beden iskeleti
- Tasarım sistemi (#0B0F14 / #121821 / #c8a96e / Playfair)

## FAZ 2 — AJAN ALTYAPISI (BİTTİ)
- Ajan iskeleti (registry, runner, executor, types)
- agent_runs + agent_logs tabloları
- Agent Panel (canlı, gerçek veri, run geçmişi, pulse)
- İngilizce ajanları (haftalık planlayıcı, genel plan)
- Sanchez orkestrasyon (run_agent — ajanları kendisi çağırıyor)
- Üç katmanlı mimari: Kullanıcı -> Sanchez -> ajanlar -> araçlar -> DB

## FAZ 3 — BURS ÇEKİRDEĞİ (DEVAM — burs-kritik)
- [x] Burs Akademisi + Keşif/toplu/derinleştirme ajanları
- [x] Takvim modülü (FullCalendar)
- [x] Gramer sekmesi (Kelime Bankası UI + A1 içerik)
- [ ] Gramer ders sayfası (alanlara bölünmüş study board layout)
- [ ] Gramer A2/B1/C1 içeriği
- [ ] Essay yazım sistemi / essay ajanı  <-- en kritik eksik
- [ ] İngilizce planı -> Takvim entegrasyonu (blok->derse ışınlanma)
- [ ] İngilizce modül sadeleştirme

## FAZ 4 — DEMO & DEPLOY (burs-kritik)
- [ ] Proaktif Sanchez (hatırlatma, kendi inisiyatifiyle ulaşma)
- [ ] Obsidian -> Sanchez/Keşif bağlantısı
- [ ] Vercel deploy
- [ ] RLS güvenlik (tüm tablolar — deploy öncesi şart)
- [ ] Bug temizliği, performans, demo cilası

## FAZ 5 — İKİNCİ BEYİN & HAFIZA (burs sonrası)
- [ ] İkinci Beyin / Beyin Haritası modülü:
    - Tükettiğin içerikleri kaydet (kitap, podcast, video, dizi, makale)
    - Her içerik için Sanchez "ne düşündün?" sorar, düşünceni kaydedersin
    - Obsidian notları buraya akar
    - Sanchez bu veriyi okuyup KİŞİSELLEŞTİRİLMİŞ öneri yapar (rastgele değil)
    - "Son 6 ayda ne öğrendim?" gibi AI sorgulama
    - Arşiv: rüyalar, dersler, dönüm noktaları, öğrenmeler
- [ ] Semantik hafıza (embedding, vektör arama)
- [ ] Life Graph (içerikler/fikirler/insanlar arası ilişki ağı)

## FAZ 6 — BLOK SİSTEMİ & MODÜL DERİNLİĞİ (burs sonrası)
- [ ] Serbest yerleşimli canvas dashboard ("her yere oynayan blok")
- [ ] Taşınabilir/düzenlenebilir blok mantığı (cep evren)
- [ ] Sanchez'in blokları oluşturup yönetmesi
- [ ] Journal sistemi (düşünce/duygu/ilerleme)
- [ ] Hedef sistemi (uzun/kısa vadeli, milestone, görev)
- [ ] Habit sistemi derinleştirme (Atomic Habits, streak)
- [ ] Yaşam Dashboard'u (hedef + alışkanlık + ilerleme tek ekran)

## FAZ 7 — AJAN EKOSİSTEMİ (burs sonrası)
- [ ] Career Agent (CV, LinkedIn, mülakat)
- [ ] Health Agent (uyku, beslenme, fitness)
- [ ] Finance Agent (bütçe, tasarruf)
- [ ] Writing Agent (mail, essay, başvuru)
- [ ] Creativity Agent (fikir üretimi)
- [ ] Reflection Agent (günlük analizi)
- [ ] Memory Agent (her şeyi indeksleme)
- [ ] Görünür ofis görünümü (ajanlar çalışırken canlı)

## FAZ 8 — KİMLİK & DÖNÜŞÜM KATMANI (burs sonrası)
- [ ] Kimlik motoru (olmak istediğin vs şimdiki sen)
- [ ] Karar günlüğü (Decision Journal)
- [ ] Kanıt sistemi (sertifika/foto/PDF/video ile ispat)
- [ ] Challenge sistemi (görev zincirleri)
- [ ] Rozet sistemi (sadece Sanchez/Challenge verir, satın alınamaz)
- [ ] Zaman kapsülü (geleceğe mesaj — 1/5/10 yıl)
- [ ] Simulation Mode (senaryo: "bu kararı verirsem 6 ay sonra?")
- [ ] Legacy Vault / Dijital miras

## FAZ 9 — DIŞ KANALLAR & ÇOKLU CİHAZ (burs sonrası)
- [ ] Telegram/WhatsApp (Sanchez'e dışarıdan ulaşma)
- [ ] Push bildirimleri
- [ ] Mobil uygulama + çoklu cihaz senkron
- [ ] Reddit/X derin araştırma (Agent-Reach bağlama)
- [ ] Video/görsel üretim (Higgsfield vb.)

## FAZ 10 — ÜRÜN & TOPLULUK (uzak gelecek)
- [ ] Çoklu kullanıcı + onboarding
- [ ] Konuşarak modül oluşturma (boş açılan, sohbetle kurulan sistem)
- [ ] Topluluk katmanı (gösteriş değil, gelişim/destek odaklı)
- [ ] Reborn TikTok (dönüşüm belgeleme, sosyal kanıt)
- [ ] Ekosistem (Fitness OS, AI dil app bağlantısı)
- [ ] Şirketleşme

---
NOT — Sanchez karakteri (vision.md'ye ait, hatırlatma):
Pohpohlamaz, dürüst, gerektiğinde sert, izinsiz kritik karar vermez,
kullanıcı adına düşünmez (düşündürür), karakter gelişimini takip eder,
uzun vadeyi önceler.
