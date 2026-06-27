export interface AgentDefinition {
  name: string
  displayName: string
  persona: string
  toolNames: string[]
  moduleTarget: string | null
  outputContract: string
}
