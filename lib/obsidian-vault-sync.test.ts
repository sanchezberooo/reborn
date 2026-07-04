import { afterAll, describe, expect, it } from 'vitest'
import { FIXTURE_USER_ID } from '../scripts/fixture-data'
import type { VaultFile } from './obsidian-sync'

// Obsidian vault → entities/links senkronu entegrasyon testi (Faz 2, Görev 5)
// — journal-sync.test.ts / goals-sync.test.ti deseni: canlı Supabase + gerçek
// bge-m3; env yoksa skip. GERÇEK KASAYA BAĞLANMAZ: syncObsidianVaultNotes
// doğrudan sahte VaultFile[] alır (fs okuma syncObsidianVault'ta, ayrı ve
// burada test edilmez) — "sahte .md dosyalarıyla, gerçek kasaya bağlanmadan"
// koşulu böylece sağlanır. Kayıtlar FIXTURE_USER_ID altında, afterAll'da
// temizlenir.

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function dbApi() {
  return import('./db-server')
}
async function adminApi() {
  const { getSupabaseAdmin } = await import('./supabase-admin')
  return getSupabaseAdmin()
}
async function retrievalApi() {
  return import('./ai/retrieval')
}

const syncIndexReady = hasEnv
  ? await (async () => {
      const supabase = await adminApi()
      const { error } = await supabase.from('obsidian_sync_index').select('vault_path').limit(1)
      if (error) {
        console.warn(
          `[obsidian-vault-sync.test] obsidian_sync_index tablosu yok (${error.code}) — migration 0004 uygulanınca bu suite koşar.`,
        )
        return false
      }
      return true
    })()
  : false

// Fixture setinde eşi olmayan benzersiz içerikler (retrieval doğrulaması).
const ROOT_TEXT =
  'Turkuaz mercan resifinde dalış rehberi olmak — obsidian senkron testine özgü benzersiz kök not.'
const CHILD_TEXT =
  'Resif haritalama tekniği — obsidian senkron testinin benzersiz alt notu, kök nota wikilink verir.'
const UPDATED_ROOT_TEXT = `${ROOT_TEXT} Güncelleme: sertifika programı eklendi.`

function vaultFiles(rootBody: string): VaultFile[] {
  return [
    {
      relativePath: 'Reborn Vizyon/Kök Not.md',
      content: `---\ntags: [test]\n---\n${rootBody}\n\nBkz [[Alt Not]].`,
    },
    {
      relativePath: 'Reborn Vizyon/Alt Not.md',
      content: CHILD_TEXT,
    },
  ]
}

describe.skipIf(!hasEnv || !syncIndexReady)('obsidian vault senkronu (canlı Supabase + bge-m3)', () => {
  const createdEntityIds: string[] = []

  afterAll(async () => {
    const supabase = await adminApi()
    for (const id of createdEntityIds) {
      await supabase.from('entities').delete().eq('id', id)
    }
  })

  let rootId: string
  let childId: string

  it('yeni kasa: iki dosya native entity (type=note, source_table NULL) olarak yaratılır, wikilink kenarı kurulur', async () => {
    const { syncObsidianVaultNotes } = await dbApi()
    const result = await syncObsidianVaultNotes(FIXTURE_USER_ID, vaultFiles(ROOT_TEXT))
    expect(result.created).toBe(2)
    expect(result.updated).toBe(0)
    expect(result.deleted).toBe(0)
    expect(result.linked).toBe(1)

    const supabase = await adminApi()
    const { data: index } = await supabase
      .from('obsidian_sync_index')
      .select('vault_path, entity_id')
      .eq('user_id', FIXTURE_USER_ID)
      .in('vault_path', ['Reborn Vizyon/Kök Not.md', 'Reborn Vizyon/Alt Not.md'])
    expect(index).toHaveLength(2)
    rootId = index!.find((r) => r.vault_path === 'Reborn Vizyon/Kök Not.md')!.entity_id as string
    childId = index!.find((r) => r.vault_path === 'Reborn Vizyon/Alt Not.md')!.entity_id as string
    createdEntityIds.push(rootId, childId)

    const { data: rootEntity } = await supabase
      .from('entities')
      .select('type, title, content, source_table, source_id, embedding, user_id')
      .eq('id', rootId)
      .single()
    expect(rootEntity!.type).toBe('note')
    expect(rootEntity!.source_table).toBeNull() // NATIVE mod — köprü değil
    expect(rootEntity!.source_id).toBeNull()
    expect(rootEntity!.title).toBe('Kök Not')
    expect(rootEntity!.content).not.toContain('tags: [test]') // frontmatter ayıklandı
    expect(rootEntity!.content).toContain(ROOT_TEXT)
    expect(JSON.parse(rootEntity!.embedding as string) as number[]).toHaveLength(1024)

    const { data: links } = await supabase
      .from('links')
      .select('target_entity_id, kind')
      .eq('source_entity_id', rootId)
    expect(links).toHaveLength(1)
    expect(links![0].target_entity_id).toBe(childId)
    expect(links![0].kind).toBe('wikilink')
  }, 600_000) // ilk koşuda model yüklemesi burada ödenir

  it("kök not hibrit retrieval'da bulunuyor", async () => {
    const { hybridRetrieve } = await retrievalApi()
    const results = await hybridRetrieve('mercan resifinde dalış rehberi', {
      userId: FIXTURE_USER_ID,
      limit: 5,
    })
    expect(results.some((r) => r.id === rootId)).toBe(true)
  }, 120_000)

  it('değişmeyen dosyada yeniden senkron: embedding yeniden hesaplanmaz, çoğaltma olmaz', async () => {
    const { syncObsidianVaultNotes } = await dbApi()
    const result = await syncObsidianVaultNotes(FIXTURE_USER_ID, vaultFiles(ROOT_TEXT))
    expect(result.created).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.linked).toBe(1) // wikilink her senkronda yeniden kurulur (idempotent)

    const supabase = await adminApi()
    const { data: index } = await supabase
      .from('obsidian_sync_index')
      .select('vault_path')
      .eq('user_id', FIXTURE_USER_ID)
      .in('vault_path', ['Reborn Vizyon/Kök Not.md', 'Reborn Vizyon/Alt Not.md'])
    expect(index).toHaveLength(2) // çoğaltma yok
  }, 120_000)

  it('değişen dosya içeriği: embedding tazelenir, aynı entity güncellenir (çoğaltma yok)', async () => {
    const { syncObsidianVaultNotes } = await dbApi()
    const result = await syncObsidianVaultNotes(FIXTURE_USER_ID, vaultFiles(UPDATED_ROOT_TEXT))
    expect(result.created).toBe(0)
    expect(result.updated).toBe(1)

    const supabase = await adminApi()
    const { data: rootEntity } = await supabase.from('entities').select('id, content').eq('id', rootId).single()
    expect(rootEntity!.id).toBe(rootId) // aynı entity — çoğaltma yok
    expect(rootEntity!.content).toContain('sertifika programı eklendi')
  }, 120_000)

  it("kaldırılan [[wikilink]]: bir sonraki senkronda kenar düşer", async () => {
    const { syncObsidianVaultNotes } = await dbApi()
    const filesNoLink: VaultFile[] = [
      { relativePath: 'Reborn Vizyon/Kök Not.md', content: UPDATED_ROOT_TEXT },
      { relativePath: 'Reborn Vizyon/Alt Not.md', content: CHILD_TEXT },
    ]
    const result = await syncObsidianVaultNotes(FIXTURE_USER_ID, filesNoLink)
    expect(result.linked).toBe(0)

    const supabase = await adminApi()
    const { data: links } = await supabase.from('links').select('id').eq('source_entity_id', rootId)
    expect(links).toHaveLength(0)
  }, 120_000)

  it('kasadan silinen dosya: entity de senkronda silinir, retrieval\'a çıkmaz', async () => {
    const { syncObsidianVaultNotes } = await dbApi()
    const onlyChild: VaultFile[] = [{ relativePath: 'Reborn Vizyon/Alt Not.md', content: CHILD_TEXT }]
    const result = await syncObsidianVaultNotes(FIXTURE_USER_ID, onlyChild)
    expect(result.deleted).toBe(1)

    const supabase = await adminApi()
    const { data: entityRows } = await supabase.from('entities').select('id').eq('id', rootId)
    expect(entityRows).toHaveLength(0)
    const { data: indexRows } = await supabase
      .from('obsidian_sync_index')
      .select('vault_path')
      .eq('vault_path', 'Reborn Vizyon/Kök Not.md')
    expect(indexRows).toHaveLength(0) // FK cascade ile düştü

    const { hybridRetrieve } = await retrievalApi()
    const results = await hybridRetrieve('mercan resifinde dalış rehberi', {
      userId: FIXTURE_USER_ID,
      limit: 5,
    })
    expect(results.some((r) => r.id === rootId)).toBe(false)
  }, 120_000)
})
