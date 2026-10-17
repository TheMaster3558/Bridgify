import { z } from "zod";
const email = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
const next = z.string().max(1000).optional();
export const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Use at most 72 bytes for your password.",
  );
export const passwordAuthSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("signin"),
    email,
    password: z.string().min(1).max(1024),
    next,
  }),
  z
    .object({
      action: z.literal("signup"),
      email,
      password: newPassword,
      password_confirmation: z.string(),
      next,
    })
    .refine((value) => value.password === value.password_confirmation, {
      message: "Passwords do not match.",
      path: ["password_confirmation"],
    }),
  z.object({ action: z.literal("recover"), email, next }),
  z
    .object({
      action: z.literal("update_password"),
      password: newPassword,
      password_confirmation: z.string(),
      next,
    })
    .refine((value) => value.password === value.password_confirmation, {
      message: "Passwords do not match.",
      path: ["password_confirmation"],
    }),
]);
