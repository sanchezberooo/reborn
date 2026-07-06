# REBORN — DURUM RAPORU

> Sadece analiz. Hiçbir dosya değiştirilmedi. Emin olunamayan noktalar "belirsiz" olarak işaretlendi.

---

## 1. GENEL

**Tech stack**
- Next.js 16.2.4 (App Router), React 19.2.4, TypeScript 5
- Tailwind CSS v4
- Supabase (`@supabase/supabase-js` + `@supabase/ssr`) — Postgres + (kullanılmayan) auth altyapısı
- `@anthropic-ai/sdk` (Claude — "Sanchez") ve `openai` SDK (sadece sohbet özetleme için, bkz. §3)
- `@blocknote/*` (Notion tarzı blok editörü), `@fullcalendar/*` (Takvim), `@react-three/fiber` + `@react-three/drei` + `three` (3D "Office" görselleştirmesi)
- `package.json`'da bekleyen bir değişiklik var: `dev` script'i `next dev` → `next dev --webpack` yapılmış (commit edilmemiş, git status'ta görünüyor).

**Klasör yapısı ve görevleri**

| Klasör | Görev | ~LOC (ts/tsx) |
|---|---|---|
| `app/` | Sayfalar (App Router) + `app/api/*` route handler'ları (backend) | ~10.381 |
| `components/` | Paylaşılan UI (chat, sidebar, header, ui/ primitifleri, office/) | ~3.251 |
| `lib/` | Çekirdek mantık: Anthropic/OpenAI client'ları, Supabase client'ları, `db.ts` (tüm CRUD), `modules.ts`, `agents/*` | ~1.742 |
| `hooks/` | Tek dosya, `use-mobile.ts` (19 satır) — neredeyse boş | 19 |
| `supabase/` | Sadece `schema.sql` — **güncel değil**, bkz. §6 madde 1 | — |
| `docs/` | `reborn-vision.md`, `roadmap.md`, `kisisel-arsiv.md` — proje felsefesi, faz planı, Bero'nun kişisel bağlamı | 205 satır |

Toplam TS/TSX: **~15.400 satır** (`node_modules`, `.next` hariç).

**Kök dizinde anomali:** `!lr[i])`, `` `[${m.date}] ``, `0`, `0)`, `{})`, `agent.toolNames.includes(t.name))`, `s.id` gibi 0 byte'lık dosyalar ve `console.log(w` adlı boş, git'e eklenmemiş bir dosya var. Bunlar muhtemelen önceki bir oturumda çok satırlı bir kod parçasının shell tarafından ayrı komutlar/dosya adları olarak yorumlanmasından kalma kalıntılar — kod işlevine etkisi yok, kozmetik temizlik gerektiriyor

---

## 2. MİMARİ

**Frontend**
- Route bazlı sayfalama (`app/<sayfa>/page.tsx`), neredeyse tüm bileşenler `'use client'`.
- Global state yönetimi (Redux/Zustand/Context) **yok**. State component-local `useState`/`useEffect` ile tutuluyor; sayfalar arası senkronizasyon `window.dispatchEvent(new CustomEvent(...))` ile yapılıyor (`reborn:new-chat`, `reborn:modules-updated`, `reborn:conversation-saved`, `reborn:new-memory`, `reborn:load-conversation`).
- `localStorage` sadece aktif konuşma id'sini tutmak için kullanılıyor (`reborn:active-conversation`) — uygulama verisi için kullanılmıyor.
- Navigasyon: `AppShell.tsx` → `Header` + `LayoutBody` + (ana sayfa hariç) `MiniChat` widget'ı her sayfada yüzüyor.

**Backend**
- Next.js Route Handler'ları (`app/api/*/route.ts`) — ayrı bir backend servisi yok, hepsi Next.js içinde.
- Uç noktalar: `chat`, `action`, `summarize`, `setup`, `health`, `agents/list`, `agents/run`, `agents/runs`, `agents/logs`.

**Veri katmanı**
- Tek kaynak: **Supabase Postgres**. Dosya sistemi ya da yerel DB kullanımı yok.
- İki farklı Supabase erişim deseni var:
  1. Tarayıcı tarafı: `lib/supabase.ts` / `lib/db.ts` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` ile.
  2. Sunucu tarafı (API route'ları içinde, her seferinde ayrı ayrı `createClient` çağrısıyla): `process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!` — yani service role key yoksa sessizce anon key'e düşüyor (bkz. §6 madde 2).
- `lib/supabase-server.ts` (`createServerClient` + cookie tabanlı SSR client) tanımlı ama koddaki kullanım noktası bulunamadı — **belirsiz**, muhtemelen ölü kod / ileride auth için hazırlık.

---

## 3. SANCHEZ (Anthropic entegrasyonu)

- **Model:** `lib/anthropic.ts:7` içinde sabit — `'claude-sonnet-4-6'`. Bu ID'nin geçerliliği **belirsiz** (proje içinde doğrulanamadı, varsayım yapılmadı).
- **Streaming:** `app/api/chat/route.ts` bir `ReadableStream` döndürüyor, ancak Anthropic çağrısının kendisi (`anthropic.beta.messages.create`) **streaming değil** — tam yanıt üretilene kadar bekleniyor, sonra `response.content` içindeki metin blokları tek seferde `controller.enqueue` ile gönderiliyor. Yani istemci tarafında "yazıyor" hissi var ama gerçek token-bazlı streaming (`stream: true`) kullanılmıyor. Tool-use döngüsü (araç çağrısı → sonuç → tekrar model çağrısı) `while(true)` ile senkron yürüyor; her tur kullanıcı için ek bekleme demek.
- **Hata yönetimi:** Tüm akış tek bir `try/catch` içinde; hata olursa jenerik "Bir hata oluştu. Tekrar dene." metni stream'e yazılıp `console.error` ile loglanıyor. Tool bazlı hatalar ayrı yakalanıp `is_error: true` ile modele geri veriliyor. Retry, rate-limit ele alma veya timeout mantığı **yok**.
- **System prompt konumu:** `lib/openai.ts` — dosya adı yanıltıcı, aslında Claude/Sanchez'in sistem promptunu üreten `buildSystemPrompt()` burada (muhtemelen proje OpenAI ile başlayıp Anthropic'e geçmiş, dosya adı güncellenmemiş). İçerik: `SANCHEZ_BASE` sabiti — Türkçe, karakter tanımı ("pohpohlamaz", "chatbot değil, ortaklık"), araç kullanım kuralları, hafıza kaydetme kuralı, ajan orkestrasyon talimatları (`run_agent` ne zaman çağrılır) + dinamik olarak enjekte edilen profil/hafıza/önceki-konuşma/aktif-modül bölümleri + statik modül şema referansı (`MODULE_SCHEMAS`).
- **Hafıza / konuşma geçmişi:**
  - `memories` tablosu — uzun vadeli önemli bilgiler (`save_memory` tool'u veya "yeni sohbet" başlatılırken otomatik özetleme ile, `/api/summarize` → OpenAI `gpt-4o-mini` kullanıyor; OpenAI key yoksa ilk kullanıcı mesajını özet olarak kullanan bir fallback var).
  - `conversations` tablosu — tüm mesaj geçmişi, client-üretimli `sessionId` (UUID) altında JSON olarak saklanıyor; yeni sohbete geçince son konuşmanın son 8 mesajı "bağlam" olarak sisteme veriliyor.
  - Semantik/embedding tabanlı hafıza **yok** (roadmap'te Faz 5'te planlanmış, henüz başlanmamış).
  - **Önemli tutarsızlık:** Ana sayfadaki `ChatInterface.tsx` konuşmaları kaydedip özetleyip hafızaya yazarken, her sayfada yüzen `MiniChat.tsx` aynı `/api/chat` uç noktasını çağırıyor ama **hiçbir kaydı yok** — konuşma persist edilmiyor, hafızaya yazılmıyor. Aynı "Sanchez" iki farklı hafıza garantisiyle konuşuyor.
- **API key güvenliği:** Hardcoded değil — `.env.local` üzerinden (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BERO_ID`), `.gitignore`'da `.env*` hariç tutulmuş — bu doğru. **Ancak** `.env.local`'da `SUPABASE_SERVICE_ROLE_KEY` **tanımlı değil**; koddaki `?? ANON_KEY` fallback deseni bunu sessizce anon key'e indirgiyor (etkisi için bkz. §6 madde 2).

---

## 4. MEVCUT ÖZELLİKLER

**Gelişmiş / çalışır durumda**
- **Sanchez ana chat** (`/`, `ChatInterface.tsx`) — tool-calling, web search, konuşma kaydı, otomatik hafıza özeti.
- **Agent Panel** (`/agent-panel`, ~1340 satır) — 3 sekme:
  - *Live Agents* ve *Runner*: **gerçek**, `agent_runs`/`agent_logs` tablolarına bağlı, registry'den okuyor, canlı durum takibi (5 sn polling), log detay görünümü. Kullanıcının istediği "agent panel" konseptine en yakın, zaten çalışan parça.
  - *Office*: **tamamen sahte veri** — `GROUPS` sabiti içinde hardcoded 15 "ajan" (Sanchez/Ticaret/Otomasyon/Sosyal Medya grupları), hiçbir gerçek agent çalıştırmıyor, hiçbir DB'ye bağlı değil. Üstelik bu ajanlar (fiyat takibi, WhatsApp botu, sosyal medya vb.) Reborn'un asıl alanıyla (IELTS/burs) hiç örtüşmüyor — muhtemelen bir e-ticaret şablonundan kopyalanmış placeholder.
- **Ajan sistemi** (`lib/agents/*`) — 6 tanımlı persona (`ingilizce-planlayici`, `ingilizce-genel-plan`, `kesif-arastirmaci`, `burs-toplu-arastirma`, `burs-derinlestir`, `test-agent`). Her biri tek seferlik Claude çağrısı yapıp JSON-only çıktı üretiyor, sonucu `agent_runs`'a yazıyor. Hem UI'dan (Runner tab) hem Sanchez'in kendisinden (`run_agent` tool) tetiklenebiliyor.
- **İngilizce modülü** (`/ingilizce`) — grammar/vocabulary/reading/listening/speaking/writing/quiz/plan/idioms alt modülleri; grammar için ayrıca tam sayfa ders board'u (`/ingilizce/gramer/[topic]`).
- **Burs Akademisi** (`/burs-akademisi`, 627 satır) — burs araştırma ajanlarına bağlı UI.
- **Takvim** (`/takvim`, 448 satır) — FullCalendar.
- **Günlük** (`/gunluk`, 458 satır), **Alışkanlık** (`/aliskanlik`, 586 satır) — `journal_entries`/`habits`/`habit_logs` tablolarına bağlı (bu tablolar schema.sql'de yok, bkz. §6).
- **Dashboard** (`/dashboard` + `/dashboard/[id]`) — modül kartları, `modules` jsonb tablosu üzerinden.
- **Roadmap** (`/roadmap`, 410 satır) — milestone UI.
- **Notion** (`/notion`) — BlockNote editörü, `block_pages` tablosuna yazıyor (bu tablo da schema.sql'de yok).

**İkinci, ayrı ve tutarsız bir "office" sayfası daha var:** `/office` (533 satır) — `Office3D.tsx` (`react-three-fiber`) ile 3D görselleştirme, **kendi ayrı sahte agent listesi** (Burs/IELTS/Rutin/Ticaret/Keşif Agenti — bunlar da registry'deki gerçek agent adlarıyla eşleşmiyor). Yani şu an **üç farklı "agent görselleştirmesi" konsepti** var: `/office` (3D, sahte), `/agent-panel` Office tab (2D SVG, sahte, farklı agent seti), `/agent-panel` Live/Runner tab (gerçek). Bu üçü birbirinden habersiz.

**Yarım kalan** (roadmap.md kendi ifadesiyle doğruluyor)
- Essay yazım sistemi / essay ajanı — roadmap'te "en kritik eksik" olarak işaretli.
- Gramer A2/B1/C1 içeriği (sadece A1 var).
- İngilizce plan → Takvim entegrasyonu.
- Proaktif Sanchez (hatırlatma, kendi inisiyatifiyle ulaşma).
- Obsidian bağlantısı.
- `agent.moduleTarget` alanı — her agent tanımında `null` olarak sabit; bir agent çıktısının otomatik olarak ilgili modüle yazılması altyapısı **tasarlanmış ama hiç kullanılmamış** (dead scaffold).

**Boş duran**
- `/community` — literal "Yakında açılıyor" placeholder, hiç mantık yok.
- `/login` — gerçek auth yok, direkt `/dashboard`'a redirect ediyor (roadmap "Auth kaldırma, tek kullanıcı" kararını doğruluyor).
- `lib/supabase-server.ts` — tanımlı ama kullanım noktası bulunamadı, **belirsiz**.

---

## 5. AGENT PANEL HAZIRLIĞI

**Kısa cevap:** Mimari, istenen şeyi büyük ölçüde zaten karşılıyor — çünkü "agent panel" zaten var ve gerçek kısmı (Live Agents/Runner) çalışıyor.

**Neden uygun:**
- **Yeni sekme** = `app/<yeni-sayfa>/page.tsx` + sidebar linki. 8+ sayfa zaten bu deseni takip ediyor, sürtünmesiz.
- **Çoklu API çağrısı** = `lib/agents/registry.ts`'e yeni bir `AgentDefinition` eklemek yeterli (persona, `toolNames`, `outputContract`, `maxTokens`, `webSearch`). `runner.ts` bunu otomatik olarak çalıştırır, `/api/agents/list` otomatik listeler, Sanchez'in kendisi `run_agent` tool'uyla otomatik orkestre edebilir — **executor.ts veya chat route'una dokunmadan** yeni agent eklenebiliyor.
- **Çıktı depolama** = `agent_runs` (status/input/output/module_target) + `agent_logs` (araç çağrısı izleri) tabloları zaten var ve UI'da (`RunRow`, `AgentDetailPanel`) canlı polling ile gösteriliyor.

**Önce ne değişmeli (agent sayısı artmadan önce):**
1. **`schema.sql`'i gerçek DB durumuyla senkronize et.** Şu an sadece 4 tablo tanımlı (`profiles`, `memories`, `modules`, `messages`) ama kod en az 12 farklı tabloya bağımlı (`conversations`, `habits`, `habit_logs`, `journal_entries`, `journal_questions`, `agent_runs`, `agent_logs`, `library`, `user_profile`, `modules_order`, `block_pages`). Yeni agent'lar eklerken hangi tabloların gerçekten var olduğu belirsizleşiyor.
2. **Service role key / RLS durumunu netleştir** (bkz. §6 madde 2) — yeni agent'lar daha fazla yazma işlemi yapacak, altındaki yetkilendirme belirsizken üstüne inşa etmek riski büyütür.
3. **Concurrency/kuyruk katmanı yok.** `runner.ts` tamamen senkron, tek seferde tek agent çalıştırıyor. `/agent-panel` Office tab'ının vaat ettiği "15 ajan paralel çalışıyor" senaryosu için (gerçek bir versiyonu yapılacaksa) queue/rate-limit/iptal mekanizması gerekir — şu an hiçbiri yok.
4. **`moduleTarget` mekanizmasını ya tamamla ya da kaldır.** Şu an her agent'ta `null`, hiçbir yerde tüketilmiyor — yarım bırakılmış bir entegrasyon noktası.

**Önerilen entegrasyon noktaları:**
- Yeni agent = `lib/agents/registry.ts` içine yeni `AgentDefinition` (asıl genişleme noktası burası).
- Agent'a özel DB okuma/yazma gerekiyorsa = `lib/anthropic.ts` `TOOLS` dizisine yeni tool tanımı + `lib/agents/executor.ts` `serverExecuteTool` switch'ine case eklemek (bu ikisi her zaman birlikte güncellenmeli — şu an ayrık iki dosya, senkron tutmak insan hatasına açık).
- Yeni sekme/görselleştirme = mevcut `/agent-panel` Live Agents/Runner deseni referans alınmalı, `/office` veya Office tab'ının mock deseni **değil**.

---

## 6. KRİTİK 5 SORUN (öncelik sırasıyla)

1. **Şema/DB tutarsızlığı — `supabase/schema.sql` gerçek veritabanını yansıtmıyor.** Kod en az 12 tabloya bağımlı, şema dosyası sadece 4'ünü tanımlıyor. `roadmap.md` bunu zaten biliyor ("RLS güvenlik (tüm tablolar) — deploy öncesi şart"). Bu, projeyi sıfırdan kuracak biri (ya da bu şemayı "doğru" sanıp üstüne çalışan bir agent) için doğrudan çalışmayan bir uygulamaya yol açar. En yüksek öncelik çünkü hem güvenlik hem de yeniden üretilebilirlik sorunu.

2. **Kimlik doğrulama / yetkilendirme belirsizliği.** `/login` gerçek auth yapmadan `/dashboard`'a redirect ediyor (`auth.users` tablosuna referans veren şema hâlâ duruyor ama kullanılmıyor). Aynı zamanda `memories`/`modules`/`messages` tabloları `auth.uid() = user_id` RLS politikasıyla korunuyor, ve sunucu route'ları `SUPABASE_SERVICE_ROLE_KEY ?? ANON_KEY` fallback'i kullanıyor ama `.env.local`'da service role key **yok**. Ya RLS bu yüzden fiilen bypass ediliyor (tek kullanıcı olduğu için şu an zararsız ama "deploy" hedefiyle doğrudan çelişiyor) ya da yazmalar `auth.uid()` null olduğu için sessizce başarısız oluyor (kodda çok sayıda `.catch(() => {})` var, hata yutulabilir) — hangisi **belirsiz**, ama ikisi de acil netleştirme gerektiriyor.

3. **`lib/openai.ts` içinde yaşayan Sanchez system prompt'u + MiniChat/ChatInterface arasında hafıza tutarsızlığı.** Dosya adı ile içerik uyuşmuyor (tarihsel kalıntı, OpenAI→Anthropic geçişinden kalma), bu kafa karışıklığı yaratır. Daha ciddisi: `MiniChat.tsx` aynı Sanchez'i konuşturuyor ama konuşmayı hiç kaydetmiyor/özetlemiyor — kullanıcı hangi arayüzden konuştuğuna göre farklı hafıza garantisi alıyor, bu "tek bir Sanchez" vizyonuyla (bkz. `docs/reborn-vision.md`) çelişiyor.

4. **Gerçek token-bazlı streaming yok.** `/api/chat` bir `ReadableStream` sunuyor ama Anthropic çağrısı non-streaming; kullanıcı model tüm cevabı bitirene kadar hiçbir şey görmüyor, sonra bloklar toplu gönderiliyor. Tool-use zincirleri (agent orkestrasyonu, web search) uzadıkça bu algılanan gecikmeyi büyütür — özellikle "agent panel" gibi çok adımlı akışlar eklendikçe UX riski artar.

5. **`/agent-panel` Office tab ve `/office` sayfası tamamen mock, birbirinden habersiz, ve gerçek agent registry'siyle uyumsuz.** Kullanıcının tam olarak istediği görsel/çoklu-agent panel zaten "varmış gibi görünüyor" ama en gösterişli kısmı sahte veri. Bu, ileride "üstüne inşa edeceğim" denildiğinde gerçek olanla (Live Agents/Runner) mock olanı (Office) karıştırma riski taşıyor — biri zaten çalışıyor sanıp üstüne agent bağlamaya çalışabilir ama altında hiç altyapı yok.

---

*Not: `node_modules/next/dist/docs/` dizini bu oturumda incelenmedi (`AGENTS.md`'de belirtilen "breaking changes" uyarısı) — sadece analiz istendiği ve Next.js API kullanımı bu raporun kapsamı dışında olduğu için atlandı.*
