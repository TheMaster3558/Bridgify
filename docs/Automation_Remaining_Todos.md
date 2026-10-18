# Automation implementation status

The previously listed automation items are implemented in the owner-only workflow:

| Item                                        | Implementation                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Immediate inbound processing                | Signed Photon webhook or optional local live SDK listener → shared durable event/job → immediate processing and outbox delivery |
| Started/blocked/completed/cancelled updates | Optional saved `progress_updates` preference; transactional client-safe status messages                                         |
| Queued reply editing/cancellation           | Version-checked owner commands; submitted messages cannot be edited                                                             |
| Unknown delivery reconciliation/retry       | Actual provider receipt lookup and matching; explicit non-delivery confirmation before a new audited attempt                    |
| Failed-analysis retry                       | Eligible unresolved failures only, prior attempt archived, bounded owner retries, no replay of committed work                   |
| Client corrections/cancellations            | Owner selects an existing open task; version check and audit; no duplicate task or silent refund                                |
| Revision rounds/refunds                     | One open round, accepted request membership, close/consume, separate immutable individual/round refunds                         |
| Older status lookup                         | Project-wide relevance search supplies bounded task/request matches, including older work and request/task codes                |
| Activated policy changes                    | Expected-version owner amendment, appended policy version, preserved usage and unchanged commercial scope                       |
| Hosted operation and monitoring             | Vercel bounded event-triggered runs, authenticated Supabase recovery schedule, real health/backlog/errors                       |

Production activation remains an operator step. Follow
[Automation Deployment](Automation_Deployment.md) for **bridgify-two.vercel.app**.
The operator must deploy the code, set private Vercel variables, register Photon's
webhook and enable the recovery callback. No hosted availability is claimed until
those steps and a real consenting-client delivery check succeed.

The website is for owners only. Clients use iMessage; historical website
invitations and shared proposal access are retired. Actual website editing is outside this product. Commercial proposals and owner-recorded client evidence are implemented separately from routine request acceptance; see [Product Completion](Product_Completion.md).
