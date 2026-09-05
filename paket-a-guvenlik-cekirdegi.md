# PAKET A — GÜVENLİK ÇEKİRDEĞİ

Reborn repository'sinde tek oturumluk, dar kapsamlı bir güvenlik paketi uygula.

## BAŞLAMADAN ÖNCE

Repo kökünde `reborn-denetim-2026-09.md` var. **Bu dosya mevcut baseline'dır.** Sıfırdan kod tabanı analizi yapma — 35.000 satır okumaya kalkma. Yapman gereken, bu paketin dokunduğu 6 dosyayı okuyup rapordaki bulguları doğrulamak:

- `lib/agents/executor.ts` — `serverExecuteTool` imzası ve switch yapısı
- `lib/departments/registry.ts` — `TOOL_CAPABILITIES`, `DEPARTMENTS`
- `lib/departments/types.ts` — `CapabilityId`, `PermissionEffect`, `DEPARTMENT_IDS`
- `lib/agents/registry.ts` — `AGENTS`, `department` alanı
- `lib/sanchez/core.ts` — `serverExecuteTool` çağrısı ve `callerAgent`
- `lib/agents/runner.ts` — `serverExecuteTool` çağrısı

Rapordan farklı bir şey bulursan **dur ve söyle**, kendi başına uyarlama.

## YÜRÜTME MODELİ

Her mantıksal task için sırayla:

1. **PLANLA** — dokunacağın dosyaları ve yapacağın değişikliği yaz. Bekle, benim onayımı al.
2. **UYGULA** — sadece planladığın değişikliği yap.
3. **DOĞRULA** — `git status` + o task'ın testleri.
4. **COMMIT** — anlamlı tek bir commit.

Bir task doğrulamada kalırsa **sonraki task'a geçme**, sorunu çöz veya bana sor.

## KAPSAM

Sadece şunlar. Başka hiçbir şey.

1. Repo hijyeni
2. GitHub Actions CI
3. `serverExecuteTool` runtime capability enforcement
4. `audit_log` tablosu ve yazıcısı
5. 3 ve 4 için testler
6. `AI_PROVIDER=mock` ile test / lint / build doğrulaması

**Kapsam dışı — bu oturumda dokunma:** Office dashboard, Brain UI, `lib/maxai-data.ts` mock temizliği, ajan productionization, yeni ajan, MCP, model router, CRM/client veri modeli, auth, workspace sistemi, `lib/db.ts` bölme, herhangi bir kozmetik refactor.

## GENEL KURALLAR

- Mevcut mimariyi bozma. İkinci bir permission sistemi kurma — `TOOL_CAPABILITIES` + `DEPARTMENTS` zaten var, sadece runtime'a bağlanmamış.
- Yeni dependency ekleme.
- Mevcut public API davranışını gereksiz değiştirme. `serverExecuteTool` imzası aynı kalsın.
- Mevcut 30 test dosyasını bozma. Bir test davranış değişikliği yüzünden kırılırsa önce **nedenini açıkla**, sonra düzelt. Testi susturmak için değiştirme.
- Her kritik değişikliğe test yaz.
- 51 günlük commit boşluğunu tek dev commit ile kapatma. Aşağıdaki task'lar zaten commit sınırlarıdır.
- Lokal bge-m3 modeli (~570 MB) indirilmesin: test/lint/build çalıştırmalarında `AI_PROVIDER=mock` kullan.

---

## TASK A1 — REPO HİJYENİ

`chore:` commit.

- Repo kökündeki 0-byte çöp dosyaları sil: `,` · `b[1]` · `n.id` · `r.id` · `s.max)`
- `.claude/memory.db` dosyasını git takibinden çıkar (`git rm --cached`) ve `.gitignore`'a ekle.
- `.claude/` altındaki claude-flow boilerplate'i (200 markdown, `agents/`, `commands/`, `helpers/`) **silme** — git takibinden çıkar ve `.gitignore`'a al. Lokalde çalışmaya devam etsin, repo'da görünmesin. `.claude/settings.json` gibi projeye özgü dosya varsa takipte kalsın; hangilerini bıraktığını commit mesajında belirt.
- `.env.example` oluştur. `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `AI_PROVIDER` — değer yok, sadece anahtar ve tek satır açıklama.

**Doğrulama:** `git status` temiz, `npm run lint` geçiyor.

---

## TASK A2 — GITHUB ACTIONS CI

`chore:` commit.

`.github/workflows/ci.yml` oluştur. Push ve pull request'te çalışsın.

- Node 20+, `npm ci`
- `npm test` → `npm run lint` → `npm run build`
- Job seviyesinde `env: AI_PROVIDER: mock`
- Supabase env değişkenleri CI'da yok; testlerin bir kısmı bunu zaten `process.env` kontrolüyle atlıyor (`lib/goals-sync.test.ts` desenine bak). Build bu değişkenler olmadan geçmiyorsa **dur ve söyle** — sahte değer uydurma.

**Doğrulama:** Aynı üç komutu lokalde `AI_PROVIDER=mock` ile çalıştır, üçü de geçsin. Sonra push edip Actions'ın yeşil olduğunu gör.

---

## TASK A3 — CAPABILITY ENFORCEMENT

`feat:` commit. **Paketin en kritik parçası.**

`serverExecuteTool(name, input, userId, ctx)` her çağrıda şunu yapsın:

```
ctx.callerAgent → AGENTS[callerAgent].department → DEPARTMENTS[department].permissions
                → TOOL_CAPABILITIES[toolName] → effect
```

- `allowed` → çalıştır
- `forbidden`, listede yok, departman yok, ajan yok → **reddet** (default-deny)
- `approval-required` → şimdilik **reddet**, ama gerekçesi ayrı olsun ("onay katmanı yok"). Sessizce izin verme.
- `TOOL_CAPABILITIES`'te eşlemesi olmayan tool → reddet. Sınıflandırılmamış tool yetki modelinin dışına çıkamaz.

**Sanchez istisnası — bunu doğru yap.** `lib/departments/types.ts` başındaki nota göre Sanchez bir departman değildir, tüm departmanların üstünde durur ve tam tool setiyle çalışır. `AGENTS` registry'sinde de kaydı yok. Yani `callerAgent === 'sanchez'` enforcement'tan **muaftır** — ama bu muafiyet:
- kodda tek bir yerde, açık ve yorumlu olsun,
- audit log'a yine de yazılsın (muaf ≠ izsiz),
- `AGENTS` içinde bulunamayan *herhangi* bir ajana genişletilmesin. Bilinmeyen `callerAgent` reddedilir; sadece literal `'sanchez'` muaftır.

Reddedilen çağrı:
- tool çalışmaz,
- `audit_log`'a `status: 'denied'` olarak yazılır,
- modele **güvenli** bir hata döner: hangi capability'nin eksik olduğunu söyleyebilir, ama izin tablosunu, departman listesini veya diğer tool'ların adını sızdırmasın.
- Mevcut hata sözleşmesi korunsun: `lib/sanchez/core.ts` tool hatasını yakalayıp modele `isError` sonucu döndürüyor ve turu düşürmüyor. Enforcement reddi de **bu yoldan** geçsin, turu düşüren yeni bir exception tipi icat etme.

**Regresyon kontrolü:** `legacy` departmanı `life-data.read` + `web.search` iznine sahip; `essay-brainstorm` (`read_memories`, `read_profile`) bundan sonra da çalışmalı. Mevcut hiçbir ajanın fiili tool listesi bu değişiklikle kırılmamalı — kırılıyorsa registry değil, enforcement mantığın yanlıştır.

---

## TASK A4 — AUDIT LOG

`feat:` commit. Migration `supabase/migrations/0013_audit_log.sql`.

Yeni tablo açmadan önce `agent_logs` ve `runtime_events`'in bunu zaten karşılayıp karşılamadığını kontrol et. Karşılamıyorsa (rapora göre karşılamıyor: `agent_logs` ajan aksiyonunun 500 karakterlik sonucunu tutuyor, izin kararı ve süre kavramı yok) yeni tablo aç. Kararını commit mesajında bir cümleyle gerekçelendir.

Alanlar:

| Alan | Not |
|---|---|
| `id` | uuid pk |
| `created_at` | timestamptz default now() |
| `workspace_id` | **uuid NULL** — bu pakette doldurulmaz, kullanılmaz. Multi-tenant günü için yer tutucu. |
| `user_id` | uuid |
| `agent_name` | text |
| `department` | text (soft ref, CHECK yok — 0008 deseni) |
| `tool_name` | text |
| `status` | text CHECK: `allowed` \| `denied` \| `error` |
| `capability` | text — çözülen capability, çözülemediyse null |
| `deny_reason` | text — sadece `denied` için |
| `duration_ms` | int |
| `error` | text |

- RLS'i mevcut baseline desenini izleyerek yaz; rapordaki gibi auth gelene kadar fiilen korumadığını migration yorumunda belirt.
- Index: `(created_at desc)` ve `(agent_name, created_at desc)`.
- Yazıcı `lib/audit/log.ts` gibi tek bir yerde olsun ve **asla throw etmesin** — audit yazımı başarısız olursa tool çalışması düşmemeli, `console.error` yeterli.
- Girdi/çıktı gövdesini tam yazma. Girdi anahtarlarını veya kısaltılmış bir özeti yaz; kişisel veri ve API cevabı audit tablosuna dökülmesin.
- `agent_logs`'a mevcut yazımı **kaldırma**. Audit farklı bir soru cevaplıyor (izin ve iz), `agent_logs` farklı (ajan ne yaptı). İkisi bir süre yan yana yaşar.

---

## TASK A5 — TESTLER

`test:` veya `feat:` commit (A3/A4 ile aynı commit'e koyma).

Vitest, mevcut desen. En az şunlar:

**Capability enforcement**
- İzinli ajan + izinli tool → çalışır
- İzinli ajan + izinsiz tool → reddedilir
- `TOOL_CAPABILITIES`'te olmayan tool → reddedilir
- Bilinmeyen `callerAgent` → reddedilir
- `callerAgent: 'sanchez'` → çalışır ve audit'e yazılır
- `approval-required` → reddedilir, `deny_reason` ayırt edilebilir
- Reddedilen çağrı gerçekten **yan etki üretmez** (tool gövdesi hiç çalışmaz — DB'ye yazan bir tool ile doğrula)
- Regresyon: `essay-brainstorm` → `read_memories` çalışır

**Audit log**
- `allowed` ve `denied` satırı yazılır, alanlar dolu
- Audit yazımı hata verse bile tool sonucu değişmez

Supabase gerektiren testleri mevcut env-guard desenine göre koşullu yaz; CI'da atlanabilir olsunlar. Enforcement mantığının kendisi **saf** olmalı ve DB'siz test edilebilmeli — gerekirse karar fonksiyonunu (`canUseTool(agentName, toolName) → decision`) yürütmeden ayır. Bu, bu pakette meşru olan **tek** yeni abstraction'dır.

---

## TASK A6 — FİNAL DOĞRULAMA

```
AI_PROVIDER=mock npm test
AI_PROVIDER=mock npm run lint
AI_PROVIDER=mock npm run build
```

Üçü de geçmeli. Kırılan mevcut testler için önce neden analizi, sonra düzeltme.

---

## ÇIKTI

İş bitince şu 5 başlıkta rapor ver, fazlasını yazma:

1. **Değişikliklerin özeti** — ne yapıldı
2. **Değişen dosyalar** — dosya bazında tek satır
3. **Test / lint / build sonuçları** — kaç test geçti, gerçek çıktı
4. **Commitler** — hash + mesaj listesi
5. **Paket B için riskler** — enforcement açıldıktan sonra kırılabilecek yerler, audit'te eksik kalanlar, dikkat edilmesi gerekenler

Kapsam dışında iş yapma. Bir sonraki adım için fikrin varsa 5. başlıkta yaz, uygulama.
