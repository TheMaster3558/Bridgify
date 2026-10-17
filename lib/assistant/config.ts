import "server-only";
import { z } from "zod";

const secret = z.string().trim().min(1);
const photonSchema = z.object({
  PHOTON_HTTP_ADDRESS: z.url(), PHOTON_TOKEN: secret,
  PHOTON_INSTANCE_ID: secret.optional(),
});
const geminiSchema = z.object({ GEMINI_API_KEY: secret, GEMINI_MODEL: secret });

type Environment = Record<string, string | undefined>;
function read<T>(schema: z.ZodType<T>, env: Environment): T {
  const result = schema.safeParse(env);
  // Never include environment values or provider error bodies in logs/errors.
  if (!result.success) throw new Error("assistant_provider_configuration_missing_or_invalid");
  return result.data;
}
export const readPhotonConfig = (env: Environment = process.env) => read(photonSchema, env);
export const readGeminiConfig = (env: Environment = process.env) => read(geminiSchema, env);
