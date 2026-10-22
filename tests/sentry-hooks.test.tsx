// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn(), captureRequestError: vi.fn(), captureRouterTransitionStart: vi.fn() }));
vi.mock("@sentry/nextjs", () => sdk);
vi.mock("@/components/brand/VivIntroBrand", () => ({ VivIntroBrand: () => <span>vivintro</span> }));

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

it("registers the correct runtime with the shared privacy settings", async () => {
  const hooks = await import("../src/instrumentation");
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  await hooks.register();
  vi.stubEnv("NEXT_RUNTIME", "edge");
  await hooks.register();
  expect(sdk.init).toHaveBeenCalledTimes(2);
  for (const [options] of sdk.init.mock.calls) {
    expect(options.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false });
    expect(options.beforeSend).toBeTypeOf("function");
    expect(options.beforeSendSpan).toBeTypeOf("function");
  }
  expect(hooks.onRequestError).toBe(sdk.captureRequestError);
  vi.unstubAllEnvs();
});

it("initializes browser instrumentation and forwards Next navigation events", async () => {
  const hooks = await import("../src/instrumentation-client");
  expect(sdk.init).toHaveBeenCalledTimes(1);
  expect(hooks.onRouterTransitionStart).toBe(sdk.captureRouterTransitionStart);
});

it("reports React render errors once and preserves the current recovery controls", async () => {
  const { default: AppError } = await import("../src/app/error");
  const error = new Error("private provider failure");
  const reset = vi.fn();
  const view = render(<AppError error={error} reset={reset} />);
  expect(sdk.captureException).toHaveBeenCalledWith(error);
  view.rerender(<AppError error={error} reset={reset} />);
  expect(sdk.captureException).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/private provider failure/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledTimes(1);
});
