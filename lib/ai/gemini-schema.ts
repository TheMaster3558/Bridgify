// Gemini supports a subset of JSON Schema. Keep decoder structure separate from
// application validation: UUIDs, patterns, dates and bounds are checked by Zod
// and source-evidence validation after generation, never trusted to the model.
export function geminiOutputSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    throw new Error("An object JSON schema is required");
  const input = schema as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of ["type", "enum", "required", "description", "title"])
    if (key in input) output[key] = input[key];
  if (input.properties && typeof input.properties === "object")
    output.properties = Object.fromEntries(
      Object.entries(input.properties).map(([key, value]) => [
        key,
        geminiOutputSchema(value),
      ]),
    );
  if (input.items) output.items = geminiOutputSchema(input.items);
  if (Array.isArray(input.anyOf))
    output.anyOf = input.anyOf.map(geminiOutputSchema);
  return output;
}
