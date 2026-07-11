-- ============================================================
-- 0005 — Agent Brain: scope / layer / status genişletmesi
-- Referans: iki-mantıksal-Brain mimari kararı — Personal Brain
-- (scope='personal', Sanchez + kullanıcı) ve Agent Brain
-- (scope='agent', MAXAİ ajanları) AYNI fiziksel altyapıyı
-- (entities + links, aynı graf/arama motoru) paylaşır; ayrım
-- yalnızca `scope` kolonudur.
--
-- TASARIM ÖZETİ:
-- * TAMAMEN ADDITIVE: mevcut kolonlara/CHECK'lere dokunulmaz,
--   yalnız genişletilir. Mevcut TÜM satırlar DEFAULT'larla geriye
--   dönük 'personal' scope'a düşer — Personal Brain'in davranışı
--   bire bir korunur, hiçbir mevcut yazma yolu değişiklik
--   gerektirmez.
-- * entities.type genişletmesi: Agent Brain node tipleri eklenir.
--   'signal' sıcak katman (hot) girişidir — herkes yazabilir;
--   kalan 7 tip soğuk katmandır (cold) ve yalnız "privileged"
--   entegrasyon yoluyla yazılır. NOT: bu ayrım yalnız kod
--   düzeyinde yapısaldır — gerçek erişim kontrolü (Auth/RLS
--   session'ı) bu fazda YOK (0000_baseline RLS notu geçerli).
-- * links.kind genişletmesi: Agent Brain'in 9 ilişki tipi eklenir.
--   Şemadaki kolon adı `kind`tır (0001'deki semantic/user/wikilink
--   üçlüsü); Agent Brain ilişki tipleri aynı kolonda yaşar — ayrı
--   kolon açmak aynı kavram için ikinci bir eksen yaratırdı.
--   Mevcut `check (kind = 'semantic' or strength is null)` kısıtı
--   olduğu gibi kalır: yeni tiplerin strength'i zaten NULL'dur.
-- * status değerleri bilinçli Türkçe (ürün dili): gözlemlenen →
--   aday → doğrulanmış → güvenilir; eskimiş = supersedes ile
--   işaretlenen node (bilgi SİLİNMEZ, eskitilir).
-- * last_verified_at DEFAULT now(): mevcut personal satırlar da
--   bu değeri alır — bu kolonlar Agent Brain semantiğidir,
--   Personal Brain okuma/yazma yolları bunlara bakmaz.
-- ============================================================

-- ── entities.type CHECK genişletmesi ────────────────────────
-- 0001'deki inline CHECK'in adı Postgres tarafından üretildi;
-- ada güvenmek yerine tanımından bulunup düşürülür (idempotent —
-- yeniden çalıştırmada kendi eklediğimizi düşürüp yeniden kurar).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.entities'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%type = ANY%'
  loop
    execute format('alter table public.entities drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.entities add constraint entities_type_check check (type in (
  -- Mevcut 10 tip (0001) — aynen korunur:
  'journal', 'goal', 'note', 'project', 'person',
  'task', 'essay', 'habit', 'resource', 'event',
  -- Agent Brain tipleri: 'signal' sıcak katman; kalanlar soğuk katman.
  'fact', 'skill', 'pattern', 'workflow', 'standard',
  'tool_reference', 'learning_record', 'signal'
));

-- ── entities yeni kolonlar ──────────────────────────────────
-- DEFAULT'lar kritik: mevcut tüm satırlar geriye dönük
-- scope='personal' sayılır — Personal Brain bozulmaz.
alter table public.entities
  add column if not exists scope text not null default 'personal'
    check (scope in ('personal', 'agent')),
  add column if not exists layer text not null default 'cold'
    check (layer in ('hot', 'cold')),
  add column if not exists status text not null default 'doğrulanmış'
    check (status in ('gözlemlenen', 'aday', 'doğrulanmış', 'güvenilir', 'eskimiş')),
  add column if not exists confidence_count int not null default 0,
  add column if not exists last_verified_at timestamptz not null default now();

-- ── links.kind CHECK genişletmesi ───────────────────────────
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.links'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%kind = ANY%'
  loop
    execute format('alter table public.links drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.links add constraint links_kind_check check (kind in (
  -- Mevcut 3 tip (0001) — aynen korunur:
  'semantic', 'user', 'wikilink',
  -- Agent Brain'in 9 ilişki tipi:
  'derived_from', 'validated_by', 'composed_of', 'supersedes', 'contradicts',
  'applies_to', 'enables', 'resulted_in', 'related_to'
));

-- ── Index ───────────────────────────────────────────────────
-- Agent Brain sorguları (scope='agent', type=...) Personal Brain
-- satırlarını taramasın diye bileşik indeks.
create index if not exists entities_scope_type_idx
  on public.entities(scope, type);
