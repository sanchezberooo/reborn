-- ============================================================
-- 0009 — Runtime Events: Agent Runtime Engine'in organizma-düzeyi
-- append-only olay günlüğü (Sprint 3).
--
-- İKİ GÜNLÜK, İKİ SORUMLULUK (bilinçli ayrım, çift kaynak değil):
-- * agent_task_events (0008): TEK görevin denetim izi — görev-düzeyi
--   doğruluk kaynağı, FK cascade ile görevle yaşar.
-- * runtime_events (bu tablo): organizmanın olay akışı — worker/ajan/
--   departman yaşam döngüsü dahil, görevden bağımsız olaylar da burada
--   yaşar (worker_started, department_activated, brain_updated…).
--   Live State ve gelecekteki Office ekranı bu akıştan beslenir.
--
-- TASARIM NOTLARI:
-- * Append-only: satır güncellenmez, silinmez ("bilgi silinmez,
--   eskitilir" ilkesinin operasyon karşılığı — 0008 ile aynı).
-- * event CHECK'li (0008 agent_task_events deseni): olay sözlüğü
--   dar ve kasıtlıdır; yeni olay tipi = yeni migration. TS karşılığı
--   lib/runtime/types.ts RUNTIME_EVENT_TYPES — ikisi birlikte güncellenir.
-- * agent_name / department / worker_id için CHECK BİLİNÇLİ YOK
--   (0008 owner_agent kararıyla aynı gerekçe): geçerli değerlerin
--   kaynağı kod registry'leridir.
-- * task_id → agent_tasks ON DELETE SET NULL: görev geçmişi temizlense
--   de organizma izi yaşar (0008 run_id deseni).
-- * user_id NULLABLE: worker/departman yaşam döngüsü olayları sistem
--   düzeyindedir, bir kullanıcıya ait olmak zorunda değildir.
-- * RLS politikası baseline desenidir: tasarım niyetini belgeler;
--   gerçek Auth Faz 5'e kadar fiilen korumaz.
-- ============================================================

create table if not exists public.runtime_events (
  id          bigint generated always as identity primary key,
  event       text not null check (event in (
                -- görev yaşam döngüsü
                'task_created',    -- Sanchez/insan iş emri açtı
                'task_started',    -- worker görevi bir ajana verdi, çalışma başladı
                'task_completed',  -- görev başarıyla bitti
                'task_failed',     -- görev hata ile bitti
                'task_delegated',  -- bir ajan başka ajana/departmana iş emri açtı
                'task_cancelled',  -- insan/orkestratör iptali
                'task_retried',    -- retry engine görevi backoff ile yeniden kuyruğa koydu
                'task_timed_out',  -- timeout manager takılan görevi düşürdü
                -- ajan yaşam döngüsü
                'agent_started',       -- ajan bir görev üzerinde çalışmaya başladı
                'agent_stopped',       -- ajan görev çalışmasını bitirdi (başarı/hata)
                'agent_state_changed', -- runtime durum geçişi (idle→thinking→working…)
                -- departman yaşam döngüsü
                'department_activated',   -- departmanda iş akışı başladı
                'department_deactivated', -- departman kuyruğu boşaldı
                -- worker yaşam döngüsü
                'worker_started',
                'worker_stopped',
                -- Agent Brain
                'brain_updated'    -- brain_integrate soğuk katmana yazdı
              )),
  task_id     uuid references public.agent_tasks(id) on delete set null,
  agent_name  text,
  department  text,
  worker_id   text,
  user_id     uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- Live State'in "son N olay" penceresi ve Office'in akış görünümü:
create index if not exists runtime_events_created_idx
  on public.runtime_events(created_at desc);
-- Görev detayında organizma izi:
create index if not exists runtime_events_task_idx
  on public.runtime_events(task_id) where task_id is not null;
-- Olay tipine göre analiz (örn tüm task_failed'lar):
create index if not exists runtime_events_event_idx
  on public.runtime_events(event, created_at);

alter table public.runtime_events enable row level security;

-- Baseline (0008 deseni): kullanıcıya bağlı olaylar sahibine, sistem
-- olayları (user_id null) oturum açmış herkese açık — tek kullanıcılı
-- fazda fiilen serbest; yazma yolu zaten service-role üzerindendir.
create policy "Users manage own or system runtime events"
  on public.runtime_events for all using (
    user_id is null or auth.uid() = user_id
  );
