# Supabase seed data

Seed files for local development. Applied after migrations via the Supabase CLI:

```bash
supabase db reset   # runs migrations + seed
```

Seed data mirrors `packages/mock-data` so the app looks identical whether it is
running against mocks or a local database. Never seed production.
