import { describe, expect, it } from "vitest";
import nextConfig, { resolveLocalSupabaseOrigin, resolveOutputMode } from "../next.config";

describe("Next.js deployment output", () => {
  it("lets Vercel package the application while retaining standalone Docker output", () => {
    expect(resolveOutputMode("1")).toBeUndefined();
    expect(resolveOutputMode(undefined)).toBe("standalone");
    expect(resolveOutputMode("0")).toBe("standalone");
  });
});

describe("Next.js security headers", () => {
  it("allows only the configured loopback mock outside Production", () => {
    expect(resolveLocalSupabaseOrigin("development", "http://127.0.0.1:54329")).toBe("http://127.0.0.1:54329");
    expect(resolveLocalSupabaseOrigin("test", "http://localhost:54329/path")).toBe("http://localhost:54329");
    expect(resolveLocalSupabaseOrigin("production", "http://127.0.0.1:54329")).toBeNull();
    expect(resolveLocalSupabaseOrigin("development", "https://untrusted.example")).toBeNull();
    expect(resolveLocalSupabaseOrigin("development", "http://127.0.0.1.evil.example")).toBeNull();
  });

  it("applies browser defenses globally and no-store policy to sensitive routes", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = await nextConfig.headers?.();
    expect(rules).toBeDefined();
    const global = rules?.find((rule) => rule.source === "/:path*")?.headers ?? [];
    const header = (name: string) => global.find((entry) => entry.key === name)?.value;

    expect(header("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(header("Content-Security-Policy")).toContain("object-src 'none'");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toContain("camera=()");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("X-Frame-Options")).toBe("DENY");

    for (const source of [
      "/api/:path*",
      "/dashboard/:path*",
      "/preview/:path*",
      "/approved-preview/:path*",
      "/p/:path*",
      "/verify/:path*",
      "/verification/:path*",
    ]) {
      const headers = rules?.find((rule) => rule.source === source)?.headers ?? [];
      expect(headers).toContainEqual({ key: "Cache-Control", value: "private, no-store, max-age=0" });
      expect(headers).toContainEqual({ key: "Vary", value: "Cookie, Authorization" });
    }
  });
});
