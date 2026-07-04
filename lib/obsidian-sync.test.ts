import { describe, expect, it } from 'vitest'
import { parseVaultFile, parseVaultFiles } from './obsidian-sync'

// Saf ayrıştırma testleri (Faz 2, Görev 5) — fs/DB'siz, env gerektirmez.
// DB'ye yazan senkron mantığı lib/obsidian-vault-sync.test.ts'te (canlı
// Supabase + bge-m3, env yoksa skip) ayrıca doğrulanır.

describe('parseVaultFile', () => {
  it('dosya adından (uzantısız) title türetir', () => {
    const note = parseVaultFile({ relativePath: 'Reborn Vizyon/Vizyon.md', content: 'İçerik.' })
    expect(note.title).toBe('Vizyon')
    expect(note.relativePath).toBe('Reborn Vizyon/Vizyon.md')
  })

  it('ters slash (Windows) yolunda da yalnız dosya adını alır', () => {
    const note = parseVaultFile({ relativePath: 'Reborn Vizyon\\Manifesto.md', content: 'x' })
    expect(note.title).toBe('Manifesto')
  })

  it('frontmatter varsa gövdeden çıkarır, yoksa dokunmaz', () => {
    const withFm = parseVaultFile({
      relativePath: 'A.md',
      content: '---\ntags: [vizyon]\n---\nGerçek gövde metni.',
    })
    expect(withFm.content).toBe('Gerçek gövde metni.')

    const withoutFm = parseVaultFile({ relativePath: 'B.md', content: 'Düz metin.' })
    expect(withoutFm.content).toBe('Düz metin.')
  })

  it('kapanışsız frontmatter (bozuk "---") yok sayılır, tüm içerik korunur', () => {
    const note = parseVaultFile({ relativePath: 'C.md', content: '---\nkapanmamış blok devam ediyor' })
    expect(note.content).toContain('kapanmamış blok devam ediyor')
  })

  it('[[wikilink]], [[wikilink|alias]] ve [[wikilink#heading]] hedeflerini çıkarır', () => {
    const note = parseVaultFile({
      relativePath: 'Vizyon.md',
      content: 'Bkz [[Manifesto]] ve [[Yol Haritası|roadmap]] ayrıca [[Manifesto#giriş]].',
    })
    expect(note.wikilinks.sort()).toEqual(['Manifesto', 'Yol Haritası'])
  })

  it('embed sözdizimi ![[Not]] da wikilink olarak sayılır', () => {
    const note = parseVaultFile({ relativePath: 'A.md', content: '![[Diyagram]]' })
    expect(note.wikilinks).toEqual(['Diyagram'])
  })

  it('kendine referans wikilink listesinden hariç tutulur', () => {
    const note = parseVaultFile({ relativePath: 'Vizyon.md', content: 'Bkz [[Vizyon]] ve [[Manifesto]].' })
    expect(note.wikilinks).toEqual(['Manifesto'])
  })

  it('aynı hedefe tekrarlanan linkler tekilleştirilir', () => {
    const note = parseVaultFile({ relativePath: 'A.md', content: '[[Manifesto]] ... [[Manifesto]]' })
    expect(note.wikilinks).toEqual(['Manifesto'])
  })

  it('wikilink içermeyen içerikte boş dizi döner', () => {
    const note = parseVaultFile({ relativePath: 'A.md', content: 'Sıradan metin.' })
    expect(note.wikilinks).toEqual([])
  })
})

describe('parseVaultFiles', () => {
  it('dosya listesini sırayla ParsedNote listesine çevirir', () => {
    const notes = parseVaultFiles([
      { relativePath: 'Reborn Vizyon/Vizyon.md', content: 'Bkz [[Manifesto]].' },
      { relativePath: 'Reborn Vizyon/Manifesto.md', content: 'Kök belge.' },
    ])
    expect(notes.map((n) => n.title)).toEqual(['Vizyon', 'Manifesto'])
    expect(notes[0].wikilinks).toEqual(['Manifesto'])
    expect(notes[1].wikilinks).toEqual([])
  })
})
