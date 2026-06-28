import { AGENTS } from '@/lib/agents/registry'

export async function GET() {
  const list = Object.values(AGENTS).map(({ name, displayName, moduleTarget }) => ({
    name,
    displayName,
    moduleTarget,
  }))
  return Response.json(list)
}
