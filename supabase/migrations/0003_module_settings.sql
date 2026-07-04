-- ============================================================
-- 0003 — Modül çerçevesi v1: kullanıcı modül tercihi
-- Faz 2, Görev 4. Referans: docs/reborn-master-roadmap.md Faz 2
-- ("Modül çerçevesi v1: Aç/kapat altyapısı; Journal ve Goals bu
-- çerçevenin ilk iki modülü olarak yazılır, hard-coded değil.")
--
-- TASARIM ÖZETİ:
-- * Yeni tablo YOK — tek-kullanıcı uygulamada kullanıcı tercihi zaten
--   tek satırlık profiles'ta yaşar; tek satırlık ayrı bir tablo açmak
--   "veri tek kaynakta ve bağlantılı mı?" filtresine karşı gereksiz
--   bir silo olurdu. jsonb kolonu yeterli.
-- * İçerik bir OVERRIDE haritasıdır: { "<module_id>": false } —
--   yalnız kapatılan modüller yazılır, anahtar yoksa modül AÇIKTIR.
--   Böylece '{}' (default) "her şey açık" demektir ve ileride eklenen
--   yeni modüller veri işi gerektirmeden varsayılan açık doğar.
-- * Modül kapatmak YALNIZ bu kolonu değiştirir; entities/goals/
--   journal_* satırlarına dokunulmaz (roadmap kriteri: "Bir modül
--   kapatıldığında UI'dan kayboluyor, verisi korunuyor").
-- * module_id anahtarları lib/module-registry.ts MODULE_REGISTRY'de
--   tanımlıdır (v1: 'journal', 'goals'). CHECK kısıtı bilinçli YOK:
--   registry koddaki esas kaynaktır, yeni modül eklemek migration
--   gerektirmemelidir (yalnız yeni ENTITY TİPİ migration gerektirir,
--   bkz. 0001).
-- ============================================================

alter table public.profiles
  add column if not exists module_settings jsonb not null default '{}'::jsonb;
