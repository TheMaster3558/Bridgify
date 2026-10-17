import type { z } from "zod";
import type {
  basicsSchema,
  peopleSchema,
  policySchema,
  Term,
  Span,
} from "@/lib/schemas/onboarding";
export type Project = z.infer<typeof basicsSchema> & {
  id: string;
  status: string;
  version: number;
  setup_step: number;
  scope_version: number;
  policy_version: number;
  people: z.infer<typeof peopleSchema> | null;
  policy: z.infer<typeof policySchema> | null;
  activation_cutoff: string | null;
  disclosure_at: string | null;
  updated_at: string;
};
export type Document = {
  id: string;
  status: string;
  kind: string;
  error: string | null;
  original_text: string | null;
  extraction: { terms: Term[]; warnings: string[] } | null;
};
export type Bundle = {
  project: Project;
  documents: Document[];
  spans: (Span & { document_id: string })[];
  scope: {
    version: number;
    document_id: string;
    terms: Term[];
    confirmed_at: string;
  }[];
  members: { user_id: string; requester: boolean; approver: boolean }[];
  binding: {
    verified_at: string | null;
    test_state: string;
    hold_reason: string | null;
    webhook_verified_at: string | null;
    disclosed_message_guid: string | null;
  } | null;
  invitations: {
    email: string;
    accepted_at: string | null;
    expires_at: string;
  }[];
};
