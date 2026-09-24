# LEXORA off-site backups

`.github/workflows/lexora-backup.yml` runs daily at 02:17 UTC and supports a manual run. It writes a PostgreSQL custom-format dump and copies the `lexora-documents` bucket to an independent destination through rclone. The destination can be any provider supported by rclone; keep its remote configuration in the repository's Actions secret, not in source control.

Before enabling the workflow:

1. Enable Supabase Storage's S3 protocol and create a dedicated, least-privilege access key. Supabase's S3 endpoint does not provide object versioning, so LEXORA writes each document revision to a separate key.
2. Configure an rclone remote for the independent backup provider and store that remote in `LEXORA_RCLONE_CONFIG`. The workflow creates the `supabase` S3 remote from the dedicated credentials below.
3. Add `LEXORA_DATABASE_HOST`, `LEXORA_DATABASE_PORT`, `LEXORA_DATABASE_USER`, `LEXORA_DATABASE_PASSWORD`, and `LEXORA_DATABASE_NAME` from the Supabase database connection details.
4. Add `LEXORA_STORAGE_S3_ENDPOINT`, `LEXORA_STORAGE_S3_REGION`, `LEXORA_STORAGE_S3_ACCESS_KEY`, `LEXORA_STORAGE_S3_SECRET_KEY`, and `LEXORA_BACKUP_DESTINATION` (for example, `b2:zyph-lexora-backups/production`).
5. Run the workflow manually and verify both artifacts at the destination. Set a retention/lifecycle policy with the destination provider, and schedule a restore drill.

The workflow is not active until those repository secrets and both rclone remotes are configured. GitHub Actions scheduling is the scheduler; no credentials or secondary-provider account are present in the development workspace.
