import { afterEach, expect, it, vi } from "vitest";

const build = vi.hoisted(() => ({ options: undefined as Record<string, unknown> | undefined }));
vi.mock("@sentry/nextjs/config", () => ({ withSentryConfig: (config: unknown, options: Record<string, unknown>) => { build.options = options; return config; } }));
afterEach(() => vi.unstubAllEnvs());

it("preserves private response headers, restricts CSP to the DSN origin and keeps the upload token out of public config", async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.us.sentry.io/456");
  vi.stubEnv("SENTRY_AUTH_TOKEN", "BUILD_TOKEN_SENTINEL");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abcdef1234");
  const { default: config } = await import("../next.config");
  expect(config.env).toMatchObject({ NEXT_PUBLIC_SENTRY_ENVIRONMENT: "preview", NEXT_PUBLIC_SENTRY_RELEASE: "abcdef1234" });
  expect(JSON.stringify(config.env)).not.toContain("BUILD_TOKEN_SENTINEL");
  const rules = await config.headers?.();
  const csp = rules?.find(rule => rule.source === "/:path*")?.headers.find(header => header.key === "Content-Security-Policy")?.value;
  expect(csp).toContain("https://o123.ingest.us.sentry.io");
  expect(csp).not.toContain("https://*.sentry.io");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(build.options).toMatchObject({ org: "vivintro", project: "nakshatra", sourcemaps: { disable: false, deleteSourcemapsAfterUpload: true }, release: { name: "abcdef1234" } });
});

it("does not generate public source maps or widen CSP without configuration", async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://attacker.example");
  vi.stubEnv("SENTRY_AUTH_TOKEN", "");
  const { default: config } = await import("../next.config");
  const rules = await config.headers?.();
  const csp = rules?.[0].headers.find(header => header.key === "Content-Security-Policy")?.value;
  expect(csp).not.toContain("attacker.example");
  expect(build.options).toMatchObject({ sourcemaps: { disable: true } });
});
