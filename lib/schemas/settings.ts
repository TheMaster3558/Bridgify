import { z } from "zod";

export const accountSettingsSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA timezone, such as America/Los_Angeles"),
  organization: z.string().trim().min(1, "Enter an organization name").max(120),
});

export const settingsActionSchema = z.object({}).strict();

export type AccountSettings = z.infer<typeof accountSettingsSchema>;
