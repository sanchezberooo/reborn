-- ============================================================
-- Reborn — Supabase Schema
-- Supabase Dashboard > SQL Editor'da çalıştır
-- ============================================================
--
-- BU DOSYA 2026-07-02'de canlı Supabase projesine karşı DOĞRULANDI:
-- PostgREST'in OpenAPI/şema önbelleğine anon key ile sütun bazlı
-- sorgular atılarak her tablonun GERÇEKTEN var olan sütunları
-- teyit edildi (bkz. REBORN-DURUM-RAPORU.md §6 ve commit notu).
-- Kod tabanının kullandığı ama önceki sürümde eksik olan 12 tablo
-- eklendi; profiles/messages/block_pages sütunları canlı DB'ye göre
-- düzeltildi (örn. profiles.ielts_date değil ielts_exam var).
--
-- ÖNEMLİ — auth.users bağımlılığı hakkında:
-- roadmap.md "Auth kaldırma, tek kullanıcı" kararını Faz 1'de
-- tamamlandı olarak işaretliyor. Bu yüzden bu şemada user_id/id
-- kolonları `auth.users(id)` FOREIGN KEY'i İLE KISITLANMIYOR ve
-- kendi `default gen_random_uuid()` değerlerini üretiyor — /api/setup
-- route'unun `insert({})` ile boş bir profil satırı oluşturabilmesi
-- (id default'suz + auth.users FK'li olsaydı bu başarısız olurdu)
-- bunu zaten fiilen doğruluyor. Canlı DB'de hâlâ eski FK duruyorsa
-- bu dosya onunla çelişebilir — uygulamadan ayrıca doğrulanmalı.
--
-- ÖNEMLİ — RLS durumu hakkında (bkz. rapor §6 madde 2):
-- Bu dosyadaki `auth.uid() = user_id` politikaları uygulamanın
-- TASARIM NİYETİNİ belgeler, ama gerçek Supabase Auth session'ı
-- hiç kurulmadığı için (login sayfası redirect'ten ibaret) ve
-- sunucu route'ları anon/service-role key ile auth session'sız
-- bağlandığı için bu politikalar PRATİKTE hiçbir isteği reddetmiyor
-- olabilir. Canlı test sonucu (2026-07-02, anon key ile):
-- memories/modules/conversations/habits/... tablolarından anon key
-- ile SATIR DÖNDÜĞÜ doğrulandı — yani RLS şu an fiilen koruma
-- SAĞLAMIYOR. Bu maddenin düzeltilmesi ayrı bir görevdir.
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
-- Tek kullanıcı (Bero). auth.users FK'i yok — bkz. yukarıdaki not.
create table if not exists public.profiles (
  id                   uuid primary key default gen_random_uuid(),
  name                 text default 'Bero',
  age                  int  default 18,
  location             text default 'İstanbul',
  goal                 text default 'Tam burslu CS okumak - ABD/Kanada/Avrupa',
  ielts_target         text default '7.0+',
  ielts_exam           text default 'Eylül 2026',
  project              text default 'Reborn - AI Life OS',
  application_deadline text default 'Kasım 2026',
  universities         text[] default '{}',
  strengths            text[] default '{}',
  weaknesses           text[] default '{}',
  updated_at           timestamptz not null default now()
);

-- RLS disabled: single-user app, no auth session required.
-- alter table public.profiles enable row level security;

-- ── memories ────────────────────────────────────────────────
create table if not exists public.memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  summary    text not null,
  content    text,
  type       text default 'general',
  tags       text[] default '{}',
  importance smallint default 5,
  date       text not null,
  created_at timestamptz not null default now()
);

alter table public.memories enable row level security;

create policy "Users manage own memories"
  on public.memories for all using (auth.uid() = user_id);

create index if not exists memories_user_id_idx on public.memories(user_id);

-- ── modules ─────────────────────────────────────────────────
create table if not exists public.modules (
  id         text not null,
  user_id    uuid not null,
  name       text not null,
  icon       text not null default '📦',
  color      text not null default '#c8a96e',
  data       jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.modules enable row level security;

create policy "Users manage own modules"
  on public.modules for all using (auth.uid() = user_id);

create index if not exists modules_user_id_idx on public.modules(user_id);

-- ── modules_order ───────────────────────────────────────────
-- lib/db.ts dbSaveModuleOrder / dbLoadModuleOrder — modül kart sırası.
create table if not exists public.modules_order (
  user_id    uuid primary key,
  order_data jsonb not null default '[]'
);

alter table public.modules_order enable row level security;

create policy "Users manage own module order"
  on public.modules_order for all using (auth.uid() = user_id);

-- ── conversations ───────────────────────────────────────────
-- lib/db.ts — Sanchez sohbet geçmişi. id istemci tarafında
-- (crypto.randomUUID()) üretiliyor, upsert onConflict: 'id'.
create table if not exists public.conversations (
  id         uuid primary key,
  user_id    uuid not null,
  title      text not null default 'Sohbet',
  messages   jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "Users manage own conversations"
  on public.conversations for all using (auth.uid() = user_id);

create index if not exists conversations_user_id_idx on public.conversations(user_id);

-- ── messages ────────────────────────────────────────────────
-- LEGACY: kod tabanında hiçbir yazma yolu bulunamadı (yalnızca
-- app/api/health/route.ts varlığını kontrol ediyor). Gerçek sohbet
-- kalıcılığı `conversations` tablosu üzerinden yapılıyor. Canlı
-- DB'de doğrulanan sütunlar: session_id DEĞİL, conversation_id var.
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  conversation_id uuid,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users manage own messages"
  on public.messages for all using (auth.uid() = user_id);

create index if not exists messages_user_id_idx on public.messages(user_id);

-- ── habits ──────────────────────────────────────────────────
create table if not exists public.habits (
  id          text not null,
  user_id     uuid not null,
  name        text not null,
  emoji       text not null default '✅',
  order_index int not null default 0,
  active      boolean not null default true,
  primary key (user_id, id)
);

alter table public.habits enable row level security;

create policy "Users manage own habits"
  on public.habits for all using (auth.uid() = user_id);

-- ── habit_logs ──────────────────────────────────────────────
-- onConflict: 'user_id,date,habit_id' (lib/db.ts dbToggleHabitLog)
create table if not exists public.habit_logs (
  user_id   uuid not null,
  date      date not null,
  habit_id  text not null,
  completed boolean not null default true,
  primary key (user_id, date, habit_id)
);

alter table public.habit_logs enable row level security;

create policy "Users manage own habit logs"
  on public.habit_logs for all using (auth.uid() = user_id);

create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, date);

-- ── journal_questions ───────────────────────────────────────
-- Paylaşılan soru bankası, kullanıcıya özel değil.
create table if not exists public.journal_questions (
  id       text primary key,
  question text not null
);

-- ── journal_entries ─────────────────────────────────────────
-- onConflict: 'user_id,date' (lib/db.ts dbSaveJournalEntry)
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  date        date not null,
  mood        smallint,
  day_score   smallint,
  question_1  text,
  answer_1    text,
  question_2  text,
  answer_2    text,
  free_write  text,
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.journal_entries enable row level security;

create policy "Users manage own journal entries"
  on public.journal_entries for all using (auth.uid() = user_id);

create index if not exists journal_entries_user_date_idx on public.journal_entries(user_id, date);

-- ── user_profile ────────────────────────────────────────────
-- Anahtar-değer profil eklentisi (lib/agents/executor.ts
-- update_profile / read_profile tool'ları). onConflict: 'key'
-- (kod tek kullanıcı varsayıyor — key tek başına unique).
create table if not exists public.user_profile (
  key        text primary key,
  value      text not null,
  user_id    uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.user_profile enable row level security;

create policy "Users manage own profile kv"
  on public.user_profile for all using (auth.uid() = user_id);

-- ── library ─────────────────────────────────────────────────
-- Burs/kaynak/not arşivi (lib/agents/executor.ts save_to_library,
-- add_scholarship). Kullanıcı bazlı ayrım kod tarafında yapılmıyor.
create table if not exists public.library (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  content        text,
  source         text,
  category       text,
  saved_by_agent text,
  created_at     timestamptz not null default now()
);

-- ── agent_runs ──────────────────────────────────────────────
-- lib/agents/runner.ts — her agent çalıştırmasının durumu/girdi/çıktısı.
create table if not exists public.agent_runs (
  id            uuid primary key default gen_random_uuid(),
  agent_name    text not null,
  status        text not null default 'running' check (status in ('running', 'done', 'error')),
  input         jsonb,
  output        jsonb,
  module_target text,
  error         text,
  user_id       uuid,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

alter table public.agent_runs enable row level security;

create policy "Users manage own agent runs"
  on public.agent_runs for all using (auth.uid() = user_id);

create index if not exists agent_runs_agent_name_idx on public.agent_runs(agent_name, started_at desc);

-- ── agent_logs ──────────────────────────────────────────────
-- Her tool çağrısının izi. run_id NULLABLE: app/api/chat/route.ts
-- Sanchez'in doğrudan (agent_runs dışı) tool çağrılarında run_id
-- vermeden log basıyor.
create table if not exists public.agent_logs (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid references public.agent_runs(id) on delete cascade,
  agent_name text,
  action     text not null,
  result     text,
  created_at timestamptz not null default now()
);

create index if not exists agent_logs_run_id_idx on public.agent_logs(run_id);

-- ── block_pages ─────────────────────────────────────────────
-- /notion sandbox sayfası (BlockNote). Canlı DB'de created_at YOK.
create table if not exists public.block_pages (
  id         uuid primary key default gen_random_uuid(),
  content    jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

-- ── calendar_events ─────────────────────────────────────────
-- /takvim (FullCalendar). Kullanıcı bazlı ayrım kod tarafında
-- yapılmıyor (tek kullanıcı varsayımı).
create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  category    text default 'Diğer'
);

create index if not exists calendar_events_start_idx on public.calendar_events(start_time);

-- ── Auto-create profile on signup ───────────────────────────
-- NOT: auth.users FK'leri kaldırıldığı için bu trigger artık
-- fiilen tetiklenmiyor olabilir (gerçek signup akışı yok, bkz.
-- yukarıdaki not). Geriye dönük uyumluluk için bırakıldı.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
