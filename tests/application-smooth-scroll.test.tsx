// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(), destroy: vi.fn(), stop: vi.fn(), start: vi.fn(), resize: vi.fn(), scrollTo: vi.fn(),
  pathname: "/",
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("lenis", () => ({ default: class {
  constructor(options: unknown) { mocks.create(options); }
  destroy = mocks.destroy; stop = mocks.stop; start = mocks.start;
  resize = mocks.resize; scrollTo = mocks.scrollTo;
} }));
import { ApplicationSmoothScroll } from "@/components/motion/ApplicationSmoothScroll";
afterEach(() => { document.body.style.overflow = ""; mocks.pathname = "/"; });

it("enables one accessible root controller with native touch and nested scrolling", () => {
  render(<ApplicationSmoothScroll />);
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
    autoRaf: true, respectReducedMotion: true, syncTouch: false, allowNestedScroll: true, anchors: true,
  }));
  expect(mocks.create).toHaveBeenCalledTimes(1);
});

it("stops for a body scroll lock and resumes after close", async () => {
  render(<ApplicationSmoothScroll />);
  document.body.style.overflow = "hidden";
  await waitFor(() => expect(mocks.stop).toHaveBeenCalled());
  mocks.start.mockClear();
  document.body.style.overflow = "";
  await waitFor(() => expect(mocks.start).toHaveBeenCalled());
});

it("reconciles route scroll without resetting browser-owned position", () => {
  const view = render(<ApplicationSmoothScroll />);
  mocks.scrollTo.mockClear();
  mocks.pathname = "/dashboard";
  view.rerender(<ApplicationSmoothScroll />);
  expect(mocks.stop).toHaveBeenCalled();
  expect(mocks.resize).toHaveBeenCalled();
  expect(mocks.scrollTo).not.toHaveBeenCalled();
});

it("suspends inertia for modal dialogs even without a body style lock", async () => {
  const view = render(<><ApplicationSmoothScroll /><section role="dialog" aria-modal="true" /></>);
  expect(mocks.stop).toHaveBeenCalled();
  mocks.start.mockClear();
  view.rerender(<ApplicationSmoothScroll />);
  await waitFor(() => expect(mocks.start).toHaveBeenCalled());
});

it("leaves the native history position unlocked while hidden and recreates on return", () => {
  render(<ApplicationSmoothScroll />);
  mocks.stop.mockClear();
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(mocks.destroy).not.toHaveBeenCalled();
  expect(mocks.stop).not.toHaveBeenCalled();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(mocks.destroy).toHaveBeenCalledOnce();
  expect(mocks.create).toHaveBeenCalledTimes(2);
});

it("does not interrupt native restoration when a fresh controller first mounts", () => {
  render(<ApplicationSmoothScroll />);
  expect(mocks.stop).not.toHaveBeenCalled();
  expect(mocks.resize).not.toHaveBeenCalled();
});

it("uses native scrolling when reduced motion is already requested", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  render(<ApplicationSmoothScroll />);
  expect(mocks.create).not.toHaveBeenCalled();
});

it("switches live to native scrolling and recreates only on preference return", () => {
  const preference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.spyOn(window, "matchMedia").mockReturnValue(preference as unknown as MediaQueryList);
  const view = render(<ApplicationSmoothScroll />);
  const change = preference.addEventListener.mock.calls[0][1] as () => void;
  preference.matches = true;
  change();
  expect(mocks.destroy).toHaveBeenCalledTimes(1);
  preference.matches = false;
  change();
  expect(mocks.create).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(mocks.destroy).toHaveBeenCalledTimes(2);
  expect(preference.removeEventListener).toHaveBeenCalledWith("change", change);
});

it("destroys the controller and disconnects body-lock handling on unmount", async () => {
  const view = render(<ApplicationSmoothScroll />);
  view.unmount();
  expect(mocks.destroy).toHaveBeenCalledTimes(1);
  mocks.stop.mockClear();
  document.body.style.overflow = "hidden";
  await Promise.resolve();
  expect(mocks.stop).not.toHaveBeenCalled();
});
