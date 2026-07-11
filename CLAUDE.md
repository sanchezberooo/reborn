@AGENTS.md

# REBORN — Claude Code Anayasası

## 1. Proje Özeti

Reborn, tek bir kullanıcı (Bero) için inşa edilen kişisel bir **Life Operating System**: journal, hedefler, alışkanlıklar ve tüm yaşam verisi tek bağlantılı hafızada toplanır. **Sanchez**, bu sistemin kullanıcıya dönük tek AI muhatabıdır — mentor kimlikli, soru soran, hatırlayan bir karakter. Temel soru: **"Kim olmak istiyorsun ve AI buna nasıl yardım eder?"** Çekirdek ürün modüller değil, hafıza katmanıdır. Tek referans doküman: `docs/reborn-master-roadmap.md` (v1.1).

## 2. Değişmez Filtreler

Her özellik/karar şu 5 filtreden geçmek zorundadır; geçemiyorsa Reborn'da yeri yoktur:

1. Bu iş temel soruya hizmet ediyor mu? ("Kim olmak istiyorsun ve AI buna nasıl yardım eder?")
2. Tek muhatap Sanchez ilkesini koruyor mu?
3. Veri tek kaynakta ve bağlantılı mı?
4. Kontrol ve güven kullanıcıda mı?
5. Yüzey sade, güç arka planda mı?

## 3. Mevcut Yapı Haritası

**Stack:** Next.js 16.2.4 (App Router, `dev --webpack`) + React 19 + TypeScript strict + Supabase (Postgres + pgvector; Auth henüz yok) + Tailwind v4 + shadcn-tarzı `components/ui/*` + `@anthropic-ai/sdk` (yalnızca `lib/ai/anthropic.ts` içinde; model: `claude-sonnet-4-6`, ajan/özetleme override: `claude-haiku-4-5`). `openai` bağımlılığı **yok**. Provider seçimi `AI_PROVIDER` env değişkeniyle yapılır (`mock` | `anthropic`; boşsa key varsa anthropic, yoksa mock'a düşer). Test altyapısı Vitest ile kuruldu; migration sistemi `supabase/migrations/` (bkz. §5).

**Klasörler:**

| Klasör | Sorumluluk |
|---|---|
| `app/` | Sayfalar — ana nav 4 bölüm: `/` (Sanchez chat), `/dashboard`, `/maxai` (alt sekmeler: `ofis`/`panel`/`brain`), `/brain`. Diğer route'lar: `/gunluk`, `/aliskanlik`, `/takvim`, `/roadmap`, `/notion`, `/essay`, `/hedefler`, `/burs-akademisi`, `/ingilizce`, `/login`. (`/agent-panel` KALDIRILDI — işlevi `/maxai/panel`'de.) |
| `app/api/` | Backend'in tamamı (ayrı servis yok): `chat`, `action`, `summarize`, `search`, `setup`, `health`, `goals`, `journal`, `onboarding`, `obsidian/sync`, `agents/{list,run,runs,logs}` |
| `components/` | `chat/` (ChatInterface, MiniChat, ortak `useSanchezChat` hook), `maxai/` (Panel + `office/OfficeLayout` — gerçek agent_runs verisiyle), `modules/`, `ui/` (14 primitif), AppShell/AppNav/Sidebar |
| `lib/` | Çekirdek: `ai/` (AIProvider soyutlaması — `provider.ts`, `anthropic.ts`, `mock.ts`, `local-embedding.ts`, `retrieval.ts` (hibrit retrieval), `chat-context.ts` (chat bağlamı), `index.ts` provider seçimi, `tools.ts`), `sanchez-prompt.ts`, `db.ts` (istemci CRUD) + `db-server.ts` (entity çekirdeği yazma yolu, server-only), `modules.ts`, `agents/` (registry/runner/executor/types), `chat-events.ts`, `supabase*.ts` |
| `supabase/` | `migrations/` — esas kaynak (bkz. §5); `schema.sql` artık yalnızca tarihsel referans |
| `docs/` | Vizyon, roadmap, denetim raporu (bkz. §7) |

**Veri modeli (mevcut):** 17 silo tablo, tamamı tek-kullanıcı varsayımlı — `profiles`, `memories`, `conversations` (mesajlar jsonb dizisi), `modules` (jsonb `data` çuvalı), `habits`, `journal_*`, `library`, `agent_runs/logs`, `essays` vb. `messages` tablosu LEGACY — yazan kod yok. **Faz 1 çekirdeği CANLIDA** (migration `0001_unified_entity_core`, 2026-07-03): pgvector aktif (`extensions` şeması); `entities` (`type` CHECK'li: journal|goal|note|project|person|task|essay|habit|resource|event, `embedding vector(1024)` bge-m3, `source_table`+`source_id` köprüsü, HNSW cosine indeks), `links` (`kind`: semantic|user|wikilink, `label`, `strength` [0,1] yalnız semantic), `memories`'e eklenen `embedding`/`source_entity_id`/`source_conversation_id`/`confidence`/`reason` kolonları. **Entity çekirdeği yazma/okuma yolları CANLI** (`lib/db-server.ts`): journal köprü senkronu (`saveJournalEntry`), goals NATIVE modda (migration 0002), Obsidian vault senkronu tamamlandı (migration 0004, `syncObsidianVault`), `save_memory` tool'u memories silo insert'ine ek olarak köprü entity yazıyor (`saveMemory`, type='note', source_table='memories'). Hibrit retrieval (`lib/ai/retrieval.ts`: semantik + link grafı + recency) hem `/api/search`'e hem CHAT BAĞLAMINA bağlı — `app/api/chat/route.ts` kullanıcının son mesajıyla `lib/ai/chat-context.ts` `buildChatContext()`'i çağırır (~2000 token bütçe); "son 5 memories" dönemi kapandı. Eski `memories` satırlarının entities backfill'i henüz yapılmadı (ayrı görev).

**AI çağrı noktaları (tam envanter — başka yerde LLM çağrısı yok):** Üçü de `lib/ai` `getAIProvider()` üzerinden geçer; doğrudan SDK çağrısı yok.
1. `app/api/chat/route.ts` — Sanchez sohbeti: `provider.stream()`, `while(true)` tool döngüsü (route'ta yaşar), 17 tool (`lib/ai/tools.ts`) + `web_search`. System prompt: `lib/sanchez-prompt.ts` `buildSystemPrompt()` — bağlamı hibrit retrieval besler (`lib/ai/chat-context.ts`).
2. `lib/agents/runner.ts` — ajan çalıştırıcı: `provider.complete()`, JSON-only çıktı sözleşmesi. 8 ajan `lib/agents/registry.ts`'te tanımlı; tool yürütme `lib/agents/executor.ts` `serverExecuteTool()`.
3. `app/api/summarize/route.ts` — sohbet özeti, `provider.complete()` (`claude-haiku-4-5`).

**Streaming protokolü:** `lib/chat-events.ts` — NDJSON olayları `text | tool_start | tool_end | done | error`. İstemci tarafı `components/chat/useSanchezChat.ts`. Bu protokol provider-agnostik ve KORUNACAK; provider değişse de istemci etkilenmez.

**State:** Kütüphane yok; component-local `useState` + `window.dispatchEvent` olay otobüsü (`reborn:new-chat`, `reborn:modules-updated` vb.).

## 4. Hedef Mimari (evrimleşiyoruz)

Sıfırdan yazım YOK; mevcut kod aşamalı evrimleşir. Aşağıda durumu belirtilmeyen maddeler hedeftir, mevcut kod değildir.

- **Unified Entity Model:** Şema CANLIDA — detay §3, kaynak `supabase/migrations/0001_unified_entity_core.sql`. Yeni entity tipi eklemek = yeni migration (CHECK listesi genişletilir). `memories.type`'ta CHECK bilinçli YOK (save_memory tool'u serbest değer yazıyor); kanonik taksonomi fact/preference/goal/pattern/emotion, kısıt FAZ AI'da gelir. Faz 1'in köprü senkronu, lokal embedding pipeline'ı (bge-m3) ve hibrit retrieval'ı TAMAMLANDI (detay §3); kalan işler: hafıza görünürlüğü UI'ı, eski `memories` verisinin entities backfill'i.

  **Köprü kararı (gerekçe):** `entities` bir üst-katman indeks olarak başlar ve zamanla esas kaynağa evrilir (strangler-fig). Mevcut silo tablolar bozulmaz: her kayıt `(source_table, source_id)` ile entities'te bir köprü satırıyla temsil edilir; köprü satırındaki title/content, embedding'in hesaplandığı türetilmiş metindir — arama indeksinin doğası gereği bir kopyadır (tsvector'ün kopya olması gibi), ikinci bir doğruluk kaynağı değildir; esas kaynak silo tablo kalır ve senkron tek veri kapısı `lib/db.ts`'te yazma anında yapılır. Yeni doğan içerik (Faz 2 goals, notes) `source_table` NULL ile doğrudan entities'te yaşar — orada esas kaynak entities'in kendisidir. Böylece iki uç da reddedilir: büyük-patlama taşıma (roadmap'in yasakladığı yeniden yazım) ve kalıcı çift-kaynak. Denetim raporu matrisindeki plan budur: çekirdek yanına kurulur, modüller teker teker taşınır, taşınan modülün köprü satırları native'e dönüşür ve silo tablosu emekli edilir.
- **AIProvider soyutlaması:** `complete()` / `stream()` / `embed()` interface'i; `AnthropicProvider`, `LocalEmbeddingProvider` (bge-m3, Faz 1), `MockProvider` (deterministik senaryo fixture'ları — API'siz uçtan uca geliştirme). Dosya planı: denetim raporu §4.2'deki `lib/ai/` yapısı (`provider.ts`, `anthropic.ts`, `mock.ts`, `local-embedding.ts`, `index.ts`, `tools.ts`). Provider seçimi env ile: `AI_PROVIDER=mock|anthropic`.
- **Memory pipeline:** Retrieval = semantik arama + link grafı + recency ağırlığı; memory write = konuşmadan yapılandırılmış çıkarım (gerçek davranışı FAZ AI'da).

## 5. Kod Standartları

- **TypeScript strict** — `as unknown as` gibi cast hack'leri ekleme; mevcuttakiler refactor'de temizlenecek.
- **Adlandırma:** `lib/` dosyaları kebab-case (`sanchez-prompt.ts`, `chat-events.ts`); component dosyaları PascalCase (`ChatInterface.tsx`), `components/ui/*` primitifleri lowercase (shadcn geleneği); fonksiyonlar camelCase (`buildSystemPrompt`); hook'lar `use` önekli; DB tablo/kolonları snake_case; route'lar Türkçe küçük harf (`/gunluk`, `/aliskanlik`).
- **Secret'lar yalnız env üzerinden** (`process.env.*`, `.env.local`). Kaynak koda asla key/URL sabitleme; yanıtlarda key parçası basma.
- **Her görev tek odaklı commit** — ilgisiz dosyaya dokunma, "hazır elim değmişken" değişikliği yapma.
- **Migration'sız şema değişikliği yasak.** Her şema değişikliği `supabase/migrations/` altında yeni bir dosya olarak yazılır ve Supabase MCP `apply_migration` ile uygulanır; `schema.sql`'i elle düzenleme.
- Veri erişimi `lib/db.ts` katmanından; sayfadan doğrudan `supabase` import etme.

## 6. Çalışma Kuralları

- **İstenmemiş özellik ekleme.** Görev neyi söylüyorsa o; kapsam genişletme.
- **Emin olmadığını koddan doğrula, varsayma.** Bu doküman dahil — kod her zaman esas kaynaktır.
- Her görevde önce ilgili dosyaları oku, sonra değiştir.
- **`<REBORN_ACTION>` protokolü ÖLÜDÜR** — yeni kodda asla kullanma, örnek alma. Parse yolu kaldırıldı (`useSanchezChat.ts`, `lib/modules.ts`). `ActionType`/`dbExecuteAction` mekanizmasının kendisi ölü DEĞİL — `/ingilizce` ve `/burs-akademisi` doğrudan çağırıyor.
- **Özetleme dahil tüm LLM çağrıları ileride AIProvider üzerinden geçecek** — yeni doğrudan Anthropic/OpenAI API çağrısı ekleme.
- **Next.js 16 kullanıyoruz; breaking change'ler var.** Framework davranışından emin olmadığında `node_modules/next/dist/docs/` altındaki dokümanları oku.
- **İngilizce modülü tekilleştirildi:** `/ingilizce` tek implementasyon. `components/modules/EnglishModule.tsx` (erişilemez/ölüydü) kaldırıldı.
- **Bilinen çelişki:** Sanchez promptu "onay bekleme" diyor, roadmap "öneri + onay" ilkesini koyuyor. FAZ AI kalibrasyonunda çözülecek — şimdilik iki tarafı da değiştirme.

## 7. Referans Dokümanlar (`docs/`)

| Dosya | Ne zaman oku |
|---|---|
| `reborn-master-roadmap.md` | **Tek referans** — her fazın kapsamı, başarı kriterleri, değişmez filtreler. Yeni göreve başlarken. |
| `faz0-denetim-raporu.md` | Mevcut kodun tam haritası, koru/refactor/yeniden-yaz matrisi, AIProvider geçiş planı (§4.2). Mevcut yapıya dokunan her görevde. |
| `reborn-vision.md` | Ürün vizyonu ve ilkeler. Bir kararın "ruhundan" emin olamadığında. |
| `kisisel-arsiv.md` | Bero'nun kişisel bağlamı. Sanchez karakteri/prompt işlerinde. |
| `roadmap.md` | ESKİ roadmap — güncel değil, referans alma; master-roadmap esastır. |
