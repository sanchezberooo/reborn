// Agent Brain tool tanımları — lib/ai/tools.ts deseninde provider-bağımsız
// JSON şemalar. Davranışları lib/agents/executor.ts serverExecuteTool()
// switch'inde; yeni brain tool'u eklerken İKİSİNİ birlikte güncelle. Bu dosya
// yalnız şema içerir ('server-only' değil); DB erişimi executor'ın çağırdığı
// node-repository/link-registry/query katmanlarındadır.
//
// KİM HANGİ TOOL'U KULLANABİLİR (yapısal/isimsel ayrım — gerçek
// yetkilendirme/Auth DEĞİL; bu fazda her çağıran her tool'u çağırabilir,
// ayrım registry'deki toolNames listeleriyle uygulanır):
//   * brain_read_signals, brain_integrate → SADECE Knowledge Agent'ın tool
//     listesinde (privileged entegrasyon yolu).
//   * brain_link, brain_get_node → her ajana açık olabilir (okuma/keşif
//     serbest).

import type { AIToolDef } from '../ai/provider'
import { COLD_NODE_TYPES, LINK_TYPES } from './types'

/** brain_read_signals limit sınırları (§5: max 20, default 10) — executor
 *  aynı sabitlerle kırpar, modele güvenilmez. */
export const BRAIN_READ_SIGNALS_DEFAULT_LIMIT = 10
export const BRAIN_READ_SIGNALS_MAX_LIMIT = 20

export const BRAIN_TOOLS: AIToolDef[] = [
  {
    name: 'brain_read_signals',
    description:
      "Agent Brain sıcak katmanındaki bekleyen sinyalleri okur (status='gözlemlenen', en eskiden yeniye). SADECE Knowledge Agent içindir.",
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maksimum sinyal sayısı (varsayılan: 10, en fazla: 20)' },
      },
      required: [],
    },
  },
  {
    name: 'brain_integrate',
    description:
      "Bir sinyali Soğuk Katman bilgisine damıtır: yeni cold node yaratır ve sinyale derived_from kenarı kurar. targetType 7 tanımlı tipten biri olmak ZORUNDA. SADECE Knowledge Agent içindir.",
    inputSchema: {
      type: 'object',
      properties: {
        signalId:   { type: 'string', description: 'Kaynak sinyalin UUID kimliği' },
        targetType: { type: 'string', enum: [...COLD_NODE_TYPES], description: `Hedef soğuk tip: ${COLD_NODE_TYPES.join(' | ')}` },
        content:    { type: 'string', description: 'Damıtılmış bilgi metni' },
      },
      required: ['signalId', 'targetType', 'content'],
    },
  },
  {
    name: 'brain_link',
    description:
      'Agent Brain içinde iki node arasına tipli ilişki kenarı kurar. linkType 9 tanımlı tipten biri olmak ZORUNDA.',
    inputSchema: {
      type: 'object',
      properties: {
        fromId:   { type: 'string', description: 'Kaynak node UUID' },
        toId:     { type: 'string', description: 'Hedef node UUID' },
        linkType: { type: 'string', enum: [...LINK_TYPES], description: `İlişki tipi: ${LINK_TYPES.join(' | ')}` },
      },
      required: ['fromId', 'toId', 'linkType'],
    },
  },
  {
    name: 'brain_get_node',
    description: "Agent Brain'den tek bir node'u id ile okur; bulunamazsa null döner.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Node UUID' },
      },
      required: ['id'],
    },
  },
]
