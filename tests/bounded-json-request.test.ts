// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { boundedJsonRequest, JsonRequestInterrupted } from "../src/lib/api/bounded-json-request";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("does not issue an already-aborted request", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const controller = new AbortController(); controller.abort();
  await expect(boundedJsonRequest("/local", { signal: controller.signal })).rejects.toMatchObject({ reason: "aborted" });
  expect(fetch).not.toHaveBeenCalled();
});

it("aborts headers/body waiting, fences a late response and removes deadline/listener", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  let finish!: (response: Response) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const result = boundedJsonRequest("/local", { signal: controller.signal });
  const rejected = expect(result).rejects.toBeInstanceOf(JsonRequestInterrupted);
  controller.abort(); await rejected;
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  finish(Response.json({ ok: true }));
  await vi.runAllTimersAsync();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves status and safe null for non-JSON responses and clears successful timers", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 503 })));
  const { response, body } = await boundedJsonRequest("/local", {});
  expect(response.status).toBe(503); expect(body).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
