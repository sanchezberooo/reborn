-- ============================================================
-- 0008 — Agent Tasks: MAXAİ iş emri modeli (job queue temeli)
-- Referans: Sprint 2 (Task modeli) + Sprint 1 kapı koşulu "job
-- queue kararı". KARAR: kuyruk Postgres'te yaşar — Supabase tek
-- doğru bilgi kaynağıdır (roadmap §1); ayrı bir Redis/queue
-- servisi ikinci bir altyapı kaynağı açardı. Ölçek ihtiyacı
-- doğarsa SKIP LOCKED tabanlı claim deseni bu şemanın üstünde
-- kurulabilir — şema o güne hazırdır, bugün worker YOK (çalıştırma
-- hâlâ senkron runAgent yoludur; otomatik işleyici Sprint 3+).
--
-- TASARIM ÖZETİ:
-- * agent_tasks: iş emrinin kendisi. Personal Brain'in 'task'
--   entity tipiyle (kişisel yapılacaklar) AYRI kavramdır — bu
--   tablo MAXAİ orkestrasyon iş emirleridir; adlandırma
--   agent_runs/agent_logs ailesini sürdürür.
-- * owner_agent / department için CHECK BİLİNÇLİ YOK (0003
--   deseni): geçerli değerlerin kaynağı kod registry'leridir
--   (lib/agents, lib/departments); DB'ye CHECK koymak her yeni
--   ajan/departmanda migration zorunluluğu yaratırdı. Doğrulama
--   yazma anında lib/tasks/repository.ts'te yapılır.
-- * Bağımlılıklar ayrı tabloda (uuid[] değil): FK bütünlüğü +
--   iki yönlü indeksli sorgu ("bunu ne blokluyor" / "bu neyi
--   blokluyor"). Döngü engeli kod tarafında (repository BFS).
-- * History ayrı append-only event tablosunda (jsonb dizisi
--   değil): satır güncellenmez, iz silinmez — Agent Brain'in
--   "bilgi silinmez, eskitilir" ilkesinin operasyon karşılığı.
-- * run_id → agent_runs bağlantısı ON DELETE SET NULL: run
--   geçmişi temizlense de task izi yaşar.
-- * RLS politikası baseline desenidir: tasarım niyetini belgeler;
--   gerçek Auth Faz 5'e kadar fiilen korumaz.
-- ============================================================

create table if not exists public.agent_tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  title          text not null,
  description    text,
  status         text not null default 'pending' check (status in (
                   'pending',    -- oluşturuldu, çalışmaya hazır olmayı bekliyor
                   'queued',     -- sıraya alındı (bağımlılıkları tamam)
                   'running',    -- bir ajan üzerinde çalışıyor
                   'blocked',    -- açık bağımlılık/engel var
                   'done',       -- başarıyla bitti (terminal)
                   'failed',     -- hata ile bitti (retry ile yeniden kuyruğa girebilir)
                   'cancelled'   -- insan/orkestratör iptali (terminal)
                 )),
  priority       text not null default 'normal' check (priority in (
                   'low', 'normal', 'high', 'urgent'
                 )),
  -- Kod registry'lerine yumuşak referans (CHECK yok — üst not):
  owner_agent    text,
  department     text,
  input          jsonb,
  output         jsonb,
  error          text,
  retry_count    int not null default 0 check (retry_count >= 0),
  max_retries    int not null default 0 check (max_retries >= 0),
  scheduled_for  timestamptz,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Kuyruk taraması: durum + öncelik + yaş. Öncelik sıralaması kod
-- tarafında priority → rank çevrimiyle yapılır (text alfabetik sırası
-- anlamsal sıra değildir).
create index if not exists agent_tasks_status_idx on public.agent_tasks(status, created_at);
create index if not exists agent_tasks_user_idx on public.agent_tasks(user_id);
create index if not exists agent_tasks_department_idx
  on public.agent_tasks(department) where department is not null;

create table if not exists public.agent_task_dependencies (
  task_id             uuid not null references public.agent_tasks(id) on delete cascade,
  depends_on_task_id  uuid not null references public.agent_tasks(id) on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create index if not exists agent_task_dependencies_reverse_idx
  on public.agent_task_dependencies(depends_on_task_id);

create table if not exists public.agent_task_events (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.agent_tasks(id) on delete cascade,
  event       text not null check (event in (
                'created', 'status_changed', 'assigned', 'dependency_added',
                'retry_scheduled', 'run_linked', 'note'
              )),
  from_status text,
  to_status   text,
  detail      jsonb,
  run_id      uuid references public.agent_runs(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists agent_task_events_task_idx
  on public.agent_task_events(task_id, created_at);

alter table public.agent_tasks enable row level security;
alter table public.agent_task_dependencies enable row level security;
alter table public.agent_task_events enable row level security;

create policy "Users manage own agent tasks"
  on public.agent_tasks for all using (auth.uid() = user_id);

create policy "Users manage own agent task dependencies"
  on public.agent_task_dependencies for all using (
    exists (select 1 from public.agent_tasks t where t.id = task_id and t.user_id = auth.uid())
  );

create policy "Users manage own agent task events"
  on public.agent_task_events for all using (
    exists (select 1 from public.agent_tasks t where t.id = task_id and t.user_id = auth.uid())
  );
