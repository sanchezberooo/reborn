-- ============================================================
-- 0010 — Personal Brain tip genişletmesi (Sprint 4: Brain Engine)
--
-- Personal Brain'in eksik kavramları entity tipi olarak eklenir:
--   * identity   — kimlik kaydı: "kimim / kim olmak istiyorum" çekirdeği
--                  (Reborn'un temel sorusunun veri karşılığı)
--   * decision   — karar kaydı: ne kararlaştırıldı, neden (Decision History
--                  = bu tipin zaman sıralı görünümüdür)
--   * preference — tercih: kalıcı beğeni/çalışma tarzı/sınır
--   * reflection — dönemsel yansıma/öğrenme kaydı (Learning History'nin
--                  personal karşılığı; Agent Brain'de learning_record var)
--
-- BİLİNÇLİ OLARAK EKLENMEYENLER (tip patlaması reddi): Working/Long-Term/
-- Semantic/Episodic Memory birer TİP DEĞİL motor kavramıdır —
--   * episodic/semantic sınıflaması: lib/brain/types.ts MEMORY_CLASS_BY_TYPE
--     (her tip tam bir sınıfa eşlenir),
--   * working memory: recency penceresi sorgusu (lib/brain/memory-engine.ts),
--   * long-term memory: kalıcı grafın kendisi (hiçbir kayıt silinmez).
-- Timeline/Relationships/Connections de tip değildir: links + graph engine.
--
-- Desen 0005/0007 ile aynı: inline CHECK adına güvenmeden tanımından
-- bulunup düşürülür, tam listeyle yeniden kurulur (idempotent).
-- ============================================================

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
  -- Personal Brain (0001'deki 10 tip — aynen korunur):
  'journal', 'goal', 'note', 'project', 'person',
  'task', 'essay', 'habit', 'resource', 'event',
  -- Personal Brain Sprint 4 eklemeleri:
  'identity', 'decision', 'preference', 'reflection',
  -- Agent Brain (0005 + 0007 — aynen korunur):
  'fact', 'skill', 'pattern', 'workflow', 'standard',
  'tool_reference', 'learning_record', 'signal',
  'template', 'repository'
));
