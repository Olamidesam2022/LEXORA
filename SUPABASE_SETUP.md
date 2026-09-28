# Fresh Supabase setup for LEXORA

Use this process to create a new, empty Supabase project manually in the Supabase Dashboard. It does not modify or migrate data from another project, create demo records, or import LOMS tables. Do not use this setup on a project that already contains application data.

## 1. Create the project

In the Supabase Dashboard, create a new project and save its database password securely. Wait until the project is ready before continuing.

## 2. Create the schema

Open **SQL Editor** in the new project, create a query, and run the entire file `supabase/migrations/20260928000000_lexora_fresh_baseline.sql` once. This consolidated baseline includes the schema, workflow, storage bucket, and RLS policies. Do not run the older source migrations separately, and do not rerun the baseline after it succeeds.

For an existing project, apply `supabase/migrations/20260928100000_document_upload_hardening.sql`, `supabase/migrations/20260928110000_unlinked_document_uploads.sql`, and `supabase/migrations/20260928120000_storage_upload_rls_fix.sql` in timestamp order instead of rerunning the baseline. They update the document bucket, enable cleanup of failed drafts, allow manager-owned unlinked uploads, and apply the Storage authorization check without a conflicting documents RLS subquery.

## 3. Configure Auth

In **Authentication → URL Configuration**, set the local development URL to `http://localhost:8080` and add `http://localhost:8080/**` to the redirect URLs. Configure a custom SMTP provider in **Authentication → SMTP Settings** before testing signup at scale; the built-in email provider has strict sending limits.

## 4. Configure the app

In **Project Settings → API**, copy the Project URL and the publishable/anon key. Put them in `.env.local` using the names in `.env.example`:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are used by the browser app.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are used by the local API server.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never add a `VITE_` prefix or expose this key in browser code.

Keep the existing `.env.local` private and do not commit it. If it contains credentials for the old project, replace them with credentials from the new project.

## 5. Start the app

Run `npm run dev` and `npm run dev:api` in separate terminals. Open `http://localhost:8080`.

## 6. Create the first Managing Partner

Sign up through LEXORA. New profiles are created as pending Legal Officers. After confirming the email, use the SQL Editor to promote only the first account:

```sql
update public.profiles
set role = 'managing_partner', status = 'approved'
where email = 'your-email@example.com';
```

The baseline creates the private `lexora-documents` Storage bucket. Configure GitHub backup secrets and complete a restore rehearsal as described in `BACKUP_SETUP.md` before relying on backups.
