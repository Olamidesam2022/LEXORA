 LEXORA

LEXORA is a legal practice management workspace for Zyph Legal LP. It supports corporate and commercial work, mergers and acquisitions, technology and intellectual property, contracts, regulatory compliance, corporate secretarial services, alternative dispute resolution, and litigation.

## What's in the app

- Client records and matter management
- Document storage and approval workflows
- Advisory requests, tasks, and deadlines
- Calendar, billing, payments, and audit activity
- Role-based access for Legal Officers, Operations Managers, and Managing Partners

## Run locally

Requirements: Node.js and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add your Supabase project values. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side; never add a `VITE_` prefix to it or commit it.

3. Start the frontend and API in separate terminals:

   ```bash
   npm run dev
   ```

   ```bash
   npm run dev:api
   ```

## Set up Supabase

Use a new, empty Supabase project. These migrations create the LEXORA schema; they are not an upgrade path for an existing LOMS database. Run each file in Supabase SQL Editor, in this order:

1. `supabase/migrations/20260920_lexora_core_schema.sql`
2. `supabase/migrations/20260922_document_uploader_names.sql`
3. `supabase/migrations/20260924_lexora_foundation.sql`
4. `supabase/migrations/20260926_lexora_workflow_security.sql`

The first person to sign up receives a pending Legal Officer profile. To activate the initial Managing Partner, follow the steps in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

The migrations create a private `lexora-documents` Storage bucket. For backup configuration and restore instructions, see [BACKUP_SETUP.md](BACKUP_SETUP.md).

## Build

```bash
npm run build
```# LEXORA
