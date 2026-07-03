-- ============================================================
-- 0002 — Goals
-- Faz 2, Görev 2. Referans: docs/reborn-master-roadmap.md Faz 2
-- ("Goal sistemi: 'Olmak istediğin kişi' → hedefler → alt hedefler
-- → ölçülebilir ilerleme. Dönüşümün ölçüm birimi.")
--
-- TASARIM ÖZETİ:
-- * Goals, migration 0001'in NATIVE moduyla yaşar: her goal bir
--   entities satırıdır (type='goal', source_table NULL) — title ve
--   description (entities.content) için esas kaynak entities'in
--   KENDİSİDİR. Journal'daki köprü deseni burada BİLİNÇLİ olarak
--   kullanılmaz: köprü, mevcut silo tabloları bozmadan bağlamak
--   içindir; yeni doğan içerik için yeni silo açmak 0001 başlığının
--   reddettiği "kalıcı çift-kaynak"ı yaratırdı.
-- * Bu tablo entity'nin goal'a özgü YAPISAL UZANTISIDIR (1:1):
--   hiyerarşi, tarih ve ilerleme alanları vektörlenecek metin değil,
--   sorgulanacak veridir — entities'e genel kolon eklemek yerine
--   tip-özel uzantı tablosu açılır (ileriki tipler için de desen bu).
-- * id = entities.id (PK ve FK aynı anda). Entity silinince uzantı
--   cascade ile düşer; alt hedeflerin parent_goal_id'si SET NULL ile
--   boşalır — ebeveyni silmek çocukları SİLMEZ, kök hedefe çevirir
--   (kullanıcı verisi kullanıcıya aittir; zincirleme silme sürprizi
--   yaşatılmaz, çocuklar tek tek bilinçli silinir).
-- * Alt-hedef ilişkisi ayrıca links grafına yazılır (kind='user',
--   label='sub-goal-of', kaynak=çocuk, hedef=ebeveyn — lib/db-server
--   saveGoal). parent_goal_id sorgu/nesne modeli için, links satırı
--   retrieval'ın graf genişletmesi için: hedefle ilgili sorguda alt
--   hedefler de birlikte gelir ("her şey birbirine bağlı").
-- * RLS politikası baseline desenidir ve aynı notu taşır: tasarım
--   niyetini belgeler; gerçek Auth Faz 5'e kadar fiilen korumaz.
-- ============================================================

create table if not exists public.goals (
  -- entities satırının uzantısı: PK = FK. Native entity (type='goal').
  id              uuid primary key references public.entities(id) on delete cascade,
  user_id         uuid not null,
  -- Alt hedef: ebeveyn goal. Ebeveyn silinince çocuk kök hedef olur.
  parent_goal_id  uuid references public.goals(id) on delete set null,
  target_date     date,
  status          text not null default 'active' check (status in (
                    'active', 'paused', 'completed', 'abandoned'
                  )),
  -- İlerlemenin ölçüm biçimi:
  --   binary     → yapıldı/yapılmadı (progress_value 0 veya 100)
  --   percentage → elle girilen yüzde
  --   milestone  → alt hedeflerin tamamlanmasından türetilen yüzde
  --                (türetme kod tarafında; DB yalnız son değeri tutar)
  progress_type   text not null default 'binary' check (progress_type in (
                    'binary', 'percentage', 'milestone'
                  )),
  -- Tüm tipler 0-100 aralığına normalize edilir — UI tek ölçekten okur.
  progress_value  real not null default 0 check (progress_value >= 0 and progress_value <= 100),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (parent_goal_id is null or parent_goal_id <> id)
);

create index if not exists goals_user_idx on public.goals(user_id);

create index if not exists goals_parent_idx
  on public.goals(parent_goal_id)
  where parent_goal_id is not null;

alter table public.goals enable row level security;

create policy "Users manage own goals"
  on public.goals for all using (auth.uid() = user_id);
