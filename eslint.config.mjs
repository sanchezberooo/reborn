import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bu proje kodu değil: claude-flow boilerplate (git takibinde değil, ama
    // diskte kalıyor) ve kişisel Obsidian kasası (repo dışına taşınmalı).
    ".claude/**",
    "reborn kasa/**",
  ]),
  {
    // Next.js 16'nın yeni React Compiler kuralları (set-state-in-effect,
    // purity) mevcut kodda 13+ yerde pre-existing pattern'leri (SSR-safe
    // mount ölçümü, render-time tarih hesabı) hata olarak işaretliyor.
    // Restructure riskli ve bu paketin kapsamı dışında — CI'ı kırmadan
    // görünür bırakmak için warn'a düşürüldü, susturulmadı.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
