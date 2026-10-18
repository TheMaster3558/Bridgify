import { z } from "zod";

export const photonUserInputSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter a first name.").max(100),
    lastName: z.string().trim().max(100).default(""),
    email: z
      .string()
      .trim()
      .max(254)
      .pipe(z.email("Enter a valid email address.")),
    phoneNumber: z
      .string()
      .trim()
      .max(50)
      .transform((value) => value.replace(/[\s().-]/g, ""))
      .pipe(
        z
          .string()
          .regex(
            /^\+[1-9]\d{6,14}$/,
            "Include the country code, for example +14155551234.",
          ),
      ),
  })
  .strict();
export const addPhotonUserRequestSchema = photonUserInputSchema.extend({
  projectId: z.uuid(),
});
export type PhotonUserInput = z.infer<typeof photonUserInputSchema>;
