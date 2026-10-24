import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { expect, it } from "vitest";

it.each([false, true])("flushes safe native worker telemetry before exit (failure=%s)", failing => {
  const runner = new URL("../scripts/observed-worker.mjs", import.meta.url).href;
  const core = new URL("../node_modules/@sentry/core/build/esm/index.js", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module"], {
    encoding: "utf8", timeout: 15_000,
    env: { PATH: process.env.PATH, NODE_ENV: "development", SENTRY_ENVIRONMENT: "test", SENTRY_RELEASE: "fixture-release",
      NEXT_PUBLIC_SENTRY_DSN: "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.us.sentry.io/456",
      SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_WORKER_SENTINEL", SENTRY_AUTH_TOKEN: "PRIVATE_WORKER_SENTINEL" },
    input: `
      import { runObservedWorker } from ${JSON.stringify(runner)};
      import { setUser } from ${JSON.stringify(core)};
      const sent = []; let flushed = false; let worked = false;
      try {
        await runObservedWorker("worker.identity-verification", async () => {
          worked = true; setUser({ email: "PRIVATE_WORKER_SENTINEL" });
          ${failing ? 'throw new Error("PRIVATE_WORKER_SENTINEL");' : 'return 42;'}
        }, { transport: () => ({
          send: async envelope => { await new Promise(r => setTimeout(r, 10)); sent.push(envelope); return { statusCode: 200 }; },
          flush: async () => { await new Promise(r => setTimeout(r, 10)); flushed = true; return true; }
        }) });
      } catch { process.exitCode = 1; }
      console.log(JSON.stringify({ worked, flushed, sent }));
    `,
  });
  expect(child.error).toBeUndefined();
  expect(child.status, child.stderr).toBe(failing ? 1 : 0);
  expect(child.stdout).not.toContain("PRIVATE_WORKER_SENTINEL");
  const result = JSON.parse(child.stdout.trim());
  expect(result).toMatchObject({ worked: true, flushed: true });
  const items = result.sent.flatMap((envelope: [unknown, unknown[]]) => envelope[1]);
  const errors = items.filter(([header]: [{ type: string }]) => header.type === "event");
  expect(errors).toHaveLength(failing ? 1 : 0);
  if (failing) expect(errors[0][1]).toMatchObject({ environment: "test", release: "fixture-release", tags: {
    "vivintro.operation": "worker.identity-verification", "vivintro.code": "OPERATION_FAILED",
  } });
});

it("wires each native CLI and scheduled environment to the shared worker lifecycle", () => {
  for (const name of ["process-identity-verifications", "process-account-deletions", "run-data-retention", "process-broker-introductions"]) {
    expect(readFileSync(new URL(`../scripts/${name}.mjs`, import.meta.url), "utf8")).toContain("await runObservedWorker(");
  }
  for (const name of ["identity-verification-worker", "broker-introduction-maintenance"]) {
    const workflow = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8");
    expect(workflow).toContain("NEXT_PUBLIC_SENTRY_DSN: ${{ vars.NEXT_PUBLIC_SENTRY_DSN }}");
    expect(workflow).toContain("SENTRY_RELEASE: ${{ github.sha }}");
    expect(workflow).not.toContain("SENTRY_AUTH_TOKEN");
  }
});

it.each([
  { headers: false, proxy: false }, { headers: true, proxy: false }, { headers: false, proxy: true },
])("exits with the original job result when telemetry stalls (headers=$headers, proxy=$proxy)", async ({ headers, proxy }) => {
  let received = false;
  let proxyConnections = 0;
  const proxySockets = new Set<import("node:net").Socket>();
  const proxyServer = createServer();
  proxyServer.on("connection", socket => {
    proxyConnections++;
    proxySockets.add(socket);
    socket.on("close", () => proxySockets.delete(socket));
  });
  proxyServer.on("connect", () => { /* Deliberately never complete the tunnel. */ });
  const server = createServer((request, response) => {
    received = true;
    request.resume();
    if (headers) { response.writeHead(200); response.flushHeaders(); }
    // Deliberately never finish the response; only the transport deadline can release it.
  });
  await new Promise<void>(resolve => proxyServer.listen(0, "127.0.0.1", resolve));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const proxyAddress = proxyServer.address();
  if (!address || typeof address === "string" || !proxyAddress || typeof proxyAddress === "string") throw new Error("Missing loopback port");
  const runner = new URL("../scripts/observed-worker.mjs", import.meta.url).href;
  const started = Date.now();
  try {
    const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const child = spawn(process.execPath, ["--input-type=module"], { stdio: ["pipe", "pipe", "pipe"],
        env: { PATH: process.env.PATH, NODE_ENV: "test",
          NEXT_PUBLIC_SENTRY_DSN: "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.us.sentry.io/456",
          ...(proxy ? { http_proxy: `http://127.0.0.1:${proxyAddress.port}` } : {}) },
      });
      let output = "";
      const timeout = setTimeout(() => { child.kill(); reject(new Error("Telemetry prevented worker exit")); }, 6000);
      child.stdout.on("data", chunk => { output += chunk; });
      child.on("error", error => { clearTimeout(timeout); reject(error); });
      child.on("close", code => { clearTimeout(timeout); resolve({ code, output }); });
      child.stdin.end(`
        import {runObservedWorker, workerTransport} from ${JSON.stringify(runner)};
        try {
          await runObservedWorker("worker.identity-verification", () => { throw new Error("TASK_FAILED"); },
            {transport: options => workerTransport({...options, url:"http://127.0.0.1:${address.port}/envelope"})});
        } catch { process.exitCode = 1; }
        console.log("job-result-preserved");
      `);
    });
    expect(received).toBe(true);
    expect(proxyConnections).toBe(0);
    expect(result).toEqual({ code: 1, output: "job-result-preserved\n" });
    expect(Date.now() - started).toBeLessThan(5000);
  } finally {
    server.closeAllConnections();
    for (const socket of proxySockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await new Promise<void>(resolve => proxyServer.close(() => resolve()));
  }
}, 10_000);

it("runs the job without telemetry configuration", () => {
  const runner = new URL("../scripts/observed-worker.mjs", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module"], { encoding: "utf8", timeout: 5000,
    env: { PATH: process.env.PATH, NODE_ENV: "test" },
    input: `import {runObservedWorker} from ${JSON.stringify(runner)};
      console.log(await runObservedWorker("worker.identity-verification", () => 42));`,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stdout).toBe("42\n");
});
