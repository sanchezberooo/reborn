// Tek bir tool çağrısının modele dönecek sonuca çevrilmesi — Sanchez Core
// (lib/sanchez/core.ts) ve ajan çalıştırıcısının (lib/agents/runner.ts)
// ORTAK sözleşmesi.
//
// NEDEN ORTAK: Paket A enforcement'ı açtıktan sonra reddedilen her çağrı
// serverExecuteTool'dan düz Error olarak fırlıyor. Sanchez bunu çağrı başına
// yakalayıp modele isError döndürüyordu; runner'da bu yoktu — Promise.all
// içindeki tek bir red, en dıştaki catch'e gidip agent_runs.status='error'
// yapıyordu. Yani ajan tek yanlış tool çağrısıyla ölüyordu. Sözleşme artık
// tek yerde yaşıyor.
//
// YENİ HATA SÖZLEŞMESİ İCAT ETMEZ: davranış lib/sanchez/core.ts'ten birebir
// devralındı — hata metni, konsol kaydı ve isError bayrağı aynı.
//
// KAPSAM: yalnız bu iki çağrı yeri. Tool döngüsünün kendisi (mesaj yığını,
// MAX_TOOL_ITERATIONS guard'ı, günlük yazımı) çağıranlarda kalır — ikisinin
// döngü ihtiyaçları farklı (streaming olayları vs. run_id'li agent_logs).

import type { AIToolResult, AIToolUse } from '@/lib/ai'
import { serverExecuteTool, type ToolExecutionContext } from './executor'

/**
 * Bir tool çağrısını yürütür ve SONUCU ASLA FIRLATMADAN döndürür: hata
 * modele `isError: true` olarak geri gider ve çağıran tur/run düşmez.
 *
 * Çağıran, günlük yazımı gibi yan etkileri sonucun `isError` alanına bakarak
 * kendisi yapar — bu yardımcı DB'ye dokunmaz.
 */
export async function runToolCall(
  toolUse: AIToolUse,
  userId: string,
  ctx: ToolExecutionContext,
): Promise<AIToolResult> {
  try {
    const result = await serverExecuteTool(toolUse.name, toolUse.input, userId, ctx)
    const content = typeof result === 'string' ? result : JSON.stringify(result)
    return { toolUseId: toolUse.id, content }
  } catch (err) {
    console.error(`[Reborn] tool ${toolUse.name} error:`, err)
    return {
      toolUseId: toolUse.id,
      content: `Hata: ${err instanceof Error ? err.message : 'Tool çalışmadı'}`,
      isError: true,
    }
  }
}
