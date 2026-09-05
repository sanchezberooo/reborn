# PAKET B — LIFECYCLE VE GÖRÜNÜRLÜK

Paket A tamamlandı (9 commit, CI yeşil, enforcement + audit canlı). Bu paket onun üstüne biner.

## BAŞLAMADAN ÖNCE

Baseline: repo kökündeki `reborn-denetim-2026-09.md` + Paket A'nın kendi raporu. Sıfırdan analiz yapma.

Bu paketin dokunduğu dosyaları oku:

- `lib/agents/runner.ts` — tool döngüsü, `parseAgentOutput`, `agent_runs` yazımı
- `lib/agents/executor.ts` — `serverExecuteTool`, `default:` dalı
- `lib/agents/types.ts` — `AgentDefinition`, özellikle `outputContract`
- `lib/ai/provider.ts` — `AITurn`, `AIProvider`
- `lib/ai/anthropic.ts` — usage bilgisi geliyor mu
- `lib/audit/log.ts` + `lib/departments/enforcement.ts` — A paketinin çıktısı
- `app/api/agents/runs/route.ts` ve `app/api/agents/logs/route.ts`

Rapordan farklı bir şey bulursan **dur ve söyle.**

## YÜRÜTME MODELİ

Her task için: **PLANLA** (dosyalar + değişiklik, onayımı bekle) → **UYGULA** → **DOĞRULA** (`git status` + testler) → **COMMIT**.

Bir task doğrulamada kalırsa sonrakine geçme.

## KAPSAM

1. Paket A'nın açıkta bıraktığı iki hata + iki teknik borç
2. Agent lifecycle'a VERIFY aşaması
3. Token/maliyet kaydı
4. Agent run görünürlük **veri katmanı** (API — UI değil)
5. Testler
6. Doğrulama

**Kapsam dışı — bu oturumda dokunma:** Office/Brain UI, `lib/maxai-data.ts` mock temizliği, Brain'e ne yazılacağı kuralları, yeni ajan, ajan tool'larının genişletilmesi, MCP, model router, auth, workspace, CRM. Bunlar Paket C.

## GENEL KURALLAR

- Mevcut mimariyi bozma, paralel sistem kurma, yeni dependency ekleme.
- `serverExecuteTool` ve `runAgent` imzaları değişmesin.
- 308 testin hiçbiri zayıflatılmasın. Davranış değişikliği yüzünden kırılan olursa önce **nedenini açıkla.**
- Her kritik değişikliğe test.
- Test/lint/build çalıştırmalarında `AI_PROVIDER=mock`.
- Push öncesi CI'ı taklit et:
  `NEXT_PUBLIC_SUPABASE_URL="" SUPABASE_SERVICE_ROLE_KEY="" CI=true AI_PROVIDER=mock npx vitest run`

---

## TASK B1 — PAKET A'NIN AÇIK BIRAKTIKLARI

`fix:` commit(ler)i. Dördü ayrı ayrı küçük; ikişerli gruplayabilirsin.

**B1.1 — `runner.ts`'te red tüm run'ı öldürüyor.**
`lib/sanchez/core.ts` tool hatasını çağrı başına yakalayıp modele `isError` döndürüyor ve turu düşürmüyor. `lib/agents/runner.ts`'in tool döngüsünde bu yok — `Promise.all` içindeki tek bir `serverExecuteTool` reddi en dıştaki catch'e gidiyor ve `agent_runs.status='error'` oluyor. Ajan tek yanlış çağrıyla ölmemeli, Sanchez gibi hatayı görüp devam edebilmeli.

Çözüm: `core.ts`'teki `executeToolCalls` deseninin aynısı — çağrı başına try/catch, `isError: true` sonucu modele geri. **Yeni bir hata sözleşmesi icat etme, var olanı runner'a taşı.** İki yerde birebir aynı mantık oluşacaksa ortak bir yardımcıya çıkarabilirsin, ama bu bir refactor bahanesi değil; sadece bu iki çağrı yeri.

**B1.2 — `default:` dalı sessizce başarı dönüyor.**
`executor.ts` sonundaki `default: return { ok: true, note: 'server-handled' }` — tanımsız bir tool adı geldiğinde model başarı sanıyor. Enforcement açıldığı için bu dal artık yalnız Sanchez muafiyetiyle ulaşılabilir, ama tam da orada tehlikeli. Bilinmeyen tool adı **hata fırlatmalı**; hata mevcut sözleşmeden geçip modele `isError` olarak dönsün.

**B1.3 — Testler canlı `audit_log`'a yazıyor.**
Yeni testlerin bıraktığı satırları kimse temizlemiyor. Test koşularının canlı denetim tablosunu kirletmemesi lazım — audit yazımını test ortamında devre dışı bırak veya testlerin kendi kayıtlarını temizlemesini sağla. Hangi yolu seçtiğini gerekçelendir; üretim davranışı değişmesin.

**B1.4 — Lockfile.**
`package-lock.json` Windows'ta üretildiği için Linux optional dependency'leri eksik ve CI `npm ci` yerine `npm install` kullanıyor — reprodüksiyon garantisi yok. Lockfile'ı Linux'ta bir kez üret ve CI'ı `npm ci`'a döndür. Relock alakasız bir TS hatası açarsa **dur ve söyle**, kendi başına paket sürümü yükseltme.

---

## TASK B2 — VERIFY AŞAMASI

`feat:` commit. Paketin ana işi.

Bugün `runAgent` şunu yapıyor: model turu → `parseAgentOutput` → `status: 'done'`. Yani **ajan kendi çıktısını otomatik başarılı sayıyor.** Araya VERIFY girecek.

Sözleşme: `PLAN → EXECUTE → VERIFY → LOG → COMPLETE`.

**Önce bir gerçeği kabul et:** `AgentDefinition.outputContract` bir **string** — prompt'a giren düzyazı sözleşme, makine tarafından kontrol edilebilir bir şema değil. Yani "schema validity" bugün mümkün değil. Bunu şöyle çöz:

- `AgentDefinition`'a **opsiyonel** `outputSchema?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>` alanı ekle (üst seviye alan → tip; iç içe doğrulama yok, gerekmiyor).
- Yalnız `knowledge-agent` ve bir tane daha (uygun bulduğun, `outputContract`'ı zaten net olan) için doldur. **14 ajanın hepsine yazma.**
- `outputSchema` yoksa şema kontrolü atlanır; diğer kontroller yine çalışır.

Verify kontrolleri, sırayla:

1. **Output existence** — çıktı boş, null veya boş nesne değil.
2. **Parse başarısı** — `parseAgentOutput` `{ parseError: true }` döndürdüyse verify başarısız. Bugün bu sessizce `done` olarak kaydediliyor; en somut hata bu.
3. **Schema validity** — `outputSchema` varsa üst seviye alanlar ve tipleri uyuyor mu.
4. **Tool result validity** — bu run'da `isError: true` dönen tool çağrısı varsa sonuca işlensin (run'ı otomatik düşürmesin; verify sonucunda görünsün).

Sonucun yazılması:

- Migration `0014`: `agent_runs`'a `verification jsonb` (nullable) ekle ve `status` CHECK'ini `'verify_failed'` içerecek şekilde genişlet. **Yeni tablo açma.**
- Verify geçerse `status: 'done'` + `verification` dolu. Geçmezse `status: 'verify_failed'` + hangi kontrolün neden düştüğü.
- `AgentRunResult` tipine dokunurken dikkat: `run_agent` tool'u ve `lib/runtime/executor.ts` bu sonucu okuyor. `verify_failed`'ın kuyruk tarafında ne anlama geldiğine karar ver — `failed` gibi retry'a mı düşer, terminal mi? **Kararını gerekçelendir**, sessizce seçme.
- Verify'ın kendisi ajan çalıştırmaz. LLM'e "çıktın doğru mu" diye sorma — bu deterministik bir kontrol.

---

## TASK B3 — TOKEN VE MALİYET KAYDI

`feat:` commit.

Şu an hiçbir yerde token sayısı tutulmuyor. Arka planda çalışan worker gelmeden önce bu kapatılmalı — maliyeti görmeden ajan çalıştırmak kontrol kaybıdır.

- `AITurn`'e **opsiyonel** `usage?: { inputTokens: number; outputTokens: number }` ekle. Opsiyonel olması önemli: `MockProvider` ve gelecekteki sağlayıcılar kırılmasın.
- `AnthropicProvider` SDK'nın döndürdüğü usage'ı doldursun. Streaming yolunda da mümkünse doldur; değilse **neden olmadığını yorumda belirt** ve non-streaming yolla yetin.
- Migration `0014`'e (aynı migration, ikinci tablo değil) `agent_runs`'a `input_tokens int`, `output_tokens int` ekle. Bir run'daki tüm turların toplamı.
- Para hesabı **yapma** — fiyat tablosu koda gömülmez, modeller ve fiyatlar değişir. Token sayısı yeterli; TL/dolar çevrimi sonra, UI katmanında.

---

## TASK B4 — RUN GÖRÜNÜRLÜK VERİ KATMANI

`feat:` commit. **Sadece API, UI yok.**

Bir run'a bakan birinin görmesi gereken her şeyi tek uçtan döndür: ajan, departman, bağlı task, status, `started_at`, `finished_at`, süre, output, error, verification sonucu, o run'ın tool çağrıları (`agent_logs` + `audit_log`'dan — izin verilen ve reddedilenler ayırt edilebilir), retry sayısı (`agent_tasks`'tan), token sayıları.

- Önce mevcut `app/api/agents/runs/route.ts` ve `logs/route.ts`'e bak — genişletilebiliyorsa **genişlet**, yeni route açma.
- `audit_log`'un `run_id`'si yok; tool çağrısını run'a bağlamak için bir yol lazım. En ucuz çözümü seç ve gerekçelendir (audit'e `run_id` eklemek migration `0014`'e sığar; alternatif zaman penceresiyle eşleme — bu kırılgan, tercih etme).
- Tek run detayı ve liste ayrı olsun; liste sorgusu her run için ayrı sorgu atmasın (N+1 yok).
- Bu uç bir sonraki pakette Office'i besleyecek. Şimdilik doğrulaması: `curl` ile çağrılıp içeriği gözle görülebilmeli.

---

## TASK B5 — TESTLER

`test:` commit.

- `runner.ts` çağrı başına hata yakalama: reddedilen tool run'ı düşürmüyor, model `isError` görüyor, run `done`/`verify_failed` ile bitiyor
- Bilinmeyen tool adı artık hata fırlatıyor
- Verify: her dört kontrolün ayrı ayrı başarılı ve başarısız hali
- `parseError` çıktısı `verify_failed` üretiyor
- `outputSchema` yoksa şema kontrolü atlanıyor, diğerleri çalışıyor
- Token toplamı birden fazla turda doğru toplanıyor
- Görünürlük ucu: bir run için tool çağrıları (izinli + reddedilen) doğru dönüyor

Saf mantık (verify kararı, token toplama) DB'siz test edilebilir olsun — Paket A'daki `canUseTool` deseni. DB gerektirenler env-guard'lı.

---

## TASK B6 — FİNAL DOĞRULAMA

```
AI_PROVIDER=mock npm test
AI_PROVIDER=mock npm run lint
AI_PROVIDER=mock npm run build
```

Artı CI taklidi (yukarıdaki komut). Hepsi geçmeli, Actions yeşil olmalı.

---

## ÇIKTI

Beş başlık, fazlası yok:

1. **Değişikliklerin özeti**
2. **Değişen dosyalar** — dosya başına tek satır
3. **Test / lint / build sonuçları** — gerçek sayılar
4. **Commitler** — hash + mesaj
5. **Paket C için riskler** — verify açıldıktan sonra kırılabilecek yerler, görünürlük ucunda eksik kalanlar, Brain entegrasyonuna geçmeden önce bilinmesi gerekenler

Kapsam dışına çıkma. Fikrin varsa 5. başlıkta yaz, uygulama.
