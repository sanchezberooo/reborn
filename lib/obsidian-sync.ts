// Obsidian vault senkronu — saf ayrıştırma katmanı (Faz 2, Görev 5).
// Referans: docs/reborn-master-roadmap.md Faz 2 "Import v1 — Obsidian vault
// senkronu". Bu dosya BİLİNÇLİ olarak fs/DB'den bağımsızdır (local-embedding.ts
// gibi ağır sunucu bağımlılığı yok) — vault okuma (fs) ve yazma (Supabase)
// lib/db-server.ts'te yaşar, ayrıştırma mantığı burada testlenebilir kalır.

/** Kasadan okunan tek dosya — relativePath vault köküne göredir (ör.
 *  "Reborn Vizyon/Vizyon.md"), kimlik anahtarı olarak kullanılır (rename
 *  = silme+yaratma; Obsidian'ın kendisi de vault-genelinde tekil dosya adı
 *  varsayar). */
export interface VaultFile {
  relativePath: string
  content: string
}

export interface ParsedNote {
  relativePath: string
  /** Dosya adı (uzantısız) — entity title'ı. */
  title: string
  /** Frontmatter'ı çıkarılmış gövde — entity content'i ve embedding girdisi. */
  content: string
  /** [[wikilink]] hedeflerinin başlıkları — tekilleştirilmiş, kendine referans hariç. */
  wikilinks: string[]
}

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

/** [[Not]], [[Not|Görünen ad]], [[Not#Başlık]], ![[Not]] biçimlerinin hepsini
 *  yakalar — alias/heading kısmı atılır, yalnız hedef not adı kalır. */
function extractWikilinks(content: string, selfTitle: string): string[] {
  const targets = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(content))) {
    const target = match[1].split('|')[0].split('#')[0].trim()
    if (target && target !== selfTitle) targets.add(target)
  }
  return [...targets]
}

/** YAML frontmatter bloğunu (varsa) gövdeden ayıklar — embedding gürültü
 *  yerine gerçek içeriği temsil etsin diye (journal'daki deriveJournalEntityText
 *  gerekçesiyle aynı). Kapanış "---" bulunamazsa frontmatter yok sayılır. */
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw.trim()
  const closingIdx = raw.indexOf('\n---', 3)
  if (closingIdx === -1) return raw.trim()
  const afterIdx = raw.indexOf('\n', closingIdx + 1)
  return (afterIdx === -1 ? '' : raw.slice(afterIdx + 1)).trim()
}

function titleFromPath(relativePath: string): string {
  const base = relativePath.split(/[\\/]/).pop() ?? relativePath
  return base.endsWith('.md') ? base.slice(0, -3) : base
}

export function parseVaultFile(file: VaultFile): ParsedNote {
  const title = titleFromPath(file.relativePath)
  return {
    relativePath: file.relativePath,
    title,
    content: stripFrontmatter(file.content),
    // Wikilink'ler ham içerikten okunur — frontmatter'da nadiren de olsa
    // referans olabilir, ayıklama yalnız depolanan content'i etkiler.
    wikilinks: extractWikilinks(file.content, title),
  }
}

export function parseVaultFiles(files: VaultFile[]): ParsedNote[] {
  return files.map(parseVaultFile)
}
