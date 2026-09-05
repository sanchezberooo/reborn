-- ============================================================
-- 0014 — Agent run lifecycle: VERIFY sonucu, token sayıları ve
-- denetim satırının run'a bağlanması (Paket B).
--
-- TEK MİGRATION, ÜÇ İHTİYAÇ: üçü de aynı soruyu cevaplıyor —
-- "bu çalıştırmada ne oldu?" Ayrı migration'lara bölmek, aynı tabloya
-- arka arkaya üç ALTER demek olurdu; yeni tablo AÇILMIYOR.
--
-- NEDEN YENİ TABLO YOK:
-- * verification agent_runs'ın bir ALANIDIR, ayrı bir varlık değil:
--   run'sız doğrulama yoktur, 1-1'dir ve run silinince gitmelidir.
-- * token sayıları da run'ın ölçüsüdür — ayrı tablo, her görünürlük
--   sorgusuna bir join eklerdi.
--
-- TASARIM NOTLARI:
-- * status CHECK'i 'verify_failed' ile genişletiliyor. AYRI bir durumdur,
--   'error' DEĞİL: 'error' çalıştırmanın PATLADIĞINI söyler (exception),
--   'verify_failed' çalıştırmanın bittiğini ama çıktının sözleşmeyi
--   tutmadığını. İkisini aynı kovaya atmak, "ajan çöktü" ile "ajan yanlış
--   biçimde cevap verdi"yi ayırt edilemez yapardı.
-- * verification jsonb NULLABLE: 0014 ÖNCESİ satırlarda doğrulama hiç
--   koşmadı. NULL "doğrulanmadı" demektir, "geçti" değil — geriye dönük
--   backfill BİLİNÇLİ yapılmıyor, olmayan bir kontrolün sonucu uydurulamaz.
-- * input_tokens/output_tokens NULLABLE ve CHECK'siz: sağlayıcı usage
--   bilgisi vermeyebilir (MockProvider vermez) — 0 yazmak "bedavaydı"
--   demek olurdu, NULL "bilinmiyor" der. Bir run'daki TÜM turların toplamı.
-- * PARA HESABI YOK (bilinçli): fiyat tablosu şemaya da koda da gömülmez —
--   modeller ve fiyatlar değişir, gömülü fiyat sessizce yanlışa döner.
--   Token sayısı ham gerçektir; TL/dolar çevrimi UI katmanının işi.
-- * audit_log.run_id: denetim satırını çalıştırmaya bağlar. Alternatif
--   (zaman penceresiyle eşleme) KIRILGAN: eşzamanlı çalıştırmalarda
--   satırları yanlış run'a yazardı. FK YOK — audit_log append-only bir
--   denetim günlüğüdür ve run silinince izi kaybolmamalıdır (agent_logs'un
--   FK cascade deseni burada bilinçli olarak TEKRARLANMIYOR).
-- ============================================================

-- ── agent_runs: VERIFY sonucu ───────────────────────────────
alter table public.agent_runs
  add column if not exists verification jsonb;

-- ── agent_runs: token sayıları (bir run'daki tüm turların toplamı) ──
alter table public.agent_runs
  add column if not exists input_tokens  integer,
  add column if not exists output_tokens integer;

-- ── agent_runs: status sözlüğü genişliyor ───────────────────
alter table public.agent_runs
  drop constraint if exists agent_runs_status_check;

alter table public.agent_runs
  add constraint agent_runs_status_check
  check (status in ('running', 'done', 'error', 'verify_failed'));

-- ── audit_log: tool çağrısını run'a bağla ───────────────────
alter table public.audit_log
  add column if not exists run_id uuid;

-- "Bu run'da hangi tool'lar çağrıldı, hangileri reddedildi" sorgusu:
create index if not exists audit_log_run_idx
  on public.audit_log(run_id, created_at);

-- Görünürlük ucunun run listesi sorgusu (agent_runs zaten
-- agent_name+started_at indeksli; bu, ajan filtresiz "son N run" içindir):
create index if not exists agent_runs_started_idx
  on public.agent_runs(started_at desc);
