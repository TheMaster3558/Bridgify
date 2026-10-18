# Deleting a project

Apply `supabase/migrations/202610170010_delete_projects.sql` after the existing onboarding migrations, including work management (007). The existing server Supabase service-role key is required to remove private agreement files.

Select **Delete** on the Projects list or project overview. Type the exact project name, then select **Delete project permanently**. Cancel never submits a deletion. A failed database operation leaves the project intact and displays a retryable error.

The DELETE endpoint uses the existing authenticated-session and same-origin API guards. Its user-session `delete_project` RPC locks the project, verifies workspace ownership and confirmation, and deletes the project and dependent setup, agreement, request-intake, task, decision, invitation, proposal, and command-receipt records in one transaction. Private file paths are copied into an owner-scoped cleanup receipt before deleting agreement rows. In-progress introduction/manual sends block deletion until their status is resolved. Repeated deletion requests by the same owner are safe.

After the transaction succeeds, the server removes saved agreement files with the Supabase Storage API. If cleanup fails, the UI explicitly reports pending cleanup. The durable receipt stays pending and can be retried by the existing document worker or independently with:

```sh
npm run worker:cleanup
```

The standalone cleanup worker requires Node 24 and `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It does not require Gemini, Photon, or the document worker. It retries pending private-file cleanup every five seconds. Completed receipts retain only the deleted project ID, owner ID, status and timestamps; file paths are cleared.

Deletion does not remove messages from Photon or participants' iMessage histories, delete the Photon user, or stop the standalone project-independent Gemini demo listener. No Photon messages are sent during deletion.

Verification uses test-only database/browser/storage fixtures. No live project was deleted. Tests cover ownership, confirmation, populated and draft projects, related-record cleanup, duplicate deletion, private cleanup receipt isolation, file cleanup failure/retry, and browser cancellation/errors.
