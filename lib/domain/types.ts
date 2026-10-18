import type {
  AgreementExtraction,
  AgreementReview,
} from "@/lib/schemas/agreement";
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
  current_agreement_document_id?: string | null;
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
  extraction: AgreementExtraction | null;
  review_draft: AgreementReview | null;
  review_version: number;
};
export type Bundle = {
  project: Project;
  documents: Document[];
  spans: (Span & { document_id: string })[];
  scope: {
    version: number;
    document_id: string;
    terms: Term[];
    agreement?: AgreementReview | null;
    confirmed_at: string;
  }[];
  members: { user_id: string; requester: boolean; approver: boolean }[];
  binding: {
    introduction_text?: string | null;
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
