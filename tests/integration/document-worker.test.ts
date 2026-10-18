import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { it, expect } from "vitest";

it("boots the actual worker in this package's module format, polls, and shuts down", async () => {
  let claimed!: () => void;
  const claim = new Promise<void>((resolve) => {
    claimed = resolve;
  });
  let cleanupPolled = false;
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/rest/v1/project_deletion_cleanup?")) {
      cleanupPolled = true;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("[]");
      return;
    }
    expect(request.url).toBe("/rest/v1/rpc/claim_document_job");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end("null"); // Test-only empty queue: no source reads or Gemini calls.
    claimed();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server unavailable");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "workers/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`,
        SUPABASE_SERVICE_ROLE_KEY: "test-only-key",
        WORKER_ENABLED: "true",
        GEMINI_API_KEY: "test-only-key",
        GEMINI_MODEL: "test-only-model",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let errors = "";
  child.stderr.on("data", (chunk) => {
    errors += chunk.toString();
  });
  const exited = once(child, "exit");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      claim,
      exited.then(() => {
        throw new Error(`Worker exited before polling: ${errors}`);
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Worker never polled: ${errors}`)),
          10000,
        );
      }),
    ]);
    child.kill("SIGTERM");
    const [code, signal] = await exited;
    expect(code).toBe(0);
    expect(cleanupPolled).toBe(true);
    expect(signal).toBeNull();
    expect(errors).not.toContain("Top-level await");
  } finally {
    if (timer) clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
