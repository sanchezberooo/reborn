-- ============================================================
-- 0001 — Unified Entity Core
-- pgvector + entities + links + memories evrimi
-- Faz 1, Görev 1. Referans: docs/reborn-master-roadmap.md §1
-- (Mimari İlkeler 1-2), docs/faz0-denetim-raporu.md §2 (şema satırı).
--
-- TASARIM ÖZETİ:
-- * entities çekirdek katmandır ve İKİ modda çalışır:
--   1) NATIVE satır (source_table NULL): esas kaynak entities'in
--      kendisidir. Yeni içerik türleri (Faz 2 goals, notes...)
--      doğrudan burada doğar.
--   2) KÖPRÜ satırı (source_table + source_id dolu): esas kaynak
--      mevcut silo tablodur (journal_entries, essays, habits...).
--      Köprü satırındaki title/content, embedding'in hesaplandığı
--      TÜRETİLMİŞ metindir — arama indeksinin doğası gereği bir
--      kopyadır (tsvector gibi), ikinci doğruluk kaynağı DEĞİLDİR.
--      Senkron, tek veri kapısı lib/db.ts'te yazma anında yapılır.
--   Modüller teker teker taşındıkça köprü satırları native'e
--   dönüşür, silo tablo emekli edilir (strangler-fig; denetim
--   raporu matrisindeki "çekirdek yanına kurulur, aşamalı taşınır"
--   planının uygulaması).
-- * Embedding boyutu 1024 = bge-m3 (LocalEmbeddingProvider, Faz 1).
--   Model değişirse kolon yeni migration ile ALTER edilir.
-- * RLS politikaları baseline'daki desenle aynıdır ve aynı notu
--   taşır: tasarım niyetini belgeler; gerçek Auth session'ı Faz 5'e
--   kadar kurulmadığı için fiilen koruma sağlamaz (0000_baseline
--   başlığındaki RLS notu bu tablolar için de geçerli).
-- ============================================================

-- ── pgvector ────────────────────────────────────────────────
-- Supabase standardı: extension `extensions` şemasına kurulur;
-- `vector` tipi search_path üzerinden nitelenmeden kullanılır.
create extension if not exists vector with schema extensions;

-- ── entities ────────────────────────────────────────────────
-- "Her şey birbirine bağlı" ilkesinin şema hali. user_id'de
-- auth.users FK'si bilinçli olarak yok (bkz. 0000_baseline notu).
create table if not exists public.entities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  -- Tip listesi bilinçli olarak CHECK'li: yeni tip eklemek yeni
  -- migration gerektirir — tip envanteri şemadan okunabilir kalır.
  type         text not null check (type in (
                 'journal', 'goal', 'note', 'project', 'person',
                 'task', 'essay', 'habit', 'resource', 'event'
               )),
  title        text not null,
  -- Native satırda esas içerik; köprü satırında embedding girdisi
  -- olarak türetilmiş metin (esas kaynak silo tablodur).
  content      text,
  embedding    vector(1024),
  -- Köprü referansı: mevcut silo tabloya işaret eder. source_id
  -- text çünkü silo PK'ları heterojen (uuid, text, bileşik).
  source_table text,
  source_id    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((source_table is null) = (source_id is null))
);

-- Aynı silo kaydı için ikinci köprü satırı açılamaz.
create unique index if not exists entities_source_ref_uniq
  on public.entities(source_table, source_id)
  where source_table is not null;

create index if not exists entities_user_type_idx
  on public.entities(user_id, type);

-- Semantik arama: cosine benzerliği (bge-m3 ile standart kullanım).
create index if not exists entities_embedding_idx
  on public.entities using hnsw (embedding vector_cosine_ops);

alter table public.entities enable row level security;

create policy "Users manage own entities"
  on public.entities for all using (auth.uid() = user_id);

-- ── links ───────────────────────────────────────────────────
-- Entity çiftleri arası bağlantı grafı. Tek satır tek kenar;
-- semantik kenarlar kavramsal olarak yönsüzdür — tek satır yazılır,
-- sorguda iki yön de taranır. kind = bağlantının KAYNAĞI:
--   semantic → embedding benzerliğinden otomatik keşif (strength dolu)
--   user     → kullanıcının elle kurduğu bağ (label opsiyonel)
--   wikilink → içerikteki [[...]] referansından (Faz 2 Obsidian import)
create table if not exists public.links (
  id               uuid primary key default gen_random_uuid(),
  source_entity_id uuid not null references public.entities(id) on delete cascade,
  target_entity_id uuid not null references public.entities(id) on delete cascade,
  kind             text not null check (kind in ('semantic', 'user', 'wikilink')),
  -- Kullanıcı tanımlı ilişki adı (ör. "engelliyor", "ilham verdi").
  label            text,
  -- Yalnızca semantik kenarlarda: benzerlik skoru [0, 1].
  strength         real check (strength >= 0 and strength <= 1),
  created_at       timestamptz not null default now(),
  check (source_entity_id <> target_entity_id),
  check (kind = 'semantic' or strength is null),
  unique (source_entity_id, target_entity_id, kind)
);

-- unique constraint (source, target, kind) sol-önek taramasını
-- karşılar; ters yön için ayrı indeks:
create index if not exists links_target_idx
  on public.links(target_entity_id);

alter table public.links enable row level security;

create policy "Users manage own links"
  on public.links for all using (
    exists (
      select 1 from public.entities e
      where e.id = links.source_entity_id and e.user_id = auth.uid()
    )
  );

-- ── memories evrimi ─────────────────────────────────────────
-- Mevcut memories tablosu SİLİNMEZ, yeni modele evrilir (roadmap:
-- "mevcut verinin bu modele migration'ı"). Eski satırlar geçerli
-- kalır; yeni kolonlar NULL başlar, embedding backfill'i ve gerçek
-- memory write davranışı FAZ 1/AI işidir.
--
-- type kolonu hakkında: kanonik taksonomi fact / preference / goal /
-- pattern / emotion (gerçek/tercih/hedef/örüntü/duygu) — FAZ AI
-- memory write bunları kullanacak. CHECK bilinçli olarak YOK:
-- save_memory tool'u bugün modelden gelen serbest değerleri yazıyor
-- ('general', 'user_fact', 'project'...); kısıt eklemek canlı veriyi
-- ve mevcut tool sözleşmesini kırardı. Kısıt, memory write gerçek
-- davranışa geçerken ayrı migration'da eklenir.
alter table public.memories
  add column if not exists embedding vector(1024),
  -- Bu hafıza hangi entity'den/konuşmadan çıkarıldı (kaynak
  -- şeffaflığı — roadmap ilke 5). İkisi de NULL olabilir (eski
  -- kayıtlar, elle girilenler).
  add column if not exists source_entity_id uuid references public.entities(id) on delete set null,
  add column if not exists source_conversation_id uuid references public.conversations(id) on delete set null,
  -- Çıkarımın güveni [0, 1] — Sanchez'in "bundan ne kadar eminim"i.
  add column if not exists confidence real check (confidence >= 0 and confidence <= 1),
  -- "Neden"iyle kaydedilir: bu çıkarımın gerekçesi, kullanıcıya
  -- gösterilebilir metin (roadmap ilke 5 — şeffaflık).
  add column if not exists reason text;

create index if not exists memories_embedding_idx
  on public.memories using hnsw (embedding vector_cosine_ops);

create index if not exists memories_source_entity_idx
  on public.memories(source_entity_id)
  where source_entity_id is not null;
