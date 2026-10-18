# Remaining automation work (not implemented in this change)

- **Proactive progress messages:** optionally queue client updates when the owner
  starts, blocks, completes or cancels a task. Current status replies are on demand;
  acceptance and owner approval already queue confirmations.
- **Reply outbox controls and reconciliation:** let the owner edit/cancel queued
  messages and reconcile uncertain sends against actual provider receipts before
  explicitly retrying. Delivery failures currently go to Needs Attention.
- **Reprocess action:** offer an audited retry of a failed interpretation with a
  fresh snapshot and deduplication against the existing review/task. The current
  recovery path is owner approval of the preserved source, not automatic replay.
- **Corrections and cancellation:** safely apply approved client corrections or
  cancellations to an existing task, rather than treating every approved change
  as a new task; define revision refund rules explicitly.
- **Revision rounds:** add an owner-managed round ledger and clear reservation,
  consumption and refund rules. Automatic acceptance supports individual requests;
  rounds stay under manual accounting.
- **Older request lookup:** search beyond the latest 20 tasks and request summaries
  when answering a client status question, without sending full history to Gemini.
- **Policy amendments:** allow the owner to change automation permissions after
  activation with version checks and an explicit scope/policy amendment. Activated
  setup currently remains immutable; this fix preserves manual approval settings.
- **Operational hosting:** deploy the worker under a persistent process supervisor
  with health checks and owner-visible availability/quota alerts. Running a local
  command still requires keeping that process alive.

The assistant coordinates work; actually editing a website remains the owner's
responsibility and is not a missing promise of this facilitator.
