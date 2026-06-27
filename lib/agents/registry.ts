import type { AgentDefinition } from './types'

export const AGENTS: Record<string, AgentDefinition> = {
  'test-agent': {
    name: 'test-agent',
    displayName: 'Test Agent',
    persona:
      'You are a test agent. Given the input, reply with ONLY a JSON object ' +
      '{"echo": <one-line summary of input>, "ok": true}, no markdown, no extra text.',
    toolNames: [],
    moduleTarget: null,
    outputContract: '{ "echo": string, "ok": boolean }',
  },
}

export function getAgent(name: string): AgentDefinition | null {
  return AGENTS[name] ?? null
}
