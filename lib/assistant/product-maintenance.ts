import "server-only";
import type { Database } from "../db/postgres";
import { adminDb } from "../db/admin";
import { cleanupDeletedProject } from "../db/project-deletion";
import { analyzeAgreementNow } from "../domain/process-agreement";
export async function recoverProductMaintenance(database: Database) {
  await database.query("select expire_pending_proposals()");
  await cleanupDeletedProject(adminDb());
  const candidate = await database.query<{
    project_id: string;
    document_id: string;
  }>(`
 select d.project_id,d.id as document_id from jobs j join documents d on d.id=j.document_id join projects p on p.id=d.project_id
 where p.status='draft' and p.activation_cutoff is null and p.current_agreement_document_id=d.id
 and j.execution_mode='interactive' and (j.status='pending' and j.available_at<=now() or j.status='processing' and j.lease_until<now())
 order by j.available_at,j.id limit 1`);
  const job = candidate.rows[0];
  if (job) {
    await analyzeAgreementNow(adminDb(), job.project_id, job.document_id);
    return true;
  }
  return false;
}
