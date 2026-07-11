import { getLastRetrievalAt } from '@/lib/ai/retrieval-signal'

// MAXAİ Ofis Brain küresinin aktivite ucu: son hibrit retrieval zamanı.
// Ofis sahnesi bunu mevcut 5 sn'lik polling döngüsünde okur (WebSocket yok).
// force-dynamic şart: handler yalnız süreç içi bir değişken okur — Next bunu
// "statik" sanıp build'de prerender edebilir, sinyal hep null donardı.
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ lastRetrievalAt: getLastRetrievalAt() })
}
