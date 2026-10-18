# Agency demo dataset

`supabase/seeds/demo.sql` adds a fictional, connected agency portfolio to an existing owner's workspace. It requires the current schema through `202610190024_product_recovery.sql` and runs separately from migrations. It does not rename the workspace, modify its existing projects, create authentication accounts, or connect any client to Photon.

## Run in Supabase

1. Apply the repository migrations if the database is behind the current application.
2. Find your workspace with `select id, name from public.organizations order by name;` in the Supabase SQL Editor. Use the UUID because workspace names can differ only by capitalization.
3. Open `supabase/seeds/demo.sql`. Replace `v_workspace_id uuid := null;` with `v_workspace_id uuid := 'YOUR-WORKSPACE-UUID';`.
4. Paste and run the **entire file** in the SQL Editor using its database administrator role.
5. Refresh Bridgify while signed in as that workspace's existing owner.

The file uses one transaction: errors roll back the seed. IDs are deterministic per workspace and dataset version. A successful rerun does nothing, preserving task edits, decisions and proposal changes made during rehearsal. A partially removed dataset produces an error instead of silently resetting the rest. Do not put this file in the migration directory or run it automatically during deployment.

All dates are relative to the first run. Repeating the script does not refresh dates or reset the demo. Use another workspace for a fresh rehearsal dataset.

## Included scenarios

| Project                              | Original fee | Situation                                                                                                        |
| ------------------------------------ | -----------: | ---------------------------------------------------------------------------------------------------------------- |
| Northstar Analytics — Product Launch |      $18,500 | Automatically accepted copy/color changes, a Salesforce integration awaiting approval, and a rush-delivery draft |
| Evergreen Health — Patient Website   |      $12,800 | Owner review mode, two completed feedback rounds, exhausted allowance, and a declined portal discovery proposal  |
| Cascadia Goods — Storefront Refresh  |      $24,000 | Approved $4,200 gear-finder amendment, scope v2, two authorized deliverables, and a pending loyalty proposal     |
| Harbor Studio — Brand Launch         |       $8,500 | Completed engagement with delivery tasks, revision history and handover                                          |
| Atlas Logistics — Customer Portal    |      $32,000 | Paused API dependency, blocked work, timing review and requested changes to an invoice proposal                  |
| Juniper Coffee — Wholesale Launch    |       $6,800 | New project draft ready for agreement setup                                                                      |

The portfolio adds:

- **6 projects**, including active, review-only, paused, completed and draft states.
- **5 complete text agreements**, cited source spans, commercial terms and reviewed baselines; **6 scope versions**, including the approved amendment.
- **37 tasks:** 9 ready, 5 in progress, 4 blocked and 19 done, with assignees, dates, acceptance criteria and history.
- **26 requests** linked to source messages and completed analysis records; 11 accepted, 6 in owner review, 4 awaiting details and 5 closed.
- **8 owner decisions:** 6 still needing attention and 2 resolved by commercial responses.
- **6 proposals:** 2 awaiting the client, 1 draft, 1 approved, 1 declined and 1 with changes requested; 3 recorded fictional client responses.
- **8 individual revision uses**, **2 closed feedback rounds**, **55 stored messages** and project activity spanning about six weeks.

The owner remains the existing authenticated account. Alex Morgan, Jordan Lee and Sam Rivera are fictional task assignee labels, not additional login accounts. Company names, contacts, agreement excerpts, messages and client approvals are synthetic demo content.

## Suggested recording sequence

1. **Home:** show task totals, requests handled, activity, owner attention and pending proposals.
2. **Northstar → Requests:** open the accepted headline change. Show the exact client wording, interpretation, revision use and linked task. Then open the Salesforce request to explain scope review.
3. **Needs Attention:** compare a scope addition, a deadline change and exhausted allowance. Each includes agreement evidence and suggested next steps.
4. **Tasks:** show ready, in-progress and blocked work; inspect criteria, source and history. Existing tasks can be edited during rehearsal without the seed resetting them.
5. **Cascadia → Proposals / Scope history:** show the approved $4,200 addition, the $28,200 approved total, scope v2 and the two authorized gear-finder tasks. Contrast these with a proposal still awaiting the client.
6. **Evergreen:** show two used feedback rounds and owner-controlled review. **Atlas:** explain the blocked API dependency. **Harbor:** finish with completed delivery. **Juniper:** use the draft if demonstrating project setup.

## Conversation and live-action boundaries

The Request detail page reads its stored source and reply messages from Supabase. The **Conversation** page reads Photon directly, so it will show no connection for these demo projects. SQL cannot create real Photon conversations.

This seed creates **no chat bindings, outbound messages, extraction jobs or queued automation jobs**. It does not fabricate provider delivery receipts. Proposal detail therefore shows **Delivery: Not submitted**, even for historical demo proposals whose synthetic business status is approved or awaiting the client. The dataset demonstrates stored business scenarios, not proof of a real transmission. All response evidence is explicitly marked as demo data; it is not eligible for live approval commands.

To record live message submission, automatic intake, owner replies or a new proposal approval, create a separate project through normal setup with a verified test Photon client and send real test messages. Those operations require the application's connection and delivery checks. Existing live projects are untouched by this dataset.

## Validation

Run `npx vitest run tests/integration/demo-seed.test.ts`. It loads all current migrations into an isolated PostgreSQL engine, executes the actual SQL, verifies application JSON schemas and record relationships, checks agreement citations and commercial/revision accounting, checks owner visibility, and confirms reruns preserve existing projects and demo edits. No live credentials are needed for this test.
