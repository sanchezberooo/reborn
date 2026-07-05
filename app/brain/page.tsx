// Brain — Reborn'un ikinci beyni (roadmap §6.1/4). Obsidian yalnızca
// Brain'e veri sağlayan kaynaklardan biridir; sekme adı bu yüzden
// "Obsidian" değil "Brain". Graf artık gerçek entities/links çekirdeğinden
// (migration 0001) geliyor — journal, goal, essay, Obsidian notu, vizyon
// belgesi, hepsi aynı grafta.

import Brain from '@/components/brain/Brain'
import { getBrainGraph, resolveSingleUserId } from '@/lib/db-server'
import { buildBrainView } from '@/lib/brain-layout'

export default async function BrainPage() {
  const userId = await resolveSingleUserId()
  const graph = await getBrainGraph(userId)
  const { notes, edges, noteById } = buildBrainView(graph)

  return <Brain notes={notes} edges={edges} noteById={noteById} />
}
