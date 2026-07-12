-- ============================================================
-- 0006 — match_entities RPC: benzerlik aramasını DB'ye taşıma
-- Referans: CTO raporu ölçeklenebilirlik bulgusu — retrieval tüm
-- embedding'leri belleğe çekip JS'te dot product yapıyordu
-- (.limit(1000)); 1000 entity üstünde limit sonrası satırlar hiç
-- skorlanmadan sessizce kayboluyordu. 0001'deki HNSW indeksi
-- (entities_embedding_idx) DB'de vardı ama hiçbir sorgu
-- kullanmıyordu. Bu fonksiyon o indeksi kullanan tek okuma
-- kapısıdır; lib/ai/retrieval.ts hybridRetrieve artık full-scan
-- yerine bunu çağırır.
--
-- TASARIM KARARLARI:
-- * Parametreler p_ önekli: RETURNS TABLE çıktı kolonları da
--   fonksiyon parametresi sayıldığından `scope` gibi bir girdi adı
--   aynı adlı çıktı kolonuyla çakışır; p_ öneki bu çakışmayı ve
--   gövdedeki kolon/parametre belirsizliğini kökten çözer.
-- * p_scope NULL ise scope filtresi yok (tüm scope'lar taranır);
--   'personal' | 'agent' verilirse filtrelenir — 0005'teki
--   entities.scope kolonuyla uyumlu. Değer CHECK'i fonksiyonda
--   tekrarlanmaz: geçersiz scope boş küme döndürür, kolondaki
--   CHECK zaten yazma anında korur.
-- * similarity = 1 - cosine_distance. Eski JS yolu L2-normalize
--   vektörlerde dot product hesaplıyordu; normalize vektörde
--   dot = cosine olduğundan skor birebir aynı ölçektir —
--   dışarıdan gözlemlenen sıralama davranışı değişmez.
-- * `set hnsw.iterative_scan = strict_order` (pgvector 0.8.0):
--   user_id/scope filtresi HNSW taramasında POST-FILTER'dır;
--   iterative scan olmadan indeks ef_search (40) aday döndürüp
--   durur ve filtre adayları elerse sonuç limit'ten kısa kalabilir
--   (tam da kaçındığımız "sessiz sonuç kaybı"nın DB'deki hali).
--   strict_order: indeks, filtre sonrası limit dolana dek taramayı
--   sürdürür ve kesin mesafe sırası korunur.
-- * `set search_path = ''` (Supabase güvenlik tavsiyesi): tüm
--   nesneler şema-nitelikli; <=> operatörü bu yüzden
--   OPERATOR(extensions.<=>) yazımıyla çağrılır (indeks eşleşmesi
--   operatör OID'i üzerinden olduğundan yazım indeks kullanımını
--   etkilemez).
-- * security invoker (varsayılan): fonksiyon ayrıcalık yükseltmez;
--   çağıran servis rolü (lib/supabase-admin) zaten RLS üstüdür.
--   0000_baseline'daki RLS notu geçerli: gerçek Auth Faz 5'e kadar
--   yok.
--
-- HNSW KANITI (1b): Fonksiyon henüz canlıda yokken, gövdedeki
-- sorgunun birebir şekli (parametreler InitPlan param'ı olarak)
-- canlı DB'de EXPLAIN ANALYZE ile doğrulandı (2026-07-11,
-- pgvector 0.8.0, 107 satır):
--
--   Limit (actual rows=8)
--     ->  Index Scan using entities_embedding_idx on entities e
--           Order By: (embedding <=> (InitPlan 2).col1)
--           Filter: ((embedding IS NOT NULL) AND (user_id = ...))
--
-- NOT (dürüstlük): bu plan `set local enable_seqscan=off,
-- enable_sort=off` ile alındı; 107 satırlık bugünkü tabloda
-- planner varsayılan olarak seq scan + top-N heapsort seçiyor
-- çünkü o plan gerçekten daha ucuz (cost 5.74 vs 141.60). Bu
-- doğru davranıştır: kanıtlanan şey sorgu şeklinin HNSW indeksiyle
-- EŞLEŞTİĞİ ve satır sayısı büyüdükçe maliyet modelinin kendiliğinden
-- indeks planına geçeceğidir. Eski JS full-scan'in aksine her iki
-- planda da sonuç kümesi TAM'dır — 1000 satır tavanı yoktur.
-- ============================================================

-- pgvector kütüphanesi bu session'a henüz yüklenmemişse hnsw.*
-- GUC'ları "placeholder" sayılır ve aşağıdaki fonksiyonun SET
-- clause'u CREATE anında "permission denied to set parameter"
-- hatası verir (canlıda doğrulandı). Bu zararsız satır kütüphaneyi
-- yükler; CREATE sonrasında sorun kalmaz. RUNTIME'da güvenli:
-- fonksiyon argümanı vector tipinde olduğundan, argümanın parse/cast
-- edilmesi kütüphaneyi fonksiyon gövdesi (ve SET clause) çalışmadan
-- önce zaten yükler.
select extensions.vector_dims('[1]'::extensions.vector);

create or replace function public.match_entities(
  p_user_id uuid,
  p_query_embedding extensions.vector(1024),
  p_match_limit int default 10,
  p_scope text default null
)
returns table (
  id uuid,
  type text,
  title text,
  content text,
  created_at timestamptz,
  scope text,
  similarity double precision
)
language sql
stable
parallel safe
set search_path = ''
set hnsw.iterative_scan = strict_order
as $$
  select
    e.id,
    e.type,
    e.title,
    e.content,
    e.created_at,
    e.scope,
    1 - (e.embedding operator(extensions.<=>) p_query_embedding) as similarity
  from public.entities e
  where e.user_id = p_user_id
    and e.embedding is not null
    and (p_scope is null or e.scope = p_scope)
  order by e.embedding operator(extensions.<=>) p_query_embedding
  limit p_match_limit
$$;
