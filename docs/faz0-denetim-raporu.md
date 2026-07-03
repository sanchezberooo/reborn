# FAZ 0 — KOD TABANI DENETİM RAPORU

> Tarih: 2 Temmuz 2026 · Görev: Faz 0, Görev 1 (Kod Tabanı Denetimi)
> Kural: Hiçbir kod değiştirilmedi. Her tespit koddan doğrulandı; doğrulanamayanlar **belirsiz** olarak işaretlendi.
> Referans: `docs/reborn-master-roadmap.md` v1.1. Önceki denetim `REBORN-DURUM-RAPORU.md` ile karşılaştırmalı okundu — orada raporlanan sorunların bir kısmı bu tarihten önce düzeltilmiş (aşağıda belirtiliyor).

---

## 1. MEVCUT DURUM HARİTASI

### 1.1 Teknoloji Stack'i (package.json'dan doğrulandı)

| Katman | Teknoloji | Versiyon | Not |
|---|---|---|---|
| Framework | Next.js (App Router) | **16.2.4** | `dev` script'i `next dev --webpack` (Turbopack devre dışı). Roadmap "Next.js 15" diyor — bkz. §4.1 |
| UI | React | 19.2.4 | |
| Dil | TypeScript | ^5 | strict; `tsconfig.json` standart |
| DB | Supabase (PostgreSQL) | `@supabase/supabase-js` ^2.104.1 + `@supabase/ssr` ^0.10.2 | pgvector **yok**, embedding **yok** |
| AI (üretken) | `@anthropic-ai/sdk` | ^0.92.0 | Model: `claude-sonnet-4-6` (`lib/anthropic.ts:13`), ajan override'ı `claude-haiku-4-5` |
| AI (yardımcı) | `openai` | ^6.34.0 | **Yalnızca** sohbet özetleme (`/api/summarize`, gpt-4o-mini) — tek kullanım noktası |
| Stil | Tailwind CSS | v4 (`@tailwindcss/postcss`) | + `components/ui/*` shadcn-tarzı primitifler + yoğun inline style (örn. `agent-panel/page.tsx`'te 32 `style={{`) |
| Editör | BlockNote | ^0.51.4 | `/notion` sayfası |
| Takvim | FullCalendar | ^6.1.21 | `/takvim` |
| 3D | three + @react-three/fiber + drei | ^0.184 / ^9.6 / ^10.7 | Agent Office 3D görünümü |
| Test | — | — | **Hiç test altyapısı yok** (Vitest/Jest config'i, test dosyası yok) |
| State kütüphanesi | — | — | Redux/Zustand/Context yok |

### 1.2 Klasör Yapısı ve Sorumluluklar

| Klasör | Sorumluluk |
|---|---|
| `app/` | Sayfalar + `app/api/*` route handler'ları (backend'in tamamı Next.js içinde, ayrı servis yok). Sayfalar: `/` (Sanchez chat), `/dashboard` + `/dashboard/[id]`, `/gunluk`, `/aliskanlik`, `/takvim`, `/roadmap`, `/notion`, `/essay`, `/burs-akademisi`, `/ingilizce` (+ alt bileşenleri + `/ingilizce/gramer/[topic]`), `/agent-panel`, `/community` (boş placeholder), `/login` (redirect'ten ibaret) |
| `app/api/` | `chat` (Sanchez, streaming), `action` (modül CRUD), `summarize` (OpenAI özet), `setup` (profil seed), `health` (tanılama), `agents/{list,run,runs,logs}` (ajan sistemi) |
| `components/` | `chat/` (ChatInterface, MiniChat, **useSanchezChat** ortak hook, Message), `office/` (Office3D, AgentCard), `modules/` (EnglishModule, GenericModule), `ui/` (14 primitif), AppShell/Header/Sidebar/LayoutBody |
| `lib/` | Çekirdek: `anthropic.ts` (client + 15 tool tanımı), `openai-client.ts`, `sanchez-prompt.ts` (system prompt üretici), `db.ts` (tüm CRUD — 650 satır), `modules.ts` (modül çerçevesi + ActionType), `agents/` (registry/runner/executor/types), `supabase{,-admin,-server}.ts`, `chat-events.ts` (NDJSON protokol tipleri), `memory.ts` (profil tipi + DEFAULT_PROFILE) |
| `hooks/` | Tek dosya: `use-mobile.ts` |
| `supabase/` | `schema.sql` — 2026-07-02'de canlı DB'ye karşı doğrulanmış, 17 tablo. Migration sistemi **yok** (tek declarative dosya) |
| `docs/` | vision, roadmap (eski + master), kisisel-arsiv + bu rapor |
| Kök | `REBORN-DURUM-RAPORU.md` (önceki denetim), `ruvector.db` (harici araç kalıntısı, gitignore'da), **`reborn kasa/`** (Obsidian kasası — kişisel veri, repo kökünde untracked duruyor), `docs/desktop.ini` (Windows çöpü, untracked) |

### 1.3 Veri Modeli (schema.sql, canlı DB'ye karşı doğrulanmış)

**17 tablo** — hepsi "tek kullanıcı (Bero)" varsayımıyla:

- **`profiles`** — tek satırlık kullanıcı profili (ad, hedef, IELTS tarihi, üniversiteler…). `auth.users` FK'si bilinçli olarak yok.
- **`memories`** — düz metin hafıza kayıtları (summary, content, type, tags, importance, date). **Embedding kolonu yok; retrieval = son 5 kayıt** (`lib/db.ts:59-70`) veya tool ile type/tags filtresi.
- **`conversations`** — sohbet geçmişi; mesajlar tek jsonb dizisi olarak (`messages` kolonu), istemci üretimli UUID.
- **`messages`** — **LEGACY**: koddan hiçbir yazma yolu yok, yalnızca `/api/health` varlığını yokluyor.
- **`modules`** — jsonb `data` çuvalı olan modül kayıtları; `modules_order` — kart sırası.
- **`habits`**, **`habit_logs`** — alışkanlık takibi.
- **`journal_questions`**, **`journal_entries`** — günlük (mood, day_score, 2 soru-cevap, serbest yazım).
- **`user_profile`** — key-value profil eklentisi (`onConflict: 'key'` — tek kullanıcı varsayımı şemaya gömülü).
- **`library`** — burs/kaynak/not arşivi (**user_id kolonu yok**).
- **`agent_runs`**, **`agent_logs`** — ajan çalıştırma durumu + tool çağrısı izleri.
- **`block_pages`** — BlockNote sayfaları. **`calendar_events`** — takvim (user_id yok).
- **`essays`**, **`essay_versions`** — essay koçluk sistemi (versiyonlu, silinmeyen taslaklar).

Kritik gözlem: veri modeli **modül-silolu**. "Her şey birbirine bağlı" ilkesinin gerektirdiği `entities`/`links` çekirdeği, embedding, graf — hiçbiri yok. Journal girdisi ile hedef arasında hiçbir bağlantı mekanizması yok. Bu, roadmap'in zaten Faz 1'de inşa etmeyi planladığı şey; mevcut durum beklenen başlangıç noktası.

### 1.4 AI Entegrasyonu — Anthropic nereden, nasıl çağrılıyor?

**Üretken çağrı yapan yalnızca 2 nokta var** (tüm repo grep'lendi):

1. **`app/api/chat/route.ts`** — Sanchez ana sohbeti.
   - `anthropic.beta.messages.stream()` ile **gerçek token-bazlı streaming** (önceki raporun 4. maddesi düzeltilmiş).
   - Çıktı NDJSON olay protokolü (`lib/chat-events.ts`: `text | tool_start | tool_end | done | error`) olarak istemciye akıyor; istemci tarafı `components/chat/useSanchezChat.ts`.
   - `while(true)` tool-use döngüsü: 15 custom tool (`lib/anthropic.ts` `TOOLS`) + sunucu taraflı `web_search` beta aracı. Tool'lar `lib/agents/executor.ts` `serverExecuteTool()` switch'inde çalışıyor, her çağrı `agent_logs`'a yazılıyor.
   - System prompt: `lib/sanchez-prompt.ts` `buildSystemPrompt()` — karakter + profil + **son 5 hafıza** + önceki sohbetin son 8 mesajı + aktif modül verisi + statik modül şema referansı. (Önceki raporun "lib/openai.ts'te yaşıyor" bulgusu düzeltilmiş — dosya yeniden adlandırılmış.)
   - API key yoksa 503 + Türkçe açıklama döndürüyor; yani **uygulama API'siz açılıyor ama sohbet ölü** — MockProvider kriterini henüz karşılamıyor.

2. **`lib/agents/runner.ts`** — ajan çalıştırıcı.
   - Non-streaming `anthropic.messages.create()` (webSearch'lü ajanlar için `beta.messages.create`). Tool döngüsü + JSON-only çıktı sözleşmesi + kaba `{...}` ayıklama parser'ı. Sonuç `agent_runs`'a yazılıyor.
   - 8 kayıtlı ajan (`lib/agents/registry.ts`): ingilizce-genel-plan, ingilizce-planlayici, kesif-arastirmaci, burs-toplu-arastirma, burs-derinlestir, essay-brainstorm, essay-critic, test-agent. Tetikleme: UI (`/api/agents/run`) veya Sanchez'in `run_agent` tool'u (executor → runner dinamik import).

Yardımcı: **`app/api/summarize/route.ts`** — OpenAI `gpt-4o-mini` ile sohbet özeti (yeni sohbete geçerken `memories`'e yazılıyor); key yoksa ilk kullanıcı mesajına düşen zarif fallback zaten var.

**Client kurulumları:** `lib/anthropic.ts` (modül seviyesi singleton, `process.env.ANTHROPIC_API_KEY`), `lib/openai-client.ts`. Hardcoded key **yok**; `.env.local` gitignore'da (`.env*`).

**Embedding çağrısı hiçbir yerde yok.**

### 1.5 State Yönetimi, Routing, Stil

- **State:** Tamamı component-local `useState`/`useEffect`. Neredeyse her sayfa `'use client'`. Sayfalar arası senkron `window.dispatchEvent(new CustomEvent(...))` olay otobüsü ile: `reborn:new-chat`, `reborn:modules-updated`, `reborn:conversation-saved`, `reborn:new-memory`, `reborn:load-conversation`. `localStorage` yalnızca aktif sohbet id'si için (`reborn:active-conversation`).
- **Chat state:** `useSanchezChat` ortak hook'u — ChatInterface ve MiniChat aynı kayıt/özet hattını paylaşıyor (önceki raporun 3. maddesi düzeltilmiş; "tek Sanchez, tek hafıza" yorumu kodda).
- **Veri erişim deseni ikili:** çoğu sayfa `lib/db.ts` üzerinden; ama `/takvim` ve `/notion` doğrudan `supabase` client'ı import ediyor (katman bypass'ı).
- **Routing:** Saf App Router dosya-bazlı. Middleware yok, layout tek (`app/layout.tsx` → AppShell → her sayfada MiniChat).
- **Stil:** Tailwind v4 + `components/ui/*` primitifleri; ancak büyük sayfalarda (agent-panel, MiniChat, burs-akademisi) yoğun inline `style={{}}` karışımı. Tutarlı bir tasarım sistemi henüz yok (roadmap bunu zaten Faz 3'e koymuş).

---

## 2. KORU / REFACTOR / YENİDEN YAZ MATRİSİ

Karar filtresi: *"Bu parça Unified Entity Model ve AIProvider soyutlamasına evrimleşebilir mi, direnir mi?"*
Efor: S (< yarım gün) / M (1-2 gün) / L (3+ gün).

| Parça | Karar | Gerekçe | Efor |
|---|---|---|---|
| `lib/anthropic.ts` (client + TOOLS) | **REFACTOR** | İki ayrı sorumluluk tek dosyada: SDK client'ı (AIProvider'ın içine girecek) ve tool tanımları (provider-bağımsız, ayrı dosyaya). Tool şemaları Anthropic tipinde ama yapı jenerik — direnmez. | M |
| `app/api/chat/route.ts` | **REFACTOR** | Streaming + NDJSON protokolü + tool döngüsü sağlam ve korunmalı; yalnızca `anthropic.beta.messages.stream` çağrısı `provider.stream()` arkasına alınır. Route'un iskeleti AIProvider'a hazır. | M |
| `lib/chat-events.ts` + `useSanchezChat.ts` istemci akışı | **KORU** | Provider-agnostik olay protokolü — MockProvider da aynı olayları üretebilir. Zaten doğru soyutlama seviyesinde. | S |
| `lib/agents/registry.ts` + `types.ts` | **KORU** | Bildirimsel ajan tanımı (persona, toolNames, outputContract, model override) provider'dan bağımsız. Yeni ajan = yeni kayıt; genişleme noktası doğru kurulmuş. | S |
| `lib/agents/runner.ts` | **REFACTOR** | Akış mantığı iyi ama `anthropic.messages.create` + beta cast hack'leri (`as unknown as`) doğrudan gömülü; `provider.complete()` arkasına alınmalı. Kaba JSON parser'ı MockProvider testleriyle sağlamlaştırılır. | M |
| `lib/agents/executor.ts` | **KORU** (küçük dokunuş) | Saf DB yan-etki katmanı, AI'dan tamamen bağımsız — AIProvider'a direnmez. Uzun vadede tool case'leri entity yazımlarına evrilir. | S |
| `lib/sanchez-prompt.ts` | **KORU** | Roadmap FAZ AI'daki "karakter tek system prompt dosyasında" kararının embriyosu zaten bu. Hafıza bölümü Faz 1'de retrieval çıktısına bağlanır. | S |
| `lib/db.ts` | **REFACTOR** (aşamalı) | Tek veri-erişim kapısı olması büyük avantaj — Unified Entity Model'e geçişte çağrı imzaları korunup altı entity tablolarına yönlendirilebilir. 650 satır; domain'lere bölünmeli. Direnmez, ama migration'ın ana yükü burada. | L |
| `supabase/schema.sql` veri modeli | **YENİDEN YAZ** (genişleterek) | Modül-silolu şemadan `entities`/`links`/`memories`(+pgvector)/`messages` çekirdeğine geçiş Faz 1'in kendisi. Mevcut tablolar bir gecede silinmez: entity çekirdeği yanına kurulur, journal/goals/memories oraya migrate edilir, jsonb `modules.data` en son taşınır. `messages` (legacy) ve `library`/`calendar_events`'in user_id'sizliği bu geçişte temizlenir. | L |
| `lib/modules.ts` (modül çerçevesi + ActionType) | **REFACTOR** | jsonb "data çuvalı" Unified Entity Model'e **direnen** ana parça — modül verisi tipsiz ve bağlantısız. Ama ActionType/`dbExecuteAction` deseni, Faz 2 "modül çerçevesi v1"in ham maddesi. `<REBORN_ACTION>` parse yolu ise ölü (bkz. §3.4) — kaldırılır. | M |
| `app/api/summarize` + `lib/openai-client.ts` | **YENİDEN YAZ** (küçük) | Tek OpenAI kullanım noktası; AIProvider gelince `provider.complete()` çağrısına döner, `openai` bağımlılığı tamamen silinir. Fallback davranışı korunmalı. | S |
| Journal `/gunluk` | **KORU** | Temiz, `lib/db.ts` üzerinden çalışıyor. Faz 2'de girdileri entity+embedding olur; UI direnmez. | S |
| Alışkanlık `/aliskanlik`, Dashboard `/dashboard` | **KORU** | DB katmanına düzgün bağlı; entity geçişinde yalnızca alt katman değişir. | S |
| Essay sistemi (`/essay` + essay ajanları + `essay_versions`) | **KORU** | En olgun modül: versiyonlama, "AI metin yazmaz" ilkesi (vizyonun dürüstlük çizgisi) hem registry persona'larında hem Sanchez promptunda kodlanmış. Ajanları runner refactor'ünden bedava yararlanır. | S |
| Burs Akademisi `/burs-akademisi` | **KORU** | Ajan → `UPDATE_MODULE` → jsonb akışı çalışıyor; entity geçişinde okul kayıtları entity olur. 627 satırlık tek dosya, ileride bölünebilir. | S |
| İngilizce `/ingilizce` + `components/modules/EnglishModule.tsx` | **REFACTOR** | **İki paralel İngilizce implementasyonu var**: `/ingilizce` (10 alt bileşen, modules tablosuna bağlı) ve dashboard detayındaki `EnglishModule.tsx` (572 satır). Ayrıca `app/ingilizce/lib/data.ts` (630 satır statik örnek veri) yalnız dashboard bileşeninden import ediliyor. Tekilleştirilmeli; içerik verisi DB'ye/fixture'a inmeli. | M |
| Agent Panel `/agent-panel` + `Office3D` | **KORU** | Önceki raporun 5. maddesi düzeltilmiş: sahte 15 ajan kaldırılmış, Office sekmesi artık registry + `agent_runs` canlı verisiyle çalışıyor (`page.tsx:498` yorumu + kod doğrular). Faz 4 Agent Office panelinin doğal tohumu. | S |
| `/takvim`, `/notion` | **KORU** (küçük dokunuş) | Çalışıyor; tek borç doğrudan `supabase` import'u — `lib/db.ts` katmanına alınmalı. Vizyonda çekirdek değiller. | S |
| `/community` | **YENİDEN YAZ / KALDIR** | Boş placeholder. Roadmap v1 kapsamında community yok (Faz 6+). Sidebar'dan ve koddan çıkarılması sadeleştirir. | S |
| `/login` + `lib/supabase-server.ts` | **KORU** (bilinçli beklet) | Login redirect'ten ibaret; `supabase-server.ts`'in hiçbir import'u yok (grep doğruladı). İkisi de Faz 5 auth için iskelet — silinebilir de, açıklama yorumu ile bekletilebilir de. Karar: Faz 5'e not düş. | S |
| `app/api/health`, `app/api/setup` | **KORU** (küçük dokunuş) | Faydalı tanılama/seed araçları. `health` env key'inin ilk 30 karakterini yanıtta gösteriyor (anon key public olsa da alışkanlık olarak kaldırılmalı) ve legacy `messages` tablosunu yokluyor. | S |

**Özet:** Hiçbir ana parça AIProvider'a *yapısal olarak* direnmiyor — üretken çağrılar zaten 2 dosyada toplanmış durumda. Unified Entity Model'e direnen tek yapı `modules.data` jsonb çuvalı; onun için de aşamalı migration yolu açık.

---

## 3. TEKNİK BORÇ VE RİSKLER

### 3.1 Güvenlik

1. **RLS fiilen koruma sağlamıyor.** `schema.sql` başlığındaki not (canlı testle, 2026-07-02) anon key ile `memories`/`modules`/`conversations` tablolarından satır döndüğünü doğruluyor. `auth.uid() = user_id` politikaları var ama gerçek Supabase Auth session'ı hiç kurulmuyor. Tek kullanıcı + lokal çalışmada zararsız; **Faz 5 deploy'unun ön koşulu** olarak roadmap'te zaten işaretli. Şimdilik risk: Supabase URL + anon key'i bilen herkes tüm veriyi okur/yazar.
2. **API route'ları tamamen auth'suz.** `/api/agents/run` dışarıdan çağrılırsa ücretli Anthropic çağrısı tetikler; `/api/action` veri değiştirir. Lokal kullanımda kabul edilebilir, deploy öncesi kapatılmalı.
3. **Hard-coded API key YOK** — doğrulandı (kaynak grep: `sk-`, `eyJ...`, `supabase.co` desenlerinin hiçbiri kaynak kodda yok). Anahtarlar `.env.local`'da, `.gitignore` `.env*` içeriyor, git'te izlenen env dosyası yok.
4. Küçükler: `/api/health` anon key'in ilk 30 karakterini yanıtta basıyor; `NEXT_PUBLIC_BERO_ID` için kodda sabit UUID fallback var (`app/api/health/route.ts:3`); `library` ve `calendar_events` tablolarında `user_id` yok.

### 3.2 Kırık / Yarım Özellikler

- **`messages` tablosu legacy** — hiçbir yazma yolu yok; health check'i yanıltıyor.
- **`moduleTarget` ölü iskele** — tüm ajanlarda `null`, `agent_runs`'a yazılıyor ama hiçbir tüketicisi yok. Ya Faz 4 orkestrasyonunda anlamlandırılmalı ya kaldırılmalı.
- **`test-agent`** registry'de duruyor (zararsız ama üretim listesinde görünüyor — `/api/agents/list` filtrelemiyor).
- **İngilizce çifte implementasyon** (bkz. matris) + `app/ingilizce/lib/data.ts` statik örnek verisi.
- **`/community`** boş kabuk; **`/login`** sahte.
- **`lib/supabase-server.ts`** hiç import edilmiyor (ölü kod / Faz 5 hazırlığı).
- **`lib/types.ts` `Agent` ve `Module` arayüzleri** eski konseptin kalıntısı (gerçek tipler `lib/agents/types.ts` ve `lib/modules.ts`'te).

### 3.3 Dayanıklılık / Kalite

- **Sıfır test.** Vitest kurulumu Faz 0 kapsamında zaten zorunlu.
- **Migration sistemi yok** — tek `schema.sql`; canlı DB'yle senkron tutma işi manuel (dosya başlığındaki uzun doğrulama notu bu acının kanıtı).
- **Retry/rate-limit/timeout yok** — hem chat route hem runner tek `try/catch`; Anthropic 429/529'da kullanıcıya jenerik hata düşer.
- **Runner'ın JSON parser'ı kırılgan** — `{...}` arası kaba kesme; iç içe kod bloklu yanıtlarda `parseError` üretir (fallback var, veri kaybolmaz).
- **Ajan eklerken iki dosyayı senkron tutma zorunluluğu** — tool tanımı `lib/anthropic.ts`'te, davranışı `executor.ts`'te; derleyici uyuşmazlığı yakalamıyor.
- **Hata yutma deseni** — `catch(() => {})` / `catch {}` yaygın (db.ts, useSanchezChat); sessiz veri kaybı riski.
- **Repo hijyeni:** `reborn kasa/` (Obsidian kasası — kişisel veri) repo kökünde; `docs/desktop.ini` çöpü; ikisi de untracked ama `.gitignore`'a eklenmeli/taşınmalı. `ruvector.db` gitignore'da, sorun değil. (Önceki raporda anılan kök dizindeki 0-byte çöp dosyaları temizlenmiş — artık yok.)

### 3.4 Ölü Protokol: `<REBORN_ACTION>`

`useSanchezChat.ts` ve `lib/modules.ts` hâlâ model çıktısından `<REBORN_ACTION>` etiketi ayıklayıp `/api/action`'a gönderiyor — ama **mevcut system prompt bu etiketi üretmeyi hiç istemiyor** (grep: etiket yalnızca bu iki istemci dosyasında geçiyor). Model artık aynı işi tool'larla (`update_module` vb.) yapıyor. Parse yolu çalışan koda zarar vermiyor ama okuyanı yanıltan ve MockProvider senaryolarını karmaşıklaştıracak bir fosil. Not: `ActionType`/`dbExecuteAction` mekanizmasının kendisi ölü **değil** — `/ingilizce` ve `/burs-akademisi` doğrudan çağırıyor; ölü olan yalnızca etiket-parse yolu.

---

## 4. ROADMAP UYUM ANALİZİ

### 4.1 Kalıcı Teknik Kararlar vs. Mevcut Stack

| Roadmap kararı | Mevcut durum | Fark / Aksiyon |
|---|---|---|
| Next.js **15** + TypeScript | Next.js **16.2.4** + TS 5 | Mevcut, roadmap'ten **daha yeni**. Downgrade anlamsız; roadmap "15" ifadesi "16" olarak güncellenmeli. Dikkat: 16'nın breaking change'leri var (`AGENTS.md` uyarısı) — kod yazan her oturum `node_modules/next/dist/docs/` okumalı. `dev --webpack` bayrağının nedeni belirsiz; Turbopack'e dönüş ayrıca değerlendirilebilir. |
| Supabase (PostgreSQL + pgvector + Auth + Storage) | Supabase Postgres var; **pgvector yok, Auth fiilen kapalı, Storage kullanılmıyor** | pgvector Faz 1'de eklenir (Supabase MCP erişimi mevcut). Auth bilinçli erteleme (Faz 5). Uyumsuzluk değil, planlanan boşluk. |
| Tailwind + shadcn/ui | Tailwind v4 + shadcn-tarzı el yapımı `ui/` primitifleri + inline style karışımı | Yön doğru; disiplin eksik. Faz 3 tasarım sisteminde tekilleştirilir. |
| AIProvider soyutlaması (`complete/stream/embed`) | **Yok** — SDK'lar doğrudan kullanılıyor | Faz 0'ın ana müdahalesi. İyi haber: üretken çağrı yalnızca 2 dosyada (aşağıda plan). |
| Unified Entity Model | Yok — modül-silolu şema | Faz 1 işi; bugünkü tek görev şemayı bilerek genişletmemek. |
| MockProvider ile API'siz çalışma | Kısmen: uygulama açılıyor, journal/habits/takvim çalışıyor; **chat 503, ajanlar patlar** | MockProvider ile kapanacak — Faz 0 başarı kriteri #2. |
| Tek Muhatap Sanchez | Uyumlu: her sayfada MiniChat, ana ekran chat, ajanlar Sanchez'in `run_agent`'ı üzerinden | Agent Panel "izleme penceresi" ilkesine de uyuyor (Live/Runner/Office3D artık gerçek veri). |
| Kontrol kullanıcıda / Şeffaflık | Kısmen: tool çağrıları `agent_logs`'a yazılıyor ve UI'da izlenebilir; ama Sanchez promptu "onay bekleme, HEMEN yap" diyor | Prompt ilkesi ile roadmap ilkesi (öneri + onay) **çelişiyor** — FAZ AI kalibrasyonunda çözülmeli, şimdilik not. |

### 4.2 AIProvider Geçiş Planı — Hangi Dosyalar Etkilenir

Mevcut üretken çağrı envanteri (tam liste, grep ile doğrulandı):

| # | Dosya | Çağrı | Hedef |
|---|---|---|---|
| 1 | `app/api/chat/route.ts:68` | `anthropic.beta.messages.stream(...)` | `provider.stream(...)` |
| 2 | `lib/agents/runner.ts:54-57` | `anthropic.messages.create` / `beta.messages.create` | `provider.complete(...)` |
| 3 | `app/api/summarize/route.ts:23` | `openai.chat.completions.create` | `provider.complete(...)` → `openai` paketi silinir |

**Yeni dosyalar:**
```
lib/ai/
  provider.ts        → AIProvider interface: complete(), stream(), embed()
                       + provider-agnostik tipler (AIMessage, AIToolDef, AIStreamEvent —
                       lib/chat-events.ts ChatEvent'ine bilinçli benzerlikte)
  anthropic.ts       → AnthropicProvider (mevcut lib/anthropic.ts client'ı + stream/tool-loop
                       çevirisi buraya taşınır)
  mock.ts            → MockProvider v1: deterministik senaryo fixture'ları (tanışma, hedef
                       konuşması, hafıza çağrısı, tool çağrısı simülasyonu, hata durumu);
                       stream() gerçek gecikmeli token akışı taklidi yapar
  local-embedding.ts → Faz 1'de (bge-m3); interface'te embed() ilk günden tanımlı,
                       AnthropicProvider'da "unsupported" fırlatır
  index.ts           → config/env ile provider seçimi (AI_PROVIDER=mock|anthropic)
  tools.ts           → TOOLS tanımları lib/anthropic.ts'ten buraya, provider-bağımsız şemayla
```

**Değişen dosyalar:** `app/api/chat/route.ts` (SDK yerine provider; NDJSON protokolü aynen kalır — istemci **hiç etkilenmez**), `lib/agents/runner.ts`, `app/api/summarize/route.ts`, `lib/anthropic.ts` (içi boşalır/silinir), `lib/openai-client.ts` (silinir), `package.json` (`openai` çıkar).

**Etkilenmeyenler:** `useSanchezChat.ts`, tüm sayfalar, `executor.ts` (tool yürütme zaten AI'dan bağımsız), `registry.ts` (yalnızca `model` alanı provider-agnostik ID'ye normalize edilir).

Riskler: (1) Anthropic'in `web_search` sunucu-taraflı beta aracı provider-spesifik — interface'te `capabilities: { webSearch?: boolean }` olarak modellenmeli, MockProvider sahte arama sonucu fixture'ı döndürmeli. (2) Streaming tool-use döngüsü (chat route'taki `while(true)`) provider'ın içine mi route'ta mı kalacak — önerim: döngü route'ta kalsın, provider yalnızca tek model turunu soyutlasın; MockProvider senaryoları tur bazında kurgulanır.

---

## 5. ÖNERİLEN İLK 3 MÜDAHALE

### 1. AIProvider soyutlaması + MockProvider v1 (roadmap'in "ilk cerrahi müdahale"si)
**Kapsam:** §4.2'deki plan aynen — `lib/ai/` modülü, 3 çağrı noktasının taşınması, `AI_PROVIDER=mock` ile sohbetin uçtan uca (streaming + tool durum göstergeleri + hata senaryosu dahil) API'siz akması, `openai` bağımlılığının silinmesi.
**Neden ilk:** Faz 0'ın iki başarı kriterini ("uygulama API'siz ayağa kalkıyor, sohbet MockProvider ile akıyor") doğrudan kapatır; Faz 1-4'ün tamamı bu soyutlamanın üstüne kurulacak; ve bakiye yokken geliştirmeyi bloklayan tek şey bu. Küçük, güvenli, geri alınabilir.

### 2. Test altyapısı (Vitest) + migration disiplini
**Kapsam:** Vitest kurulumu; ilk test hedefleri MockProvider senaryoları, `runner.ts` JSON parser'ı, `modules.ts` `migrateModule`/`parseAction`, `executor.ts`'in kritik case'leri. Migration tarafında: `supabase/migrations/` düzenine geçiş (mevcut `schema.sql` "0000_baseline" olur), Supabase MCP `apply_migration` ile uygulama.
**Neden ikinci:** Faz 0 kapsamında açıkça sayılıyor; müdahale #1'in doğrulanması test olmadan "elle tıklama"ya mahkûm; Faz 1'in ölçülebilir retrieval kriterleri (ilk-5 isabet, <500ms) test koşusu olmadan ölçülemez. Migration sistemi de Faz 1 şema evriminin ön koşulu — `schema.sql`'in başındaki elle doğrulama çilesi bir daha yaşanmamalı.

### 3. Fosil temizliği + repo hijyeni (evrimin önünü açma)
**Kapsam:** `<REBORN_ACTION>` parse yolunun kaldırılması (§3.4); `messages` legacy tablosunun health'ten çıkarılıp şemada `-- DROP adayı` işaretlenmesi; İngilizce çifte implementasyonun tekilleştirilmesi (karar: `/ingilizce` kalır, `EnglishModule.tsx` + `app/ingilizce/lib/data.ts` statik verisi eritilir); `/community` kaldırılır; `lib/types.ts` kalıntı tipleri ile `test-agent`'ın list API'sinden filtrelenmesi; `reborn kasa/`nın repo dışına taşınması + `docs/desktop.ini` için gitignore; `/takvim` ve `/notion`un `lib/db.ts` katmanına alınması.
**Neden üçüncü:** Bunların hiçbiri tek başına acil değil, ama toplamı "CLAUDE.md'yi okuyan yeni bir oturum ek açıklamasız doğru kod üretir" kriterini sabote eden gürültü: ölü protokol yanlış desen öğretir, çifte İngilizce implementasyonu yanlış dosyada değişiklik yaptırır, kişisel kasa yanlışlıkla commit'lenme riski taşır. Faz 1 şema işine girmeden önce zemin temiz olmalı. (RLS/auth bilinçli olarak bu listede yok: roadmap onu Faz 5'e koyuyor ve lokal tek-kullanıcı modunda gerçek risk düşük — deploy öncesi zorunlu kapı olarak şemadaki notta zaten kayıtlı.)

---

*Denetim yöntemi: package.json, schema.sql, lib/ tamamı, tüm API route'ları, chat istemci hattı ve büyük sayfaların veri erişim desenleri satır satır okundu; AI çağrı noktaları, secret sızıntısı, localStorage kullanımı ve ölü kod adayları repo genelinde grep ile tarandı. REBORN-DURUM-RAPORU.md'deki 5 kritik sorundan 3'ü (streaming, prompt dosyası/MiniChat hafızası, sahte Office) bu denetim itibarıyla düzeltilmiş; 2'si (şema senkronu → büyük ölçüde düzeltilmiş ama migration sistemi yok; RLS → açık) güncel durumuyla bu rapora taşındı.*
