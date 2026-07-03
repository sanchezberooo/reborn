# Migrations

`migrations/` esastır; `schema.sql` yalnızca tarihsel referans.

1. Yeni dosya oluştur: `supabase/migrations/000N_kisa-aciklama.sql` (sıradaki numara, snake_case açıklama).
2. Dosyaya yalnızca bu değişikliğin SQL'ini yaz (`CREATE`/`ALTER`/`DROP` vb.) — baseline'ı tekrarlama.
3. Canlıya uygula: Supabase MCP `apply_migration` (`name` = dosya adı, `query` = içerik).
4. `mcp__claude_ai_Supabase__list_migrations` ile canlı DB'nin migration listesini dosyalarla karşılaştırıp senkronu doğrula.
5. Asla `apply_migration` dışında (Dashboard SQL Editor, elle `execute_sql`) canlı şema değişikliği yapma — dosya ile DB birbirinden kopar.
