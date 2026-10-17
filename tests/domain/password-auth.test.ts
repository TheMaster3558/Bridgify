import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({ db: async () => ({ auth: mocks }) }));
import { POST } from "@/app/api/auth/password/route";
import { GET } from "@/app/auth/confirm/route";
import { passwordAuthSchema } from "@/lib/schemas/auth";
const next = "/proposals/55555555-5555-4555-8555-555555555555?revision=7";
const signup = {
  action: "signup",
  email: "client@example.test",
  password: "a strong password",
  password_confirmation: "a strong password",
  next,
};
function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/auth/password", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
});
afterEach(() => vi.unstubAllEnvs());
describe("password authentication routes", () => {
  it("creates an immediate signup session and preserves the exact proposal", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: { access_token: "not-output" } },
      error: null,
    });
    const result = await POST(request(signup));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ next });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: signup.email,
      password: signup.password,
    });
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
  it("does not report login success when hosted Confirm email is still enabled", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const result = await POST(request(signup));
    expect(result.status).toBe(503);
    expect((await result.json()).error).toContain(
      "Email confirmation is still enabled",
    );
  });
  it("signs in with the provided password without confirmation", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "not-output" } },
      error: null,
    });
    const result = await POST(
      request({ action: "signin", email: signup.email, password: "old", next }),
    );
    expect(await result.json()).toEqual({ next });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: signup.email,
      password: "old",
    });
  });
  it("returns a neutral error for invalid credentials", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { status: 400, message: "sensitive provider internals" },
    });
    const result = await POST(
      request({ action: "signin", email: signup.email, password: "wrong" }),
    );
    expect(result.status).toBe(401);
    expect(await result.json()).toEqual({
      error: "Unable to sign in. Check your email and password.",
    });
  });
  it("rejects mismatched passwords before contacting Supabase", async () => {
    const result = await POST(
      request({ ...signup, password_confirmation: "different" }),
    );
    expect(result.status).toBe(400);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("rejects short and oversized multibyte passwords", () => {
    expect(
      passwordAuthSchema.safeParse({
        ...signup,
        password: "short",
        password_confirmation: "short",
      }).success,
    ).toBe(false);
    expect(
      passwordAuthSchema.safeParse({
        ...signup,
        password: "🔐".repeat(20),
        password_confirmation: "🔐".repeat(20),
      }).success,
    ).toBe(false);
  });
  it("rejects cross-origin requests without creating an account", async () => {
    expect((await POST(request(signup, "https://evil.example"))).status).toBe(
      403,
    );
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("rejects external destinations after successful sign-in", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: {} },
      error: null,
    });
    const result = await POST(
      request({
        action: "signin",
        email: signup.email,
        password: "password",
        next: "https://evil.example",
      }),
    );
    expect(await result.json()).toEqual({ next: "/app" });
  });
  it("requests recovery with the exact destination but no account-existence disclosure", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    const result = await POST(
      request({ action: "recover", email: signup.email, next }),
    );
    expect(result.status).toBe(200);
    expect((await result.json()).message).toContain("If an account exists");
    const options = mocks.resetPasswordForEmail.mock.calls[0][1];
    const url = new URL(options.redirectTo);
    expect(url.searchParams.get("next")).toBe(next);
    expect(url.searchParams.get("flow")).toBe("recovery");
  });
  it("requires a session before setting a password", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await POST(
      request({ ...signup, action: "update_password" }),
    );
    expect(result.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("updates passwords for authenticated accounts without requiring email verification", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "account", email_confirmed_at: null } },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ error: null });
    const result = await POST(
      request({ ...signup, action: "update_password" }),
    );
    expect(result.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: signup.password,
    });
  });
  it("verifies recovery tokens as recovery and opens the password form", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });
    const url = new URL("http://localhost:3000/auth/confirm");
    url.searchParams.set("flow", "recovery");
    url.searchParams.set("type", "recovery");
    url.searchParams.set("token_hash", "reset-token");
    url.searchParams.set("next", next);
    const response = await GET(new Request(url));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/reset-password");
    expect(location.searchParams.get("next")).toBe(next);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "reset-token",
      type: "recovery",
    });
  });
  it("keeps expired recovery tokens out of the password form", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/confirm?flow=recovery&type=recovery&token_hash=expired",
      ),
    );
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    expect(response.headers.get("location")).toContain("error=expired");
  });
  it("rejects the old magic-link confirmation path", async () => {
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/confirm?token_hash=old&type=email",
      ),
    );
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
});
