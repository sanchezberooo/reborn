-- ============================================================
-- Reborn — Supabase Schema
-- Supabase Dashboard > SQL Editor'da çalıştır
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  name                 text default 'Bero',
  age                  int  default 18,
  location             text default 'İstanbul',
  goal                 text default 'Tam burslu CS okumak - ABD/Kanada/Avrupa',
  ielts_target         text default '7.0+',
  ielts_date           text default 'Eylül 2026',
  project              text default 'Reborn - AI Life OS',
  application_deadline text default 'Kasım 2026',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- RLS disabled: single-user app, no auth session required.
-- alter table public.profiles enable row level security;

-- ── memories ────────────────────────────────────────────────
create table if not exists public.memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  summary    text not null,
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
  user_id    uuid not null references auth.users(id) on delete cascade,
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

-- ── messages ────────────────────────────────────────────────
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users manage own messages"
  on public.messages for all using (auth.uid() = user_id);

create index if not exists messages_session_idx on public.messages(session_id);
create index if not exists messages_user_id_idx on public.messages(user_id);

-- ── Auto-create profile on signup ───────────────────────────
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
