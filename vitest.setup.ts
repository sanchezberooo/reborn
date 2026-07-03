// Test ortamına .env.local'ı Next ile aynı mekanizmayla yükler.
// Test dosyası modülleri import edilmeden ÖNCE koşar — lib/supabase.ts gibi
// modül yüklenirken env okuyan dosyalar için gerekli. Env eksikse test
// dosyaları kendileri skip kararı verir (bkz. lib/ai/retrieval.test.ts).
//
// NODE_ENV oyunu: @next/env, NODE_ENV=test iken .env.local'ı BİLEREK atlar
// (Next'in belgelenmiş davranışı); vitest ise NODE_ENV'i 'test' yapar. Canlı
// Supabase'e koşan entegrasyon testleri tam da .env.local'daki anahtarları
// istediğinden, yalnızca yükleme anında NODE_ENV geçici olarak değiştirilir.
import { loadEnvConfig } from '@next/env'

// Object.assign: Next'in tip tanımı NODE_ENV'i readonly işaretler; runtime'da
// atanabilir, tip hatasız atamanın yolu bu.
const originalNodeEnv = process.env.NODE_ENV
Object.assign(process.env, { NODE_ENV: 'development' })
try {
  loadEnvConfig(process.cwd())
} finally {
  Object.assign(process.env, { NODE_ENV: originalNodeEnv })
}
