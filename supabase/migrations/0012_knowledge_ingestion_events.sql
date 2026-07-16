-- ============================================================
-- 0012 — Knowledge Ingestion olayları (Sprint 6)
--
-- Knowledge Ingestion Engine'in dört yeni organizma olayı:
--   * repository_imported — bir GitHub reposu İLK KEZ içe alındı
--   * repository_updated  — bilinen repo yeniden içe alındı (CONFIRM/
--                           SUPERSEDE — Brain dedup kararı, ingestion.ts)
--   * knowledge_extracted — bir ingestion koşusunun özet olayı: kaynaktan
--                           kaç item/extraction üretildiği detail'de
--   * knowledge_approved  — inceleme kararı bilgiyi terfi ettirdi
--                           (approve→doğrulanmış, trust→güvenilir);
--                           ret tarafı 0011'deki knowledge_rejected'tır
--
-- NOT (tek sözlük ilkesi): Sprint 6 sözleşmesindeki SkillExtracted/
-- WorkflowExtracted/PatternExtracted/SOPExtracted/TemplateExtracted
-- olayları YENİ TİP DEĞİLDİR — 0011'in skill_created/workflow_created/
-- pattern_created/sop_created/template_created olaylarının kendisidir
-- (aynı an: extraction node'unun doğumu). İkinci bir ad uzayı açılmadı.
--
-- Desen 0010/0011 ile aynı: CHECK tanımından bulunup düşürülür, tam
-- listeyle yeniden kurulur (idempotent). TS karşılığı lib/runtime/types.ts
-- RUNTIME_EVENT_TYPES — ikisi birlikte güncellenir.
-- ============================================================

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
  -- Knowledge Department (0011 — aynen korunur)
  'knowledge_added', 'knowledge_updated', 'knowledge_reviewed', 'knowledge_rejected',
  'skill_created', 'workflow_created', 'pattern_created', 'sop_created', 'template_created',
  -- Knowledge Ingestion (0012 — bu migration):
  'repository_imported',
  'repository_updated',
  'knowledge_extracted',
  'knowledge_approved'
));
