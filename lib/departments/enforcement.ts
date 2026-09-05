// Runtime capability enforcement — registry.ts'teki statik doğrulamanın
// (validateRoster, TEST zamanı) çalışma-zamanı karşılığı. Sprint 2'de
// yazılan not artık geçerli değil: ihlal yalnız CI'da kırmızı test olarak
// değil, çağrı anında da yakalanır.
//
// İKİNCİ BİR İZİN SİSTEMİ DEĞİLDİR: karar aynı iki tablodan çıkar —
// TOOL_CAPABILITIES (tool → yetenek) ve DEPARTMENTS (departman → izin).
// Buradaki tek yenilik, kararın test zamanından çağrı anına taşınması.
//
// SAF: DB, env, I/O, yan etki yok. Yürütmeden (lib/agents/executor.ts)
// bilinçli ayrıdır — yetki kararı, yürütmenin başarısından bağımsız olarak
// tek başına ve DB'siz doğrulanabilmeli.

import { getAgent } from '../agents/registry'
import { departmentEffect, getDepartment, TOOL_CAPABILITIES } from './registry'
import type { CapabilityId, DepartmentId } from './types'

/**
 * Enforcement'tan muaf TEK ad. Sanchez bir departman DEĞİLDİR (bkz.
 * lib/departments/types.ts başlığı): tek muhatap ilkesi gereği tüm
 * departmanların ÜSTÜNDE durur, tam tool setiyle çalışır ve bu yüzden
 * AGENTS registry'sinde kaydı yoktur — departman izniyle çözülemez,
 * çözülmeye çalışılsaydı her çağrısı reddedilirdi.
 *
 * Muafiyet bu literal ada bağlıdır, "AGENTS'ta bulunamadı"ya DEĞİL:
 * bilinmeyen her çağıran unknown-agent ile reddedilir.
 */
export const ENFORCEMENT_EXEMPT_AGENT = 'sanchez'

export type ToolDenyReason =
  /** Tool yetenek sözlüğünde eşlenmemiş — sınıflandırılmamış tool yetki
   *  modelinin dışına çıkamaz. */
  | 'unmapped-tool'
  /** callerAgent verilmemiş veya AGENTS'ta yok. */
  | 'unknown-agent'
  /** Ajanın department alanı boş ya da tanımlı bir departman değil. */
  | 'unknown-department'
  /** Departman izin listesinde 'allowed' değil (açık forbidden VEYA hiç
   *  listelenmemiş — default-deny). */
  | 'capability-forbidden'
  /** Yetenek insan onayından geçmeli; onay katmanı henüz YOK, dolayısıyla
   *  reddedilir. Sessizce izin verilmez — ayrı gerekçe olması, onay katmanı
   *  geldiğinde bu satırların ayıklanabilmesi içindir. */
  | 'approval-required'

interface ToolAccessAllowed {
  allowed: true
  /** true: Sanchez muafiyeti · false: departman izni. Denetim satırı
   *  ikisini ayırt edebilsin diye taşınır. */
  exempt: boolean
  capability: CapabilityId | null
  department: DepartmentId | null
}

interface ToolAccessDenied {
  allowed: false
  reason: ToolDenyReason
  capability: CapabilityId | null
  department: DepartmentId | null
  /** Modele dönecek GÜVENLİ metin (bkz. denyMessage). */
  message: string
}

export type ToolAccessDecision = ToolAccessAllowed | ToolAccessDenied

/**
 * Modele dönen red metni.
 *
 * GÜVENLİK SINIRI: yalnız çağrılan tool'un adı (model zaten biliyor) ve
 * varsa eksik yeteneğin adı geçer. İzin tablosu, departman listesi, başka
 * tool adları veya ajan listesi SIZDIRILMAZ — model reddedildiğini
 * öğrenmeli, yetki haritasını değil.
 */
function denyMessage(
  reason: ToolDenyReason,
  toolName: string,
  capability: CapabilityId | null,
): string {
  switch (reason) {
    case 'unmapped-tool':
      return `Tool '${toolName}' reddedildi: yetenek sözlüğünde sınıflandırılmamış.`
    case 'unknown-agent':
      return `Tool '${toolName}' reddedildi: çağıran ajan kimliği doğrulanamadı.`
    case 'unknown-department':
      return `Tool '${toolName}' reddedildi: çağıran ajanın departman ataması geçersiz.`
    case 'approval-required':
      return `Tool '${toolName}' reddedildi: '${capability}' yeteneği insan onayı gerektiriyor, onay katmanı henüz yok.`
    case 'capability-forbidden':
      return `Tool '${toolName}' reddedildi: '${capability}' yeteneği bu ajana verilmemiş.`
  }
}

function deny(
  reason: ToolDenyReason,
  toolName: string,
  capability: CapabilityId | null,
  department: DepartmentId | null,
): ToolAccessDenied {
  return { allowed: false, reason, capability, department, message: denyMessage(reason, toolName, capability) }
}

/**
 * Bir çağıranın bir tool'u kullanıp kullanamayacağının kararı.
 *
 * Çözüm hattı (default-deny — hiçbir adım "bilmiyorsam izin ver" demez):
 *   callerAgent → AGENTS[callerAgent].department → DEPARTMENTS[department]
 *   → TOOL_CAPABILITIES[toolName] → effect
 *
 * `input` BİLİNÇLİ parametre değildir: yetki tool'un kimliğine bağlıdır,
 * argümanlarına değil — modelin girdisi kararı etkileyemez.
 */
export function canUseTool(callerAgent: string | undefined, toolName: string): ToolAccessDecision {
  const capability = TOOL_CAPABILITIES[toolName] ?? null

  // ── Sanchez muafiyeti — TEK YER ────────────────────────────────────────
  // Muaf ≠ izsiz: çağrı yine audit_log'a yazılır (lib/agents/executor.ts).
  if (callerAgent === ENFORCEMENT_EXEMPT_AGENT) {
    return { allowed: true, exempt: true, capability, department: null }
  }

  if (!capability) return deny('unmapped-tool', toolName, null, null)
  if (!callerAgent) return deny('unknown-agent', toolName, capability, null)

  const agent = getAgent(callerAgent)
  if (!agent) return deny('unknown-agent', toolName, capability, null)

  const department = agent.department ? getDepartment(agent.department) : null
  if (!department) return deny('unknown-department', toolName, capability, null)

  const effect = departmentEffect(department, capability)
  if (effect === 'allowed') {
    return { allowed: true, exempt: false, capability, department: department.id }
  }
  if (effect === 'approval-required') {
    return deny('approval-required', toolName, capability, department.id)
  }
  return deny('capability-forbidden', toolName, capability, department.id)
}
