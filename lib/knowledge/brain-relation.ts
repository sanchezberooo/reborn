// Rapor modunun "Brain ile İlişki" hesaplayıcısı — fetch_source_overview
// executor case'i başarılı ön-bakıştan sonra bunu çağırıp sonucu tool
// çıktısına brainRelation alanı olarak ekler. SALT OKUMA: hybridRetrieveScoped
// (scope='agent') üzerinden Agent Brain'de benzerlik araması yapar, hiçbir
// şey yazmaz.
//
// TASARIM İLKESİ (referans plan): Similarity Level embedding mesafesine göre
// EŞİK-TABANLIDIR ve modele/rapora KESİN YÜZDE/SAYISAL SKOR SIZMAZ — ham
// kosinüs skorları burada Low/Medium/High'a çevrilir, tool sonucunda sayı
// taşınmaz. Confidence, Brain'in o alandaki içerik hacmine bakar: ilgili node
// azsa Confidence düşüktür.

import 'server-only'

export type LowMediumHigh = 'Low' | 'Medium' | 'High'

/** Eşikler bge-m3 kosinüs benzerliği içindir (ilişkili metin ~0.6-0.8,
 *  ilişkisiz ~0.3-0.5 bandı) — kalibrasyon gerekirse TEK yer burası. */
export const SIMILARITY_HIGH_THRESHOLD = 0.75
export const SIMILARITY_MEDIUM_THRESHOLD = 0.55
/** Bu tabanın altındaki eşleşmeler "ilgili node" sayılmaz. */
export const RELATED_NODE_FLOOR = 0.45

/** Confidence node sayısı eşikleri: ≥5 High, 2-4 Medium, 0-1 Low. */
export const CONFIDENCE_HIGH_MIN_NODES = 5
export const CONFIDENCE_MEDIUM_MIN_NODES = 2

const RELATED_NODE_LIMIT = 8
const SNIPPET_MAX = 200

export interface BrainRelatedNode {
  id: string
  type: string
  title: string
  /** İçeriğin ilk ~200 karakteri — raporun "Existing Related Knowledge"
   *  özetine malzeme; sayısal benzerlik BİLİNÇLİ olarak yok. */
  snippet: string
}

export interface BrainRelation {
  relatedNodes: BrainRelatedNode[]
  similarityLevel: LowMediumHigh
  confidence: LowMediumHigh
  /** Arama yapılamadıysa (embedding/DB hatası, boş sorgu) gerekçe. */
  note?: string
}

/** En yüksek kosinüs benzerliğini eşik-tabanlı seviyeye çevirir (sayı dışarı
 *  sızmaz). Hiç eşleşme yoksa null → Low. */
export function mapSimilarityLevel(topSimilarity: number | null): LowMediumHigh {
  if (topSimilarity === null) return 'Low'
  if (topSimilarity >= SIMILARITY_HIGH_THRESHOLD) return 'High'
  if (topSimilarity >= SIMILARITY_MEDIUM_THRESHOLD) return 'Medium'
  return 'Low'
}

/** İlgili node sayısını Confidence seviyesine çevirir — Brain'de o alanda
 *  içerik azsa Confidence düşük (referans plan şartı). */
export function mapConfidence(relatedCount: number): LowMediumHigh {
  if (relatedCount >= CONFIDENCE_HIGH_MIN_NODES) return 'High'
  if (relatedCount >= CONFIDENCE_MEDIUM_MIN_NODES) return 'Medium'
  return 'Low'
}

const EMPTY_RELATION: BrainRelation = {
  relatedNodes: [],
  similarityLevel: 'Low',
  confidence: 'Low',
}

/**
 * Kaynak metnini (açıklama + topics + README kesiti) Agent Brain'e karşı
 * arar ve rapor için hazır ilişki özeti döner. Beklenen hatalarda fırlatmaz —
 * ön-bakışın değerini düşürmemek için Low/Low + note ile döner.
 */
export async function buildBrainRelation(queryText: string, userId: string): Promise<BrainRelation> {
  const query = queryText.replace(/\s+/g, ' ').trim()
  if (!query) {
    return { ...EMPTY_RELATION, note: 'Karşılaştırılacak kaynak metni yok (boş açıklama/README).' }
  }

  try {
    const { hybridRetrieveScoped } = await import('@/lib/brain/query')
    const hits = await hybridRetrieveScoped(query, 'agent', { userId, limit: RELATED_NODE_LIMIT })
    const related = hits.filter((h) => h.similarity >= RELATED_NODE_FLOOR)
    const top = related.length > 0 ? Math.max(...related.map((h) => h.similarity)) : null

    return {
      relatedNodes: related.map((h) => {
        const flat = (h.content ?? '').replace(/\s+/g, ' ').trim()
        return {
          id: h.id,
          type: h.type,
          title: h.title,
          snippet: flat.length > SNIPPET_MAX ? `${flat.slice(0, SNIPPET_MAX)}…` : flat,
        }
      }),
      similarityLevel: mapSimilarityLevel(top),
      confidence: mapConfidence(related.length),
    }
  } catch (err) {
    return {
      ...EMPTY_RELATION,
      note: `Brain araması yapılamadı: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
