// @vitest-environment jsdom
import Lenis from "lenis";
import { afterEach, expect, it, vi } from "vitest";
import { interruptSmoothScroll } from "@/components/motion/ApplicationSmoothScroll";

let instance: Lenis | undefined;
afterEach(() => { instance?.destroy(); vi.unstubAllGlobals(); });

it.each([0, 2000])("does not overwrite native navigation/keyboard position %s with old inertia", position => {
  // Vitest's proxied window crosses realms; Lenis uses instanceof Window for dimensions.
  vi.stubGlobal("Window", class { static [Symbol.hasInstance](value: unknown) { return value === window; } });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 6000 });
  const restore = vi.spyOn(window, "scrollTo").mockImplementation((options: ScrollToOptions | number, y?: number) => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: typeof options === "number" ? y ?? 0 : options.top ?? 0 });
  });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  instance = new Lenis({ autoResize: false, autoRaf: false, lerp: 0.15 });
  expect(instance.limit).toBe(6000 - window.innerHeight);
  expect(instance.actualScroll).toBe(0);
  instance.scrollTo(1000, { programmatic: false, lerp: 0.15 });
  instance.raf(16);
  instance.raf(32);
  expect(window.scrollY).toBeGreaterThan(0);
  Object.defineProperty(window, "scrollY", { configurable: true, value: position });
  interruptSmoothScroll(instance);
  instance.resize();
  instance.raf(48);
  expect(window.scrollY).toBe(position);
  expect(instance.isStopped).toBe(false);
  restore.mockRestore();
});
