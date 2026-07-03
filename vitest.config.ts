import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next', 'reborn kasa'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Vitest çalıştırdığı Node ortamında 'react-server' export koşulu yok
      // (Next.js'in client-bundle'a karşı hata fırlatan index.js'i devreye
      // girer); testler sunucu-only modülleri (local-embedding, retrieval)
      // doğrudan Node'da çalıştırdığı için no-op empty.js'e sabitlenir.
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
    },
  },
})
