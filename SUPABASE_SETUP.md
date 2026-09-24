# Fresh Supabase setup for LEXORA

These SQL migrations create a new LEXORA schema only. They do not create users, demo records, or LOMS case tables. Use them only on a new, empty Supabase project. They are not an in-place upgrade path for an existing LOMS database.

1. Create a new Supabase project.
2. In Supabase SQL Editor, run each file below separately, in this order:
   - `supabase/migrations/20260920_lexora_core_schema.sql`
   - `supabase/migrations/20260922_document_uploader_names.sql`
   - `supabase/migrations/20260924_lexora_foundation.sql`
   - `supabase/migrations/20260926_lexora_workflow_security.sql`
3. Copy `.env.example` to `.env.local` and set the frontend and server credentials. Keep the service role key server-only.
4. Start the app with `npm run dev` and `npm run dev:api`.
5. When ready to create the first user, sign up through LEXORA. The profile starts as a pending Legal Officer. Promote only that first account to Managing Partner in SQL Editor:

```sql
update public.profiles
set role = 'managing_partner', status = 'approved'
where email = 'your-email@example.com';
```

The migrations create the private `lexora-documents` Storage bucket. Configure GitHub backup secrets and complete a restore rehearsal as described in `BACKUP_SETUP.md` before relying on backups.
