// MAXAI — kalan mock veri: yalnız Brain sekmesi (MAXAIBrainPanel). Panel ve
// Ofis artık GERÇEK veriye bağlı (components/maxai/MAXAIPanel.tsx ve
// components/maxai/office/OfficeLayout.tsx → /api/agents/*); PANEL_AGENTS ve
// MOCK_AGENTS mock'ları kaldırıldı. BRAIN_STATS'ın gerçek veriye bağlanması
// ayrı bir görev.

// ── Brain ───────────────────────────────────────────────────────────────────

export interface BrainStats {
  agentName: string
  skillsCount: number
  patternsCount: number
  workflowsCount: number
}

export const BRAIN_STATS: BrainStats[] = [
  { agentName: 'Sanchez', skillsCount: 15, patternsCount: 4, workflowsCount: 2 },
  { agentName: 'Knowledge Agent', skillsCount: 27, patternsCount: 9, workflowsCount: 5 },
  { agentName: 'Marketing Agent', skillsCount: 8, patternsCount: 3, workflowsCount: 1 },
]
