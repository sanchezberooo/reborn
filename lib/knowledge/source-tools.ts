// Dış kaynak fetch tool tanımları — lib/brain/tools.ts deseninde
// provider-bağımsız JSON şemalar. Davranışlar lib/knowledge/source-fetcher.ts
// içinde, çağrı lib/agents/executor.ts serverExecuteTool() switch'inde; yeni
// source tool'u eklerken ÜÇÜNÜ birlikte güncelle. Bu dosya yalnız şema içerir
// ('server-only' değil).
//
// KİM HANGİ TOOL'U KULLANABİLİR (yapısal/isimsel ayrım — gerçek
// yetkilendirme/Auth DEĞİL; brain/tools.ts notuyla aynı):
//   * fetch_source_overview, fetch_source_content → SADECE Knowledge
//     Agent'ın tool listesinde (rapor modunun dış-kaynak gözü).
//
// GÜVENLİK: şema ne derse desin domain whitelist'i (YALNIZ github.com) kod
// seviyesinde source-fetcher.ts'te uygulanır — modele güvenilmez. Bu
// tool'ların hiçbiri Brain'e yazmaz: salt okuma, rapor ephemeral.

import type { AIToolDef } from '../ai/provider'

export const SOURCE_TOOLS: AIToolDef[] = [
  {
    name: 'fetch_source_overview',
    description:
      "Bir GitHub reposunun ucuz ön-bakışını çeker: metadata (açıklama, yıldız, dil, topics) + README'nin ilk ~2000 karakteri. Brain'e HİÇBİR ŞEY yazmaz — salt okuma. Yalnız github.com/{owner}/{repo} linkleri kabul edilir. SADECE Knowledge Agent içindir.",
    inputSchema: {
      type: 'object',
      properties: {
        sourceUrl: {
          type: 'string',
          description: 'Kaynak URL — yalnız https://github.com/{owner}/{repo} biçimi kabul edilir',
        },
        sourceType: {
          type: 'string',
          enum: ['github'],
          description: "Kaynak türü (varsayılan ve v1'de tek desteklenen değer: 'github')",
        },
      },
      required: ['sourceUrl'],
    },
  },
  {
    name: 'fetch_source_content',
    description:
      "Bir GitHub reposundan belirli dosyaların ham içeriğini çeker (derin çekim). Sınır: en fazla 5 dosya, toplam 50KB — aşan kısım nazikçe atlanır. SADECE ön-bakış (fetch_source_overview) devam etmeye değer sinyali verdiyse VEYA kullanıcı derinlemesine bakılmasını istediyse çağır; otomatik/koşulsuz çağırma. Brain'e HİÇBİR ŞEY yazmaz — salt okuma. SADECE Knowledge Agent içindir.",
    inputSchema: {
      type: 'object',
      properties: {
        sourceUrl: {
          type: 'string',
          description: 'Kaynak URL — yalnız https://github.com/{owner}/{repo} biçimi kabul edilir',
        },
        sourceType: {
          type: 'string',
          enum: ['github'],
          description: "Kaynak türü (varsayılan ve v1'de tek desteklenen değer: 'github')",
        },
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: "Çekilecek repo-göreli dosya yolları (örn 'src/index.ts') — en fazla 5",
        },
      },
      required: ['sourceUrl'],
    },
  },
]
