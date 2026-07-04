-- ============================================================
-- 0004 — Obsidian Vault Senkron İndeksi
-- Faz 2, Görev 5. Referans: docs/reborn-master-roadmap.md Faz 2
-- ("Import v1 — Obsidian vault senkronu").
--
-- TASARIM ÖZETİ:
-- * Notlar 0001'in NATIVE modunda yaşar: her .md dosyası bir entities
--   satırıdır (type='note', source_table NULL) — goals'daki desenle
--   aynı (0002_goals.sql): esas kaynak entities'in kendisidir, ikinci
--   bir silo tablo açılmaz.
-- * Ama Obsidian notlarının GERÇEK esas kaynağı disktir (dosya Obsidian'da
--   düzenlenir, Reborn yalnız aynasını tutar) — goals'ın aksine burada
--   "hangi entity hangi dosyaya karşılık geliyor" bilgisi hâlâ gereklidir:
--   yeniden senkronda güncelleme/silme kararı bu eşlemeye bakar. entities.
--   source_table'ı bunun için KULLANILMAZ (talimat gereği NULL kalır) —
--   çünkü o kolon "mevcut silo tabloya köprü" anlamına gelir ve bu tabloda
--   yaşayan tip-özel bir uzantı değildir; bu yalnızca içe aktarımın kendi
--   defteridir (modules_order'ın modül sırasını tutması gibi bağımsız bir
--   bookkeeping tablosu).
-- * Bu ayrım şunu ÇÖZER: entities.type='note' altında ileride Obsidian
--   dışı (elle oluşturulan) not doğarsa, senkron yalnız BU tabloda kayıtlı
--   yolları takip ettiği için o notu yanlışlıkla silmez/üzerine yazmaz.
-- * vault_path PK: aynı yol için ikinci kayıt açılamaz (idempotent upsert
--   anahtarı). Dosya taşınması/yeniden adlandırılması bilinçli olarak
--   silme+yaratma sayılır (Obsidian'ın kendisi de vault-genelinde tekil
--   dosya adı varsayar).
-- * RLS notu diğer tablolarla aynıdır (bkz. 0000_baseline): tasarım
--   niyetini belgeler, gerçek Auth Faz 5'e kadar fiilen korumaz.
-- ============================================================

create table if not exists public.obsidian_sync_index (
  vault_path text primary key,
  entity_id  uuid not null references public.entities(id) on delete cascade,
  user_id    uuid not null,
  synced_at  timestamptz not null default now()
);

create index if not exists obsidian_sync_index_user_idx
  on public.obsidian_sync_index(user_id);

alter table public.obsidian_sync_index enable row level security;

create policy "Users manage own obsidian sync index"
  on public.obsidian_sync_index for all using (auth.uid() = user_id);
