-- ============================================================
-- 0011 — Knowledge Department temelleri (Sprint 5)
--
-- İKİ DEĞİŞİKLİK, TEK AMAÇ (Knowledge Department'ın veri zemini):
--
-- 1) entities.metadata (jsonb, nullable) — yapılandırılmış zarf kolonu.
--    Knowledge Item envanteri (source/author/version/trust_score/tags/
--    category/citations…) title/content'e sığmaz; 0005 node-repository
--    notunun öngördüğü "yapılandırılmış metadata kolonu ihtiyacı" bu
--    sprintte doğdu. Kolon GENELDİR (yalnız knowledge'a özel değil) ama
--    v1'de tek yazarı Knowledge Pipeline'dır (lib/knowledge/pipeline.ts,
--    applyBrainUpdate üzerinden). Embedding'e GİRMEZ — arama sinyali
--    title+content'tir, metadata filtre/rapor katmanıdır.
--
-- 2) runtime_events CHECK genişletmesi — Knowledge olay sözlüğü.
--    Sprint 3 kararı: "yeni olay tipi = yeni migration"; TS karşılığı
--    lib/runtime/types.ts RUNTIME_EVENT_TYPES ile birlikte güncellenir.
--    Knowledge Department kendi paralel olay sistemini KURMAZ — organizma
--    olayları tek omurgadan (RuntimeEventBus → runtime_events) akar.
--
-- Desen 0010 ile aynı: inline CHECK adına güvenmeden tanımından bulunup
-- düşürülür, tam listeyle yeniden kurulur (idempotent).
-- ============================================================

-- 1) Yapılandırılmış zarf kolonu
alter table public.entities add column if not exists metadata jsonb;

-- Knowledge Registry'nin containment filtreleri için (örn.
-- metadata @> '{"kind":"knowledge-item"}'); NULL satırlar indekse girmez.
create index if not exists entities_metadata_idx
  on public.entities using gin (metadata jsonb_path_ops)
  where metadata is not null;

-- 2) runtime_events olay sözlüğü genişletmesi
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.runtime_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%event = ANY%'
  loop
    execute format('alter table public.runtime_events drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.runtime_events add constraint runtime_events_event_check check (event in (
  -- görev yaşam döngüsü (0009 — aynen korunur)
  'task_created', 'task_started', 'task_completed', 'task_failed',
  'task_delegated', 'task_cancelled', 'task_retried', 'task_timed_out',
  -- ajan yaşam döngüsü (0009 — aynen korunur)
  'agent_started', 'agent_stopped', 'agent_state_changed',
  -- departman yaşam döngüsü (0009 — aynen korunur)
  'department_activated', 'department_deactivated',
  -- worker yaşam döngüsü (0009 — aynen korunur)
  'worker_started', 'worker_stopped',
  -- Agent Brain (0009 — aynen korunur)
  'brain_updated',
  -- Knowledge Department (Sprint 5 — lib/knowledge/events.ts sözlüğü):
  'knowledge_added',     -- pipeline yeni knowledge item yazdı (CREATE)
  'knowledge_updated',   -- mevcut item doğrulandı/yenilendi (CONFIRM/SUPERSEDE)
  'knowledge_reviewed',  -- insan/ajan incelemesi statü terfisi yaptı
  'knowledge_rejected',  -- kalite kapısı reddetti YA DA inceleme emekli etti
  'skill_created',       -- extraction: skill node doğdu
  'workflow_created',    -- extraction: workflow node doğdu
  'pattern_created',     -- extraction: pattern node doğdu
  'sop_created',         -- extraction: standard (SOP) node doğdu
  'template_created'     -- extraction: template node doğdu
));
