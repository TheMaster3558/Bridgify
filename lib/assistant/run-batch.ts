import "server-only";
import { recoverProductMaintenance } from "./product-maintenance";
import { getDatabase } from "../db/postgres";
import {
  createAutomationDelivery,
  createAutomationProcessor,
} from "./automation";
import { createConfiguredMessageInterpreter } from "../ai/interpret-messages";
import { readSpectrumCredentials, sendPhotonText } from "../photon/spectrum";
import { processingErrorCode } from "./processing-errors";

// Called by signed intake and owner actions. No history polling or detached timer.
export async function runAutomationBatch(
  projectId?: string,
  options: { enabled?: boolean } = {},
) {
  if (!(options.enabled ?? process.env.AUTOMATION_WORKER_ENABLED === "true"))
    throw new Error("automation_worker_disabled");
  const deadline = Date.now() + 54_000;
  const database = getDatabase();
  if(!projectId && await recoverProductMaintenance(database)) return {processed:0,sent:0};
  const { projectId: instanceId } = readSpectrumCredentials();
  const candidates = projectId
    ? [projectId]
    : (
        await database.query<{ id: string }>(
          `
    select p.id from projects p left join automation_runtime_health h on h.project_id=p.id
    where p.people->>'instance_id'=$1 and p.status in ('active','review_only') and (
      exists(select 1 from automation_jobs j where j.project_id=p.id and
        (j.state='queued' and j.available_at<=now() or j.state='running' and j.lease_until<now())) or
      exists(select 1 from automation_outbox o where o.project_id=p.id and
        (o.state='queued' or o.state='sending' and o.lease_until<now())))
    order by h.started_at asc nulls first,p.id limit 1`,
          [instanceId],
        )
      ).rows.map((r) => r.id);
  const processor = createAutomationProcessor(
    database,
    createConfiguredMessageInterpreter(),
  );
  const delivery = createAutomationDelivery(
    database,
    async (address, text) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          sendPhotonText(address, text),
          new Promise<{ state: "unknown" }>((resolve) => {
            timer = setTimeout(() => resolve({ state: "unknown" }), 12_000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    instanceId,
  );
  let processed = 0,
    sent = 0;
  for (const id of candidates) {
    // Binding is checked again under transaction by processing/delivery.
    const allowed = await database.query(
      "select id from projects where id=$1 and people->>'instance_id'=$2",
      [id, instanceId],
    );
    if (!allowed.rows.length) continue;
    await database.query(
      `insert into automation_runtime_health(project_id,started_at,finished_at,error_code)
      values($1,now(),null,null) on conflict(project_id) do update set started_at=now(),finished_at=null,error_code=null`,
      [id],
    );
    try {
      // One interpretation is bounded by the Gemini transport timeout. Replies
      // start only after durable domain writes, including on webhook replay.
      if (await processor.once(id)) processed++;
      for (let i = 0; i < 3 && Date.now() < deadline - 13_000; i++) {
        if (await delivery.once(id)) sent++;
        else break;
      }
      await database.query(
        "update automation_runtime_health set finished_at=now() where project_id=$1",
        [id],
      );
    } catch (error) {
      await database.query(
        "update automation_runtime_health set finished_at=now(),error_code=$2 where project_id=$1",
        [id, processingErrorCode(error)],
      );
      throw new Error("automation_batch_unavailable");
    }
  }
  return { processed, sent };
}
