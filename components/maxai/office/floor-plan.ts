// MAXAİ Ofis kat planı verisi (Sprint 7) — sahne artık dekor değil, şirket
// organizasyonunun haritasıdır: oda listesi lib/company/registry.ts'ten
// (13 departman) türetilir; departman eklenirse/adı değişirse plan otomatik
// izler. OfficeLayout.tsx yalnız çizer — geometri ve oda anlamı burada yaşar.
//
// Yerleşim (tile koordinatı, x=col y=row):
//   üst kat   : Sanchez Ofisi · Executive Council · Agent Intelligence Core
//   orta bant : Common Area (geniş hol — legacy ajanların oturduğu yer)
//   alt katlar: 13 departman odası (7 + 6, iki sıra), aralarında koridor
// Duvarlar elle çizilmez: zemine 8-komşulukla değen boş hücre otomatik duvar
// olur (OfficeLayout buildGrid) — kapılar bu yüzden zemin şeritleridir.

import { listCompanyDepartments } from '@/lib/company/registry'
import type { CompanyDepartmentId } from '@/lib/company/types'

export const COLS = 60
export const ROWS = 42
export const T = 8 // SVG birimi / tile

export interface Rect { x: number; y: number; w: number; h: number }
export interface Room extends Rect { sign: string }
export interface DeptRoom extends Room { id: CompanyDepartmentId }

// ── özel alanlar ─────────────────────────────────────────────────────────────

export const SANCHEZ_OFFICE: Room = { x: 2, y: 2, w: 16, h: 9, sign: 'Sanchez Ofisi' }
export const EXECUTIVE_COUNCIL_ROOM: Room = { x: 20, y: 2, w: 20, h: 9, sign: 'Executive Council' }
export const INTELLIGENCE_CORE: Room = { x: 42, y: 2, w: 15, h: 9, sign: 'Intelligence Core' }
export const COMMON_AREA: Room = { x: 2, y: 13, w: 55, h: 5, sign: 'Common Area' }

// ── departman odaları ────────────────────────────────────────────────────────
// İki sıra: üst 7, alt 6. Sıra COMPANY_DEPARTMENT_IDS sırasıdır (organizasyon
// şeması sırası) — oda konumu departman id'sine değil sıraya bağlıdır.

const DEPT_W = 7
const DEPT_H = 7
const ROW_B_Y = 20 // Common Area'nın altı
const ROW_C_Y = 33 // koridorun altı
const ROW_B_XS = [2, 10, 18, 26, 34, 42, 50]
const ROW_C_XS = [6, 14, 22, 30, 38, 46]

export const DEPT_ROOMS: DeptRoom[] = listCompanyDepartments().map((department, i) => {
  const inRowB = i < ROW_B_XS.length
  return {
    id: department.id,
    sign: department.shortName,
    x: inRowB ? ROW_B_XS[i] : ROW_C_XS[i - ROW_B_XS.length],
    y: inRowB ? ROW_B_Y : ROW_C_Y,
    w: DEPT_W,
    h: DEPT_H,
  }
})

/** Departman odasının masa çapası — masa 3 tile geniş, odada ortalanır. */
export function deptDeskAnchor(room: DeptRoom): { x: number; y: number } {
  return { x: room.x + 2, y: room.y + 2.2 }
}

// ── koridor + kapılar ────────────────────────────────────────────────────────

const CORRIDOR: Rect = { x: 2, y: 29, w: 55, h: 2 }

/** Üst kat odalarının Common Area'ya inen kapıları (2 tile geniş). */
const TOP_DOORS: Rect[] = [
  { x: 9, y: 11, w: 2, h: 2 },   // Sanchez
  { x: 29, y: 11, w: 2, h: 2 },  // Council
  { x: 48, y: 11, w: 2, h: 2 },  // Core
]

// Departman kapıları: üst sıra hem Common Area'ya (kuzey) hem koridora
// (güney) açılır; alt sıra koridora (kuzey) açılır. Kapı = oda ortasında
// 2 tile'lık zemin şeridi.
const DEPT_DOORS: Rect[] = [
  ...ROW_B_XS.flatMap((x) => [
    { x: x + 3, y: 18, w: 2, h: 2 },  // Common Area → oda
    { x: x + 3, y: 27, w: 2, h: 2 },  // oda → koridor
  ]),
  ...ROW_C_XS.map((x) => ({ x: x + 3, y: 31, w: 2, h: 2 })), // koridor → oda
]

// ── zemin listesi (OfficeLayout buildGrid girdisi) ──────────────────────────

export const FLOOR_RECTS: Rect[] = [
  SANCHEZ_OFFICE,
  EXECUTIVE_COUNCIL_ROOM,
  INTELLIGENCE_CORE,
  COMMON_AREA,
  CORRIDOR,
  ...DEPT_ROOMS,
  ...TOP_DOORS,
  ...DEPT_DOORS,
]

/** Common Area'daki legacy ajan pozisyonları — emekli ajanlar departman
 *  odalarına girmez, holde oturur (Panel'deki Legacy rafının sahne karşılığı).
 *  Sol taraf mobilyaya ayrıldı; koltuk sayısından fazlası çizilmez. */
export const COMMON_SEAT_XS = [22, 27, 32, 37, 42, 47, 52]
export const COMMON_SEAT_Y = 13.5
