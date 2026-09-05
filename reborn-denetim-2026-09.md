# REBORN — TEKNİK DENETİM VE HEDEF MİMARİ RAPORU
**Tarih:** 5 Eylül 2026
**Yöntem:** `github.com/sanchezberooo/reborn` klonlandı (131 commit, tam geçmiş), 504 dosya, ~35.300 satır TS/TSX okundu. Şema 13 migration dosyasından çıkarıldı. README ve dosya adlarına değil, koda bakıldı.

Etiketler: **CONFIRMED** (koddan doğrulandı) · **INFERRED** (güçlü çıkarım) · **MISSING** (yok) · **RECOMMENDED** (öneri)

---

## 0. ÖNCE ÜÇ ŞEY

**1. Repo 16 Temmuz 2026'dan beri güncellenmemiş.** Son commit `e9dae59 Update .gitignore`, 2026-07-16 20:48. Bugün 5 Eylül. 7 hafta. Günde 1 commit hedefin var; 51 gündür 0 commit var. Lokalde çalışıyorsan bile push edilmemiş kod, var olmayan koddur — yedeği yok, geçmişi yok, portfolyo değeri yok.

**2. Kod, sandığından iyi.** Bu bir "vibe-coded dashboard" değil. Provider soyutlaması, event bus, Postgres tabanlı task kuyruğu, hibrit retrieval (HNSW + graf + recency), append-only olay tabloları, default-deny yetenek modeli, 30 test dosyası var. Mimari yorumlar gerçekten mimari kararları belgeliyor. Bu, 18 yaşında self-taught birinden beklenenin epey üstünde.

**3. Ama sistem şu anda internete konulamaz.** Auth yok — hiç. `app/login/page.tsx` 5 satır ve `/dashboard`'a redirect ediyor. 23 API route'un hiçbirinde tek bir yetki kontrolü yok. Sunucu tarafı her şey service-role key ile çalışıyor. Deploy edersen, URL'i bilen herkes senin tüm hayat verine ve tüm agent tool'larına tam yazma erişimi kazanır. Bu, "sonra eklerim" kategorisinde bir eksik değil — mevcut halde tek kullanıcılı bir localhost uygulamasısın.

---

## 1. MEVCUT DURUM — KOD ÜZERİNDEN

### 1.1 Stack — CONFIRMED
| Katman | Gerçek |
|---|---|
| Framework | Next.js 16.2.4, App Router, React 19.2.4 |
| Dil | TypeScript 5, strict |
| Stil | Tailwind v4 (`@tailwindcss/postcss`), shadcn tarzı `components/ui` |
| DB | Supabase Postgres + pgvector, `vector(1024)`, HNSW cosine index |
| LLM | `@anthropic-ai/sdk` ^0.92 — **tek sağlayıcı** |
| Embedding | `@huggingface/transformers` → bge-m3 q8 ONNX, **süreç içinde lokal** |
| Test | Vitest, 30 test dosyası |
| Build | `next dev --webpack` (Turbopack panic nedeniyle) |
| Takvim | FullCalendar | 
| Editör | BlockNote |

Toplam: `lib` 19.921 satır, `app` 9.488, `components` 5.178.

### 1.2 Frontend mimarisi — CONFIRMED
14 sayfa grubu: `dashboard`, `gunluk`, `aliskanlik`, `hedefler`, `roadmap`, `takvim`, `essay`, `burs-akademisi`, `ingilizce` (10 alt modül), `brain`, `notion`, `maxai` (panel/ofis/brain/business/intelligence).

- `AppShell` + `Sidebar` + `ModuleGate` deseniyle modül görünürlüğü kontrol ediliyor.
- Chat istemcisi `components/chat/useSanchezChat.ts`, NDJSON stream tüketiyor.
- **Beden ve Finans modülleri kodda sayfa olarak YOK.** Hafızandaki "8 modül" listesi ile gerçek route listesi uyuşmuyor — bunlar ya DB'de `modules` kaydı olarak duruyor ya da düşmüş. **INFERRED:** modül kaydı var, UI'ı yok.
- `lib/maxai-data.ts` içinde hâlâ mock `BRAIN_STATS` var (Panel ve Ofis gerçek veriye bağlanmış, Brain sekmesi bağlanmamış). Kodun kendi yorumu bunu itiraf ediyor.

### 1.3 Backend / API — CONFIRMED
23 route. `/api/chat` sadece NDJSON zarfı; tüm orkestrasyon `lib/sanchez/core.ts`'te. Bu doğru bir ayrım — taşıyıcıyı değiştirmek (WhatsApp, Telegram, cron) çekirdeği bozmuyor.

Sanchez turu: `observe` (profil + onboarding) → `understand` (son user mesajı) → `retrieve` (hibrit bağlam) → `buildSystemPrompt` → stream + tool döngüsü (`MAX_TOOL_ITERATIONS = 16`) → `done`.

Hata sözleşmesi düzgün: retrieval hatası turu düşürmüyor, tool hatası modele `isError` olarak dönüyor, iterasyon aşımı nazik kapanıyor.

### 1.4 Veritabanı — CONFIRMED
26 tablo, 13 migration:
`profiles, user_profile, memories, modules, modules_order, conversations, messages, habits, habit_logs, journal_entries, journal_questions, library, essays, essay_versions, calendar_events, goals, entities, links, agent_runs, agent_logs, agent_tasks, agent_task_dependencies, agent_task_events, runtime_events, obsidian_sync_index, block_pages`

Çekirdek doğru kurgulanmış: `entities` (embedding'li, tip+scope'lu evrensel düğüm) + `links` (yönlü, kind'lı, strength'li kenar) = graf. `match_entities` RPC'si HNSW üstünden benzerlik sıralamasını DB'de yapıyor — eski "hepsini belleğe çek, JS'te dot product" tasarımı düzeltilmiş. Bu iyi bir karar.

`agent_tasks` şeması ciddi: status/priority CHECK'leri, ayrı dependency tablosu (uuid[] değil), append-only `agent_task_events`, retry sayacı, `scheduled_for`. Job queue'yu Postgres'te tutma kararı doğru; SKIP LOCKED'a geçiş yolu açık bırakılmış.

**MISSING (hedef için kritik):** `workspace`, `organization`, `client`, `project`, `deal`, `lead`, `invoice`, `payment`, `campaign`, `content`, `product`, `order`, `integration`, `credential`, `report`, `metric`. Yani ajans/CRM/finans veri modelinin **tamamı** yok.

### 1.5 Auth / Authorization — CONFIRMED, ve en büyük sorun
- `middleware.ts` **yok**.
- `app/login/page.tsx` → `redirect('/dashboard')`. 5 satır.
- 23 route'ta `getUser()`, `Authorization` header, `CRON_SECRET`, API key kontrolü: **sıfır eşleşme**.
- `lib/supabase-admin.ts` service-role key kullanıyor (anon'a düşmüyor — bu doğru), ama tüm sunucu yolları bunu kullanıyor.
- Kullanıcı kimliği = `profiles` tablosunun **ilk satırı** (`.limit(1).single()`). `lib/sanchez/core.ts` ve `lib/runtime/manager.ts` ikisi de böyle yapıyor.
- RLS politikaları yazılmış ama `auth.uid()` bazlı ve auth olmadığı için fiilen hiçbir şey korumuyorlar. Migration 0008'in kendi yorumu bunu yazıyor: *"gerçek Auth Faz 5'e kadar fiilen korumaz."*

### 1.6 AI katmanı — CONFIRMED
`AIProvider` soyutlaması iyi tasarlanmış: `complete` / `stream` / `embed`, provider-bağımsız tool şeması, capabilities bayrakları, `AIRequest.model` override alanı hazır.

Ama implementasyon **iki** tane: `AnthropicProvider` ve `MockProvider`. Model çeşitliliği = registry'de bazı ajanların `model: 'claude-haiku-4-5'` demesi. Yani:
- **MISSING:** OpenAI, Gemini, Perplexity, görsel/video/ses/OCR modelleri — hiçbiri yok.
- **MISSING:** Görev tipine göre otomatik model seçimi (router). Şu an "hangi model" statik bir registry alanı, bir karar mekanizması değil.
- Embedding lokal ve ücretsiz — akıllı bir seçim, ama aşağıda ölçek sorunu var.

18 custom tool (`read_*`, `save_memory`, `save_goal`, `toggle_habit`, `run_agent`, `delegate_task`, `add_scholarship` vb.) + 4 brain tool + 2 source tool = **24 tool**. Hepsi tek `serverExecuteTool` switch'inden geçiyor. Temiz.

Anthropic server-side web search açık (`webSearch: true`).

### 1.7 Agent katmanı — CONFIRMED
14 kayıtlı ajan:
`ingilizce-genel-plan, ingilizce-planlayici, kesif-arastirmaci, burs-toplu-arastirma, burs-derinlestir, essay-brainstorm, essay-critic` (7'si `department: 'legacy'`, çoğu `toolNames: []` — yani sadece prompt + JSON çıktı, tool erişimi yok)
`knowledge-agent` (6 tool, gerçek çalışıyor)
`growth-agent, creative-agent, builder-agent, client-success-agent, operations-agent` (her biri 3 tool: `brain_get_node`, `brain_link`, `delegate_task`)
`test-agent`

Runner: `agent_runs` satırı açar → provider tur döngüsü → JSON çıktı parse (kod bloğu temizleme + ilk `{` son `}` fallback) → sonuç yazar. Sağlam.

Runtime katmanı (`lib/runtime`, 12 dosya): event bus, agent runtime registry, department runtime, dispatcher, executor, retry, timeout sweep, live state, worker. Worker `setTimeout` zinciri (setInterval değil — tick'ler binmesin diye), tick akışı: timeout süpürme → dispatch → settle.

**Buradaki mimari kusur şu:** `RuntimeManager` bir `globalThis` singleton'ı ve worker süreç-içi yaşıyor. Vercel serverless'ta bu **çalışmaz** — süreç istek arasında ölür. Uzun ömürlü bir Node process (VPS / Railway / Fly / Render) olmadan "AI çalışanlar arka planda çalışıyor" fikri fiziksel olarak imkânsız. Worker'ın manuel start edilmesi (`/api/runtime/worker` POST) bilinçli bir maliyet kararı olarak belgelenmiş ve o kısmı doğru; ama otomatik/zamanlanmış çalışma yolu **yok**.

**MISSING:** cron, scheduler, webhook alıcısı, kalıcı background worker, `scheduled_for` alanını okuyan bir zamanlayıcı (alan var, tetikleyici yok).

### 1.8 İzin modeli — CONFIRMED, ama yaptırımsız
`lib/departments/registry.ts`: 24 tool'un tamamı bir `CapabilityId`'ye eşlenmiş, 6 departman default-deny izin listesiyle tanımlı. Tasarım olarak doğru.

Ama dosyanın kendi başlığı diyor ki: *"gerçek yetkilendirme/Auth bu fazda yok — ihlal, CI'da kırmızı test olarak yakalanır, runtime'da engellenmez."*

Ve CI **yok** (`.github/` dizini mevcut değil). Yani izin modeli ne runtime'da ne CI'da yaptırıma sahip; sadece `npm test`'i elle çalıştırırsan görünür. Dış dünyaya yazma yetkisi olan ajanlar geldiğinde bu kabul edilemez.

`lib/integrations/registry.ts` boş — ve boş olması **bilinçli**: external-write eylemleri `requiresApproval=true` beyan etmek zorunda, bu sözleşme kodda zorlanıyor. Bu, doğru yapılmış ender şeylerden biri. Boş bırakma kararı da doğru.

### 1.9 Memory / Knowledge — CONFIRMED, sistemin en iyi parçası
- Hibrit retrieval: `score = similarity + recencyBoost + graphBoost`. Graf genişletmesi 1-hop komşu getiriyor (journal bulunca bağlı goal geliyor). Over-fetch stratejisi belgelenmiş.
- `memory-engine.ts`: `autoLinkNode` — her yeni düğüm aynı scope'taki en benzer düğümlere otomatik semantic kenar çekiyor. "Hiçbir kayıt yalnız yaşamamalı" ilkesi.
- Episodic/semantic saklama sınıfı vs working/long-term getirim penceresi ayrımı doğru kurulmuş.
- Knowledge pipeline: `ingestion → parse → chunk → normalize → extract → quality → review-queue → brain-relation`. GitHub kaynak okuyucu (`repo-analyzer.ts`, `source-fetcher.ts`) var ve gerçek.
- Obsidian iki yönlü sync (`obsidian_sync_index` tablosu + `obsidian-sync.ts`).

Bu katman gerçekten bir "beyin". Reborn'un savunulabilir farkı burada, ajan sayısında değil.

### 1.10 MCP — MISSING
Kod tabanında MCP client, MCP server, MCP transport, MCP tool bridge **yoktur**. `.claude/` altındaki 200 markdown dosyası `claude-flow` boilerplate'i — senin projenin değil, Claude Code'un agent tanımları. MCP bağlantıların Claude Code oturumunda var, **Reborn'un içinde yok**. Bu ikisi karıştırılmamalı.

### 1.11 Operasyonel durum
| Konu | Durum |
|---|---|
| CI/CD | **MISSING** — `.github/` yok |
| Deployment config | **MISSING** — `vercel.json`, Dockerfile, `.env.example` yok |
| Monitoring / alert | **MISSING** |
| Structured logging | **MISSING** — `console.log` + `agent_logs` tablosu |
| Error tracking (Sentry vb.) | **MISSING** |
| Backup / restore planı | **MISSING** |
| Rate limiting | **MISSING** |
| Secrets yönetimi | `.env.local`, `.gitignore`'da `.env*` var — **temel seviyede doğru** |
| Test | 30 dosya var, otomatik çalışmıyor |
| Ödeme altyapısı | **MISSING** |
| Bildirim sistemi | **MISSING** |
| Mobil / responsive | `use-mobile.ts` hook'u var; **INFERRED:** kısmi responsive, mobil-öncelikli değil |

### 1.12 Teknik borç ve kırılgan noktalar
1. **Repo kökünde çöp dosyalar commit edilmiş:** `,`, `b[1]`, `n.id`, `r.id`, `s.max)` — hepsi 0 byte, kaçak shell komutlarından. `.claude/memory.db` de commit edilmiş.
2. `.claude/` altında 200 markdown, projeyle ilgisiz claude-flow boilerplate'i. Repo'yu 6.8 MB'a şişiriyor ve bir insan repo'ya baktığında sinyal/gürültü oranını mahvediyor. Burs komitesi buna bakacaksa temizle.
3. `lib/db.ts` 864 + `lib/db-server.ts` 840 satır — ikisi de çok büyük, sorumluluk sınırı bulanık.
4. Lokal bge-m3 (570 MB ONNX) Next.js süreci içinde. Localhost'ta bedava ve akıllı; herhangi bir serverless deployment'ta cold start ve bellek açısından ölümcül.
5. Single-tenant varsayımı kodun her yerinde: `profiles` ilk satırı. Sonradan multi-tenant'a geçiş = her tabloya `workspace_id`, her sorguya scope, her RLS politikasının yeniden yazımı.
6. `parseAgentOutput` JSON'u regex/brace-slicing ile ayıklıyor. Çalışır ama kırılgan; structured output / tool-based output daha sağlam olur.
7. `AGENTS.md` Next.js 16 için "node_modules/next/dist/docs'u oku" diyor — Next 16 App Router API'leri eğitim verisinden farklı; bu gerçek bir risk, iyi ki not düşülmüş.
8. TODO/FIXME sayısı: **0**. Bu genelde iyi bir işaret değil — yarım kalan işler koda not düşülmemiş, kafanda duruyor.

---

## 2. MATURITY SKORLARI

| Alan | Skor | Gerekçe |
|---|---:|---|
| Architecture | **62** | Katman ayrımı, provider soyutlaması, event bus, taşıyıcı-bağımsız çekirdek gerçekten iyi. Single-tenant + süreç-içi runtime varsayımı puanı kesiyor. |
| Backend | **55** | 23 route temiz, hata sözleşmesi belgeli. Auth katmanı hiç yok. |
| Frontend | **42** | Sayfalar var, çalışıyor; hâlâ mock veri, eksik modül, tutarlılık denetimi yok. |
| Database | **55** | entity/link/pgvector çekirdeği güçlü. Hedef domain (client/project/finance) tamamen yok. |
| AI capability | **48** | Tek sağlayıcı, tek model ailesi. Soyutlama hazır, çeşitlilik yok. |
| Agent capability | **44** | Gerçek runner + kuyruk + retry var. Ama 14 ajanın 8'i tool'suz prompt kabuğu. |
| MCP capability | **0** | Kodda yok. |
| Automation | **18** | Worker var, tetikleyici yok. Cron yok, webhook yok, event trigger yok. |
| Memory | **62** | Sistemin en güçlü yanı. |
| Knowledge management | **55** | Pipeline gerçek, kaynak çeşitliliği tek (GitHub). |
| Integrations | **5** | Sözleşme var, implementasyon sıfır. |
| Security | **10** | Auth yok. Service-role her yerde. RLS dekoratif. |
| Reliability | **24** | Retry + timeout sweep var; backup, alert, recovery yok. |
| Observability | **18** | `agent_logs` + `runtime_events` iyi başlangıç; dashboard/alert/trace yok. |
| Scalability | **20** | Lokal embedding + süreç-içi worker + tek kullanıcı. |
| UX | **40** | Fonksiyonel, tutarsız, mobil ikincil. |
| Production readiness | **10** | Deploy edilemez. |
| SaaS readiness | **6** | Tenant, billing, onboarding, kullanıcı yönetimi — hiçbiri yok. |
| Agency operations readiness | **4** | Müşteri kavramı veri modelinde mevcut değil. |

### GENEL MMR: **34 / 100**
### SEVİYE: **Advanced MVP (single-user, local-first)**

Neden Production Alpha değil: bir ürünün "alpha" olması için en az bir dış kullanıcıya güvenli biçimde sunulabilmesi gerekir. Auth olmadığı için Reborn bunu yapamaz. Kod kalitesi Production Alpha'ya yakın, güvenlik ve dağıtım durumu Prototype seviyesinde. Ürün, en zayıf halkasından skorlanır.

---

## 3. BÖLÜM 21 — GERÇEK İŞ İÇİN YETERLİLİK

| Alan | Skor | Gerçek durum |
|---|---:|---|
| 1. Freelance işlerim | **6** | `goals` ve `agent_tasks` var; teklif/sözleşme/fatura/deadline/revize kavramı yok. |
| 2. AI ajans müşterileri | **3** | `client` entity'si yok. `lib/company` bir organizasyon şeması, müşteri kaydı değil. |
| 3. Web projeleri | **5** | `builder-agent` var ama 3 tool'u var ve hiçbiri kod yazmıyor. |
| 4. Reklam operasyonları | **0** | Meta/Google Ads bağlantısı yok. |
| 5. Social media | **0** | Yok. |
| 6. E-commerce | **0** | Yok. |
| 7. YouTube | **0** | Yok. |
| 8. İçerik üretimi | **14** | `creative-agent` prompt seviyesinde; görsel/video/ses modeli yok. |
| 9. CRM | **0** | Yok. |
| 10. Finansal takip | **4** | Finans modülü sayfası kodda yok. |

**Ortalama: 3,2 / 100.** Reborn bugün *senin hayatını* takip ediyor, *işini* değil.

---

## 4. HEDEF MİMARİ

```
                        ┌──────────────────────────────┐
   Kanallar             │  Web · WhatsApp · Telegram   │
                        │  Cron · Webhook · E-posta    │
                        └──────────────┬───────────────┘
                                       │  (hepsi aynı çekirdeği çağırır)
                        ┌──────────────▼───────────────┐
   Gateway              │  Auth · Tenant çözümleme     │
                        │  Rate limit · Audit girişi   │
                        └──────────────┬───────────────┘
                        ┌──────────────▼───────────────┐
   Orkestrasyon         │  SANCHEZ CORE                │
                        │  observe→understand→retrieve │
                        │  →plan→delegate→verify       │
                        └───┬──────────┬───────────┬───┘
                            │          │           │
              ┌─────────────▼──┐  ┌────▼─────┐  ┌──▼──────────────┐
   Katmanlar  │ MODEL ROUTER   │  │ MEMORY / │  │ TASK QUEUE      │
              │ claude/gpt/    │  │ BRAIN    │  │ (Postgres)      │
              │ gemini/image/  │  │ entity+  │  │ + kalıcı worker │
              │ video/voice    │  │ link+vec │  │ (VPS, cron'lu)  │
              └────────────────┘  └──────────┘  └──┬──────────────┘
                                                   │
              ┌────────────────────────────────────▼──────────────┐
   Ajanlar    │  Specialist Agents (departman izinleriyle)        │
              │  her run: plan → execute → verify → log → cost    │
              └───────────────────┬───────────────────────────────┘
                                  │
              ┌───────────────────▼───────────────────────────────┐
   Araçlar    │  TOOL / MCP LAYER                                 │
              │  iç tool'lar · MCP client (GitHub, Drive, Stripe, │
              │  Meta, Google Ads, Shopify) · onay kapısı         │
              └───────────────────┬───────────────────────────────┘
                                  │  external-write → İNSAN ONAYI
              ┌───────────────────▼───────────────────────────────┐
   Veri       │  Postgres (RLS, workspace_id her tabloda)         │
              │  Storage (dosyalar) · Vault (müşteri credential)  │
              │  Audit log (append-only) · Metrics                │
              └───────────────────────────────────────────────────┘
```

**Kritik ilkeler:**
1. Her tabloda `workspace_id`, her sorguda RLS. Sonradan eklenemez — şimdi eklenir.
2. Müşteri credential'ları (Meta token, Google Ads, Stripe) uygulama DB'sinde düz metin durmaz. Ayrı vault + envelope encryption.
3. `external-write` eylemleri her zaman insan onayından geçer. Bu kural zaten `lib/integrations`'ta kodlanmış — bozma.
4. Model router bir *fonksiyon* olmalı: `(taskType, contextSize, budget, latencyNeed) → model`. Registry alanı değil.
5. Worker uzun ömürlü bir process'te yaşar. Vercel + serverless worker denemesi zaman kaybı olur.

---

## 5. GAP ANALİZİ (öncelik sırasıyla)

### G1 — Authentication + Tenant izolasyonu · **P0**
- **Mevcut:** Auth yok, kullanıcı = `profiles` ilk satırı, service-role her yerde.
- **Hedef:** Supabase Auth + middleware + her tabloda `workspace_id` + gerçek RLS.
- **Neden:** Bu olmadan deploy edilemez, müşteri verisi tutulamaz, ikinci kullanıcı eklenemez. Diğer her P0 buna bağlı.
- **Teknik çözüm:** `middleware.ts` ile session koruması; her route'ta `getUser()`; `workspaces` + `workspace_members` tabloları; tüm tablolara `workspace_id uuid not null`; RLS'i `auth.uid()` yerine üyelik üzerinden yaz; `supabase-admin` kullanımını sadece worker/sistem yollarına daralt.
- **Complexity:** Yüksek (her tablo + her sorgu). **Bağımlılık:** yok. **Risk:** Migration sırasında veri kaybı — önce yedek al.

### G2 — Kalıcı worker + zamanlama · **P0**
- **Mevcut:** `globalThis` singleton, `setTimeout`, manuel start, süreçle ölür.
- **Hedef:** VPS/Railway'de uzun ömürlü Node worker + cron + `scheduled_for` okuyucu.
- **Neden:** "AI çalışanlar" fikri arka planda çalışma olmadan mevcut değil. Şu an ajanlar sadece sen tıklayınca çalışıyor.
- **Teknik çözüm:** Worker'ı ayrı bir entrypoint'e çıkar (`worker/index.ts`), Railway/Fly'da 1 process; task claim'ini `FOR UPDATE SKIP LOCKED` RPC'sine taşı (şema hazır); web tarafı Vercel'de kalabilir.
- **Complexity:** Orta. **Bağımlılık:** G1 (worker hangi tenant için çalışıyor?). **Risk:** Çift worker → aynı task iki kez; SKIP LOCKED bunu çözer.

### G3 — Runtime izin yaptırımı + audit · **P0**
- **Mevcut:** Departman izinleri sadece testte; CI yok, yani hiçbir yerde.
- **Hedef:** `serverExecuteTool` her çağrıda çağıran ajanın yeteneğini kontrol eder; ihlal loglanır ve reddedilir. Append-only `audit_log`.
- **Neden:** Dış dünyaya yazan ajan geldiği an, prompt injection ile ajanın tool çağırması gerçek para/veri kaybettirir.
- **Teknik çözüm:** `serverExecuteTool(name, input, userId, ctx)` → `ctx.callerAgent` zaten var; `TOOL_CAPABILITIES` + departman izniyle karşılaştır, yoksa fırlat. GitHub Actions ile `npm test` + `npm run lint` her push'ta.
- **Complexity:** Düşük — altyapı hazır, sadece bağlanmamış. **Öncelik burada çok yüksek/maliyet çok düşük.**

### G4 — Client / Project / Money veri modeli · **P1**
- **Mevcut:** Yok.
- **Hedef:** `clients, projects, deliverables, proposals, contracts, invoices, payments, expenses` + bunların workspace'e bağlanması.
- **Neden:** EM Fit'i ve freelance işlerini Reborn'dan yönetmenin ön koşulu. Ajans vizyonunun tamamı buna dayanıyor.
- **Teknik çözüm:** Yeni migration; mevcut `entities` graf çekirdeğine bağla (client ↔ project ↔ task ↔ memory link'leri) — ikinci bir paralel veri dünyası kurma.
- **Complexity:** Orta. **Bağımlılık:** G1.

### G5 — Model router · **P1**
- **Mevcut:** İki provider (anthropic, mock), statik `model` alanı.
- **Hedef:** `OpenAIProvider`, `GeminiProvider` + `routeModel(task)` fonksiyonu.
- **Neden:** Maliyet ve yetenek. Haiku ile yapılacak işi Sonnet'e vermek para yakar; uzun bağlam işini yanlış modele vermek kalite kaybettirir.
- **Teknik çözüm:** `AIProvider` arayüzü zaten hazır — sadece iki sınıf daha yaz ve `getAIProvider()` yerine `getProviderForModel(modelId)` yap. Router'ı basit bir tablo olarak başlat, ML yapma.
- **Complexity:** Düşük-orta. **Risk:** Erken yapılırsa gereksiz; G1-G3'ten sonra.

### G6 — MCP client katmanı · **P1**
- **Mevcut:** Yok.
- **Hedef:** Reborn'un kendi MCP client'ı; GitHub, Drive, Calendar ile başla.
- **Neden:** Ajanların dış dünyaya erişimi. Ama **her MCP'yi bağlama** — her bağlantı bir saldırı yüzeyi.
- **Teknik çözüm:** `@modelcontextprotocol/sdk` client; her MCP sunucusu `lib/integrations` sözleşmesine `ActionExecutor` olarak kaydolsun (external-write → requiresApproval zorunluluğu böylece otomatik uygulanır).
- **Complexity:** Orta. **Bağımlılık:** G3 (izin yaptırımı olmadan MCP bağlamak tehlikeli).

### G7 — Observability · **P1**
- **Mevcut:** `console.log`, `agent_logs`, `runtime_events`.
- **Hedef:** Structured log, Sentry, ajan başına token/maliyet takibi, worker health endpoint.
- **Neden:** Ajanlar arka planda çalışmaya başladığında ne yaptıklarını ve ne kadara mal olduklarını görmezsen kontrol kaybolur.
- **Complexity:** Düşük. **Bağımlılık:** G2.

### G8 — Credential vault · **P1**
- **Mevcut:** Yok.
- **Hedef:** Müşteri API token'ları için şifreli saklama (envelope encryption, per-workspace key).
- **Neden:** Müşterinin Meta Ads token'ını düz metin tutarsan bu hem yasal hem etik bir sorun; tek bir sızıntı işini bitirir.
- **Complexity:** Orta. **Bağımlılık:** G1.

### G9 — CI/CD + backup · **P2**
GitHub Actions (test + lint + build), Supabase otomatik yedek doğrulaması, deploy pipeline.

### G10 — İçerik/medya ajanları (görsel, video, ses), e-ticaret, YouTube pipeline · **P3**
Hepsi vizyon dokümanında var, hiçbiri şu an yapılmamalı. G1-G8 bitmeden bunlara başlamak, temeli olmayan binaya kat çıkmaktır.

---

## 6. ROADMAP

### FAZ 0 — Hijyen (1 hafta)
- Çöp dosyaları sil (`,`, `b[1]`, `n.id`, `r.id`, `s.max)`), `.claude/memory.db`'yi git'ten çıkar
- `.claude/` boilerplate'ini temizle veya `.gitignore`'a al
- `.env.example` ekle, README'yi gerçek kurulum adımlarıyla güncelle
- GitHub Actions: `npm test` + `npm run lint` + `npm run build`
- **Bitiş kriteri:** push → yeşil CI. Repo'ya yabancı biri bakınca ne olduğunu anlıyor.

### FAZ 1 — Güvenlik temeli (2-3 hafta) · **P0**
- Supabase Auth + `middleware.ts` + tüm route'larda oturum kontrolü
- `workspaces` + `workspace_members`; her tabloya `workspace_id`; RLS'i üyelik üzerinden yeniden yaz
- `serverExecuteTool`'da runtime capability kontrolü + `audit_log`
- **Bitiş kriteri:** İnternete deploy edildiğinde giriş yapmayan hiçbir istek veri göremiyor; ikinci bir hesap açıldığında birinin verisi diğerine görünmüyor; yetkisiz tool çağrısı reddedilip loglanıyor.

### FAZ 2 — Kalıcı runtime (2 hafta) · **P0**
- Worker'ı ayrı process'e çıkar, VPS/Railway'e deploy et
- `SKIP LOCKED` claim RPC'si
- Cron: `scheduled_for` okuyucu + günlük/haftalık tetikleyiciler
- Health endpoint + Sentry + token/maliyet logu
- **Bitiş kriteri:** Sen uyurken bir görev planlanıp çalışıyor ve sabah sonucu görüyorsun. Worker düştüğünde haberin oluyor.

### FAZ 3 — İş modeli (3-4 hafta) · **P1**
- `clients, projects, proposals, invoices, payments, expenses` + graf bağlantıları
- EM Fit'i ilk gerçek workspace olarak içeri al
- Basit CRM görünümü: müşteri → projeler → görevler → gelir
- **Bitiş kriteri:** EM Fit ve en az 1 freelance iş tamamen Reborn'dan takip ediliyor; Notion/Excel'e ihtiyacın kalmıyor.

### FAZ 4 — Araç ekosistemi (3-4 hafta) · **P1**
- MCP client + ilk 3 bağlantı (GitHub, Drive, Calendar)
- Credential vault
- Onay kuyruğu UI'ı (ajan dış-yazma isteyince sana düşer)
- **Bitiş kriteri:** Bir ajan takvimine etkinlik ekliyor, sen onaylıyorsun, iz denetlenebilir.

### FAZ 5 — Model çeşitliliği + gerçek ajanlar (4 hafta) · **P1/P2**
- OpenAI + Gemini provider, `routeModel()`
- Mevcut 8 tool'suz ajanı ya gerçek tool'larla donat ya sil
- `builder-agent`'a gerçek yetenek: repo okuma, PR açma
- **Bitiş kriteri:** Bir web projesi görevi ajan tarafından uçtan uca taslak seviyesinde üretiliyor.

### FAZ 6 — Ajans operasyonu (6+ hafta) · **P2**
Lead → teklif → sözleşme → ödeme → proje → görev → QA → teslim → rapor akışı. Reklam/social entegrasyonları burada.

### FAZ 7 — Multi-tenant SaaS (belirsiz) · **P3**
Billing, onboarding, self-serve. FAZ 1'i doğru yaparsan buraya geçiş küçük bir adım olur; yanlış yaparsan yeniden yazım olur.

---

## 7. MİMARİ RİSKLER — BUGÜN YANLIŞ KARAR VERİRSEN

| Karar | İleride çıkacak sorun |
|---|---|
| Multi-tenancy'yi ertelemek | 26 tabloya `workspace_id` sonradan eklemek, her sorguyu ve her RLS politikasını yeniden yazmak. Ne kadar geç, o kadar pahalı. **En büyük risk bu.** |
| Vercel'de serverless worker denemek | Haftalarca çalışmayan şeyi debug edersin. Süreç ömrü sorunu mimaridir, kod hatası değil. |
| Lokal embedding'i production'a taşımak | 570 MB model + cold start. Deploy edeceğin gün ya VPS'e geç ya barındırılan embedding API'sine (Voyage/OpenAI) düş. Soyutlama zaten hazır. |
| Ajan sayısını artırmak | 22 ajan yazmak kolay, hiçbiri iş yapmaz. Şu an 14 ajanın 8'i boş kabuk. Ajan sayısı ilerleme metriği değil; **tool sayısı ve tamamlanmış görev sayısı** metriktir. |
| MCP'yi izin yaptırımından önce bağlamak | Prompt injection ile ajan senin GitHub'ına veya müşterinin reklam hesabına yazar. Geri alınamaz. |
| Müşteri credential'ını düz metin tutmak | Tek sızıntıda hem müşteri hem işin gider. |
| `lib/db.ts`/`db-server.ts` büyümeye devam ederse | 1700 satırlık iki dosya her değişikliği riskli hale getirir. |

---

## 8. AI WORKFORCE PLANI — GERÇEKÇİ VERSİYON

Listendeki 22 ajanı yazma. Ajan, **tool'u olan bir prompt**tır; tool'u yoksa sadece bir prompt'tur ve değeri yoktur.

**Önce şu 5'i gerçek yap** (hepsinin zaten iskeleti var):
1. **Sanchez (Supervisor)** — tek orkestratör. Zaten var, doğru tasarlanmış. Değiştirme.
2. **Knowledge Agent** — zaten en olgun ajan. Kaynak çeşitliliğini artır (web, PDF, YouTube transkript).
3. **Operations Agent** — görev üretimi, deadline takibi, haftalık rapor. Gerçek tool'lar: task CRUD, calendar yazma.
4. **Builder Agent** — repo okuma, kod analizi, PR taslağı. GitHub MCP'ye bağlanır.
5. **Client Success Agent** — müşteri kaydı, iletişim özeti, teslim takibi. G4'ten sonra anlamlı olur.

Diğerlerini (SEO, Meta Ads, Video, Sales...) **ilk gerçek ihtiyaç doğduğunda** yaz. Bir ajanı, o işi elle 3 kez yaptıktan sonra yaz — o zaman ne yapması gerektiğini gerçekten bilirsin.

**Her ajan run'ı için zorunlu iskelet** (bugün eksik olan kısımlar kalın):
plan → execute → **verify** (çıktı sözleşmeye uyuyor mu) → log → **cost kaydı** → **external-write ise insan onayı**

---

## 9. AGENCY OS AKIŞI — HEDEF

```
Lead (form/WhatsApp/manuel)
  → Qualification (Sales Agent: bütçe/ihtiyaç/uygunluk skoru)
  → Proposal (Sanchez taslak → SEN onaylarsın → PDF)
  → Contract + Payment (manuel başlat; Stripe/İyzico sonra)
  → Project açılır (client_id + workspace)
  → Task generation (Operations Agent görevleri üretir)
  → Execution (Builder/Creative/Growth agent + tool'lar)
  → QA (ayrı verify adımı — üreten ajan kendini onaylamaz)
  → Delivery (SEN onaylarsın — external-write kuralı)
  → Reporting (haftalık otomatik özet)
  → Retention (yenileme hatırlatıcısı)
```
Bu akışın **hiçbir adımı** bugün Reborn'da yok. Faz 3 + Faz 6 işi. Ama veri modelini (G4) şimdi doğru kurarsan akış sonradan üstüne oturur.

---

## 10. PRODUCTION READINESS — EKSİK LİSTESİ

| Gereklilik | Durum |
|---|---|
| Auth | ❌ yok |
| Tenant izolasyonu | ❌ yok |
| Yetki yaptırımı (runtime) | ❌ yok |
| Audit log | ❌ yok |
| Secrets/vault | ⚠️ sadece kendi `.env` |
| Backup + restore testi | ❌ yok |
| Monitoring / alert | ❌ yok |
| Error tracking | ❌ yok |
| Rate limiting | ❌ yok |
| CI | ❌ yok |
| Deployment pipeline / rollback | ❌ yok |
| Structured logging | ❌ yok |
| Test coverage ölçümü | ❌ yok (30 test var, kapsam bilinmiyor) |
| Performance bütçesi | ❌ yok |
| Prompt injection savunması | ❌ yok |
| Maliyet limiti / kill switch | ❌ yok |

**16 kalemin 15'i eksik.** Bu, projenin kötü olduğu anlamına gelmiyor — henüz production'a hiç yönelmediği anlamına geliyor.

---

## FINAL MMR: **34 / 100**
**Advanced MVP.** Mimari kalite 60+, güvenlik ve operasyon 10-20 bandında. Aradaki uçurum kapatılabilir ve kapatılması 6-10 haftalık bir iş — yeniden yazım değil.

---

## NEXT 10 MOVES

Sırayla. Atlama.

1. **Bugün commit at.** 51 gündür push yok. Lokalde ne varsa `feat:`/`fix:` ile geçmişe yaz.
2. **Repo hijyeni.** Çöp dosyaları sil, `.claude/` boilerplate'ini `.gitignore`'a al, `.env.example` yaz. `chore: repo temizliği`.
3. **GitHub Actions kur.** `npm test` + `lint` + `build`. Mevcut 30 test bu andan itibaren yaptırıma dönüşür.
4. **`serverExecuteTool`'a capability kontrolü ekle.** Altyapı hazır (`TOOL_CAPABILITIES` + `DEPARTMENTS`), sadece bağlanmamış. En yüksek fayda / en düşük maliyet adımı.
5. **`audit_log` tablosu + her tool çağrısını yaz.** Kim, hangi ajan, hangi tool, hangi girdi, sonuç, süre, token.
6. **Supabase Auth + `middleware.ts`.** Tek kullanıcı olsan bile şimdi ekle — sonradan eklemek 10 kat pahalı.
7. **`workspaces` + `workspace_members` + tüm tablolara `workspace_id`.** RLS'i üyelik üzerinden yeniden yaz. En sıkıcı, en kritik adım.
8. **Worker'ı ayrı process'e çıkar, Railway/Fly'a deploy et.** Cron ekle. Bu andan itibaren "AI çalışan" fiilen var olur.
9. **`clients` + `projects` + `invoices` migration'ı; EM Fit'i içeri al.** Reborn ilk kez gerçek iş verisi taşır.
10. **Sentry + maliyet/token logu + worker health.** Arka planda çalışan sisteme kör kalma.

**1-5 arası: 1-2 hafta.** 6-7: 2-3 hafta. 8-10: 3-4 hafta.
MCP, model router, ajan sayısı, YouTube, e-ticaret — **hepsi bundan sonra.**

---

## SON SÖZ

Reborn'un sorunu yetersizlik değil, **dengesizlik**. Beyin katmanı (memory, retrieval, knowledge) bir Faz-4 ürünü kalitesinde; güvenlik ve operasyon katmanı bir hafta sonu projesi seviyesinde. Vizyon dokümanların (13 departman, 22 ajan, e-ticaret, YouTube) mevcut temelin en az 10 kat üstünde bir yük öngörüyor.

En büyük risk şu: yeni ajan yazmak tatmin edici ve hızlıdır, `workspace_id` migration'ı sıkıcı ve yavaştır. Doğal eğilim ilkine gitmek olacak. Ama 6 ay sonra 30 ajanın olup hâlâ auth'un yoksa, sistemi sıfırdan yazmak zorunda kalırsın.

Sıkıcı olanı önce yap.
