-- ============================================================
-- 0013 — Audit Log: her tool çağrısının YETKİ KARARI ve izi
-- (Paket A, güvenlik çekirdeği).
--
-- NEDEN YENİ TABLO (mevcut üç günlük bu soruyu cevaplamıyor):
-- * agent_logs (0000): "ajan ne yaptı" — action + sonucun 500 karakteri.
--   İzin kararı, yetenek, süre, status ve user_id kavramı YOK. Kalıyor,
--   kaldırılmıyor: farklı bir soruya cevap veriyor, ikisi yan yana yaşar.
-- * runtime_events (0009): organizma-düzeyi yaşam döngüsü, CHECK'li dar
--   olay sözlüğü. Tool-başına izin kararı oraya ancak detail jsonb'sine
--   gömülerek girerdi — status/capability/duration sorgulanabilirliğini
--   kaybederdik.
-- * agent_task_events (0008): görev-kapsamlı, göreve FK cascade'li. Görev
--   bağlamı OLMAYAN çağrıların (Sanchez sohbeti) yeri yok.
--
-- TASARIM NOTLARI:
-- * Append-only (0008/0009 ile aynı disiplin): satır güncellenmez,
--   silinmez. DB-düzeyi trigger yok — kural, yazma yolunun tek kapıdan
--   (lib/audit/log.ts) geçmesiyle korunur.
-- * workspace_id BU PAKETTE DOLDURULMAZ ve OKUNMAZ: multi-tenant günü
--   (G1) için yer tutucu. Sonradan her tabloya kolon eklemek pahalı
--   olduğundan denetim tablosu daha ilk günden o şekle hazır doğuyor.
-- * department CHECK'siz (0008 owner_agent, 0009 agent_name deseni):
--   geçerli değerlerin kaynağı kod registry'sidir (lib/departments),
--   şema değil — departman eklemek migration gerektirmemeli.
-- * capability NULL olabilir: tool yetenek sözlüğünde eşlenmemişse
--   (deny_reason='unmapped-tool') çözülecek bir yetenek yoktur.
-- * input_keys: girdinin YALNIZCA anahtar adları. Değerler ASLA yazılmaz
--   — kişisel veri ve API cevabı denetim tablosuna dökülmez. Çıktı gövdesi
--   hiç yazılmaz (agent_logs zaten kısaltılmış sonucu tutuyor).
-- * RLS politikası baseline desenidir (0008/0009): tasarım niyetini
--   belgeler; gerçek Auth gelene kadar (G1) FİİLEN KORUMAZ — bu tabloya
--   yazan yol zaten service-role üzerindendir.
-- ============================================================

create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  -- Multi-tenant yer tutucu — bu pakette hep null (yukarıdaki nota bkz.)
  workspace_id uuid,
  user_id      uuid,
  agent_name   text,
  department   text,
  tool_name    text not null,
  status       text not null check (status in ('allowed', 'denied', 'error')),
  capability   text,
  -- Yalnız status='denied' için: lib/departments/enforcement.ts
  -- ToolDenyReason değerleri (unmapped-tool, unknown-agent,
  -- unknown-department, capability-forbidden, approval-required).
  -- CHECK bilinçli YOK: red gerekçeleri kodda evrilir, şemada değil.
  deny_reason  text,
  duration_ms  integer,
  error        text,
  -- Girdi anahtarları (değer YOK) — hangi alanların geçildiğini görmek
  -- için yeterli, veri sızdırmadan.
  input_keys   text[]
);

-- "Son N denetim kaydı" (denetim ekranı / inceleme):
create index if not exists audit_log_created_idx
  on public.audit_log(created_at desc);
-- Ajan bazlı inceleme ("bu ajan neyi çağırdı, neyi reddedildi"):
create index if not exists audit_log_agent_created_idx
  on public.audit_log(agent_name, created_at desc);

alter table public.audit_log enable row level security;

-- Baseline (0008/0009 deseni): kullanıcıya bağlı kayıtlar sahibine, sistem
-- kayıtları (user_id null) oturum açmış herkese açık — tek kullanıcılı
-- fazda fiilen serbest; yazma yolu zaten service-role üzerindendir.
create policy "Users read own or system audit rows"
  on public.audit_log for all using (
    user_id is null or auth.uid() = user_id
  );
