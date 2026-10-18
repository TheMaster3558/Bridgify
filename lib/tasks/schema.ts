import { z } from "zod";
export const taskDetailsSchema = z.object({
 title:z.string().trim().min(1).max(500), instructions:z.string().trim().max(8000),
 acceptance_criteria:z.string().trim().max(4000),priority:z.enum(["high","normal","low"]),
 internal_due_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v).nullable(),
 internal_note:z.string().trim().max(4000)
}).strict();
