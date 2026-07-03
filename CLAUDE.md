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

**Stack:** Next.js 16.2.4 (App Router, `dev --webpack`) + React 19 + TypeScript strict + Supabase (Postgres; pgvector/Auth henüz yok) + Tailwind v4 + shadcn-tarzı `components/ui/*` + `@anthropic-ai/sdk` (yalnızca `lib/ai/anthropic.ts` içinde; model: `claude-sonnet-4-6`, ajan/özetleme override: `claude-haiku-4-5`). `openai` bağımlılığı **yok**. Provider seçimi `AI_PROVIDER` env değişkeniyle yapılır (`mock` | `anthropic`; boşsa key varsa anthropic, yoksa mock'a düşer). Test altyapısı Vitest ile kuruldu; migration sistemi `supabase/migrations/` (bkz. §5).

**Klasörler:**

| Klasör | Sorumluluk |
|---|---|
| `app/` | Sayfalar: `/` (Sanchez chat), `/dashboard`, `/gunluk`, `/aliskanlik`, `/takvim`, `/roadmap`, `/notion`, `/essay`, `/burs-akademisi`, `/ingilizce`, `/agent-panel` |
| `app/api/` | Backend'in tamamı (ayrı servis yok): `chat`, `action`, `summarize`, `setup`, `health`, `agents/{list,run,runs,logs}` |
| `components/` | `chat/` (ChatInterface, MiniChat, ortak `useSanchezChat` hook), `office/`, `modules/`, `ui/` (14 primitif), AppShell/Header/Sidebar |
| `lib/` | Çekirdek: `ai/` (AIProvider soyutlaması — `provider.ts`, `anthropic.ts`, `mock.ts`, `local-embedding.ts`, `index.ts` provider seçimi, `tools.ts`), `sanchez-prompt.ts`, `db.ts` (tüm CRUD, tek veri kapısı), `modules.ts`, `agents/` (registry/runner/executor/types), `chat-events.ts`, `supabase*.ts` |
| `supabase/` | `migrations/` — esas kaynak (bkz. §5); `schema.sql` artık yalnızca tarihsel referans |
| `docs/` | Vizyon, roadmap, denetim raporu (bkz. §7) |

**Veri modeli (mevcut):** 17 tablo, tamamı tek-kullanıcı varsayımlı ve **modül-silolu** — `profiles`, `memories` (embedding YOK; retrieval = son 5 kayıt), `conversations` (mesajlar jsonb dizisi), `modules` (jsonb `data` çuvalı), `habits`, `journal_*`, `library`, `agent_runs/logs`, `essays` vb. `entities`/`links` çekirdeği henüz yok (Faz 1 işi). `messages` tablosu LEGACY — yazan kod yok.

**AI çağrı noktaları (tam envanter — başka yerde LLM çağrısı yok):** Üçü de `lib/ai` `getAIProvider()` üzerinden geçer; doğrudan SDK çağrısı yok.
1. `app/api/chat/route.ts` — Sanchez sohbeti: `provider.stream()`, `while(true)` tool döngüsü (route'ta yaşar), 15 tool (`lib/ai/tools.ts`) + `web_search`. System prompt: `lib/sanchez-prompt.ts` `buildSystemPrompt()`.
2. `lib/agents/runner.ts` — ajan çalıştırıcı: `provider.complete()`, JSON-only çıktı sözleşmesi. 8 ajan `lib/agents/registry.ts`'te tanımlı; tool yürütme `lib/agents/executor.ts` `serverExecuteTool()`.
3. `app/api/summarize/route.ts` — sohbet özeti, `provider.complete()` (`claude-haiku-4-5`).

**Streaming protokolü:** `lib/chat-events.ts` — NDJSON olayları `text | tool_start | tool_end | done | error`. İstemci tarafı `components/chat/useSanchezChat.ts`. Bu protokol provider-agnostik ve KORUNACAK; provider değişse de istemci etkilenmez.

**State:** Kütüphane yok; component-local `useState` + `window.dispatchEvent` olay otobüsü (`reborn:new-chat`, `reborn:modules-updated` vb.).

## 4. Hedef Mimari (henüz yok — evrimleşiyoruz)

Aşağıdakiler hedeftir, mevcut kod değildir. Sıfırdan yazım YOK; mevcut kod aşamalı evrimleşir.

- **Unified Entity Model:** Journal, hedef, not, proje, görev — hepsi tek `entities` çekirdeğinden türer; embedding'i ve `links`'i vardır (Faz 1).
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
