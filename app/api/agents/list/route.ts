import { AGENTS } from '@/lib/agents/registry'

// 'test-agent' bilinçli olarak dışarıda bırakılıyor — smoke-test amaçlı, üretim
// listesinde görünmemeli. Kayıttan silinmedi: hâlâ /api/agents/run ile çalıştırılabilir.
export async function GET() {
  const list = Object.values(AGENTS)
    .filter(({ name }) => name !== 'test-agent')
    .map(({ name, displayName, moduleTarget }) => ({
      name,
      displayName,
      moduleTarget,
    }))
  return Response.json(list)
}
