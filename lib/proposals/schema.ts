import { z } from "zod";
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export const proposalTermsSchema=z.object({title:z.string().trim().min(1).max(200),explanation:z.string().trim().min(1).max(4000),
 lines:z.array(z.object({key:z.string().min(1).max(100),title:z.string().trim().min(1).max(500),acceptance_criteria:z.string().trim().max(2000)}).strict()).min(1).max(25).refine(v=>new Set(v.map(l=>l.key)).size===v.length),
 superseded_terms:z.array(z.string().min(1).max(4000)).max(100).default([]),
 exclusions:z.array(z.string().trim().min(1).max(1000)).max(25),amount_cents:z.number().int().min(0).max(100000000),
 change_due_date:z.boolean(),new_due_date:date.nullable(),allowance_delta:z.number().int().min(-10000).max(10000),expires_at:z.iso.datetime({offset:true}).nullable(),source_request_id:z.uuid().nullable().optional(),
}).strict();
export type ProposalTerms=z.infer<typeof proposalTermsSchema>;
