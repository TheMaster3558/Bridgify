# Deleting a project

Apply `supabase/migrations/202610170010_delete_projects.sql` after the existing onboarding migrations, including work management (007). If the automation schema is installed (migration `202610170010_project_automation.sql` and subsequent review updates), also apply **`supabase/migrations/202610170013_project_deletion_automation.sql`**. This forward migration fixes foreign-key failures for projects with messages, automation jobs, requests, revisions, decisions or replies. Apply only the new migration to an already migrated database; do not replay the original table-creation migrations. The existing server Supabase service-role key is required to remove private agreement files.

Open the three-dot menu at the end of a row on the Projects list and select **Delete**, or select **Delete** on the project overview. Type the exact project name, then select **Delete project permanently**. Cancel never submits a deletion. A failed database operation leaves the project intact and displays a retryable error.

The DELETE endpoint uses the existing authenticated-session and same-origin API guards. Its user-session `delete_project` RPC locks the project, verifies workspace ownership and confirmation, and deletes the project and dependent setup, agreement, request-intake, task, decision, invitation, proposal, and command-receipt records in one transaction. Private file paths are copied into an owner-scoped cleanup receipt before deleting agreement rows. In-progress introduction, manual and automation sends block deletion until their status is resolved. The fix uses the same project lock as automation delivery so queued replies cannot start while that project is being deleted. Repeated deletion requests by the same owner are safe.

After the transaction succeeds, the server removes saved agreement files with the Supabase Storage API. If cleanup fails, the UI explicitly reports pending cleanup. The durable receipt stays pending and can be retried by the existing document worker or independently with:

```sh
npm run worker:cleanup
```

The standalone cleanup worker requires Node 24 and `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It does not require Gemini, Photon, or the document worker. It retries pending private-file cleanup every five seconds. Completed receipts retain only the deleted project ID, owner ID, status and timestamps; file paths are cleared.

Deletion does not remove messages from Photon or participants' iMessage histories, delete the Photon user, or stop the standalone project-independent Gemini demo listener. No Photon messages are sent during deletion.

Verification uses test-only database/browser/storage fixtures. No live project was deleted. Tests cover ownership, confirmation, populated and draft projects, related-record cleanup, duplicate deletion, private cleanup receipt isolation, file cleanup failure/retry, and browser cancellation/errors.


## Automation-related deletion failures

The original deletion function predated automation storage. Those tables referenced projects with restrictive foreign keys, so a fully created project could fail deletion after it received real messages. The separate onboarding test schema did not include automation tables and missed this case.

Migration 013 makes all six automation tables cascade with their owning project, matching existing task and decision ownership. Deleting the project in one statement also resolves the circular request/task/decision references and the later decision-to-source-job reference. It keeps foreign-key integrity, owner authorization, exact-name confirmation, private file cleanup, retry receipts and atomic rollback. It also removes automation review command responses while the corresponding task/decision IDs are available.

A full-schema regression test first reproduces SQLSTATE 23503 with the original function, applies only the forward migration, and then deletes a populated active project while preserving another owner's project. Additional tests cover in-flight replies and rollback when an unexpected dependency is present. The API now gives an actionable migration message for dependency failures without exposing raw database details. No live project was deleted during verification.
