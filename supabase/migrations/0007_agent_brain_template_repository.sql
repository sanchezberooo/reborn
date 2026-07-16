-- ============================================================
-- 0007 — Agent Brain soğuk katman genişletmesi: template + repository
-- Referans: Sprint 2 (Agent Brain Foundation) — istenen node tip
-- sözlüğünün mevcut 0005 tipleriyle eşlemesi:
--   Skill→skill, Workflow→workflow, Pattern→pattern,
--   Knowledge→fact, SOP→standard (mevcut — dokunulmaz);
--   Template→YOK, Repository→YOK (bu migration ekler).
--
-- TASARIM ÖZETİ (0005 deseninin devamı):
-- * TAMAMEN ADDITIVE: yalnız entities.type CHECK listesi genişler.
--   links.kind, scope/layer/status kolonları ve indeksler DEĞİŞMEZ.
-- * İki yeni tip de SOĞUK katman tipidir — yalnız privileged
--   entegrasyon (integrateNode) yoluyla doğar, sıcak katman girişi
--   'signal' tek kalır.
-- * Anlamlar:
--     template   → yeniden kullanılabilir üretim şablonu (rapor,
--                  e-posta, landing iskeleti…) — Pinned Reference
--                  karakterli içerik (roadmap §6.3).
--     repository → dış kod/kaynak deposu bilgi kartı (v1: GitHub
--                  repo künyesi) — Knowledge Agent'ın kaynak
--                  raporlarının kalıcı bağlanma noktası.
-- ============================================================

-- ── entities.type CHECK genişletmesi ────────────────────────
-- 0005 ile aynı idempotent desen: tanımından bulunup düşürülür,
-- tam listeyle yeniden kurulur.
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
  -- Personal Brain 10 tipi (0001) — aynen korunur:
  'journal', 'goal', 'note', 'project', 'person',
  'task', 'essay', 'habit', 'resource', 'event',
  -- Agent Brain (0005): 'signal' sıcak katman; kalanlar soğuk katman:
  'fact', 'skill', 'pattern', 'workflow', 'standard',
  'tool_reference', 'learning_record', 'signal',
  -- Agent Brain soğuk katman genişletmesi (0007):
  'template', 'repository'
));
