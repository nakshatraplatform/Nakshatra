import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("account deletion command", () => {
  it("exits nonzero after persisting a deferred Storage failure", async () => {
    const server = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url?.includes("claim_account_deletion_batch")) {
        res.end(JSON.stringify([{ request_id: "request", claim_token: "lease", user_id: "user", processing_stage: "claimed" }]));
      } else if (req.url?.includes("fail_account_deletion")) res.end("true");
      else { res.statusCode = 503; res.end(JSON.stringify({ message: "synthetic Storage failure" })); }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address() as { port: number };
      const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ["scripts/process-account-deletions.mjs"], {
          cwd: process.cwd(), env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`, SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-credential" },
        });
        let output = "";
        child.stdout.on("data", data => { output += data; });
        child.stderr.on("data", data => { output += data; });
        child.on("error", reject); child.on("close", code => resolve({ code, output }));
      });
      expect(result.code).not.toBe(0);
      expect(result.output).toContain("0 completed, 1 deferred");
      expect(result.output).toContain("ACCOUNT_DELETION_WORK_DEFERRED");
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
});
