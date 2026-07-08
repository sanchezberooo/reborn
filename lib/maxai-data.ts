// MAXAI — mock veri (Ofis/Panel/Brain). Backend/API bağlantısı yok; 3 sayfa
// aynı 3 ajanı (Sanchez, Knowledge Agent, Marketing Agent) farklı görünüm
// ihtiyaçlarına göre ayrı şekillerde temsil eder.

export type AgentDomain = 'Orchestrator' | 'Knowledge' | 'Marketing'

// ── Ofis ────────────────────────────────────────────────────────────────────
// 4 oda (bit-office'ten alınan "oda + koridor" konsepti — kod/asset değil,
// yalnızca fikir): komuta odası, brain odası, ortak alan (lounge), çalışma
// alanı. Avatarlar bu odalar arasında PixiJS sahnesinde tween ile hareket eder
// (bkz. MAXAIOfficeScene) — geçiş görsel bir ara-durum olduğu için ayrı bir
// 'corridor' state alanına ihtiyaç yok, yalnızca roomId değişir.

export type AgentName = 'Sanchez' | 'Knowledge Agent' | 'Marketing Agent'
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'talking_to_brain'
export type AgentRoomId = 'room_sanchez' | 'room_brain' | 'room_lounge' | 'room_workspace'

export interface AgentState {
  name: AgentName
  domain: AgentDomain
  status: AgentStatus
  roomId: AgentRoomId
  brainLinkCount: number
}

export const MOCK_AGENTS: AgentState[] = [
  {
    name: 'Sanchez',
    domain: 'Orchestrator',
    status: 'working',
    roomId: 'room_sanchez',
    brainLinkCount: 15,
  },
  {
    // Brain'e birkaç saniye sonra taşınıyor (bkz. MAXAIOfficeScene demo
    // timer'ı) — hareketin gözlemlenebilir olması için başlangıç odası
    // bilerek 'room_brain' değil.
    name: 'Knowledge Agent',
    domain: 'Knowledge',
    status: 'working',
    roomId: 'room_workspace',
    brainLinkCount: 27,
  },
  {
    name: 'Marketing Agent',
    domain: 'Marketing',
    status: 'idle',
    roomId: 'room_workspace',
    brainLinkCount: 8,
  },
]

// ── Panel ───────────────────────────────────────────────────────────────────

export type PanelStatus = 'working' | 'learning' | 'idle'

export interface AgentSummary {
  id: string
  name: string
  domain: AgentDomain
  status: PanelStatus
  brainSkillsCount: number
  brainPatternsCount: number
  lastInteractions: string[]
}

export const PANEL_AGENTS: AgentSummary[] = [
  {
    id: 'sanchez',
    name: 'Sanchez',
    domain: 'Orchestrator',
    status: 'working',
    brainSkillsCount: 15,
    brainPatternsCount: 4,
    lastInteractions: ['Günlük check-in sohbetini yönetti', 'Hedef özetini sundu'],
  },
  {
    id: 'knowledge-agent',
    name: 'Knowledge Agent',
    domain: 'Knowledge',
    status: 'learning',
    brainSkillsCount: 27,
    brainPatternsCount: 9,
    lastInteractions: ['Bağlantılı hafıza indeksini gözden geçiriyor'],
  },
  {
    id: 'marketing-agent',
    name: 'Marketing Agent',
    domain: 'Marketing',
    status: 'idle',
    brainSkillsCount: 8,
    brainPatternsCount: 3,
    lastInteractions: [],
  },
]

export const DESK_COUNT = 8
export const GLOBAL_BRAIN_SKILLS = 27

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
