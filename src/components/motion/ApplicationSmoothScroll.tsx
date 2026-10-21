"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Cancel pending wheel momentum without moving the browser's current position. */
export function interruptSmoothScroll(lenis: Pick<Lenis, "isStopped" | "stop" | "start">) {
  if (lenis.isStopped) return;
  lenis.stop();
  lenis.start();
}

/** Progressive enhancement only: the browser owns layout, focus and history. */
export function ApplicationSmoothScroll() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const controller = useRef<Lenis | null>(null);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let dispose: (() => void) | undefined;
    const mount = () => {
      const lenis = new Lenis({
        autoRaf: true,
        lerp: 0.15,
        smoothWheel: true,
        syncTouch: false,
        respectReducedMotion: true,
        anchors: true,
        stopInertiaOnNavigate: true,
        // Editors, menus and horizontal strips retain native scrolling/snap behavior.
        allowNestedScroll: true,
        prevent: (node) => node.matches("textarea, select, [role='dialog'], [data-native-scroll]"),
      });
      controller.current = lenis;

      const syncLock = () => {
        const overflow = document.body.style.overflowY || document.body.style.overflow
          || getComputedStyle(document.body).overflowY;
        const modal = document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]');
        if (modal || overflow === "hidden" || overflow === "clip") lenis.stop();
        else lenis.start();
      };
      const dialogSelector = '[role="dialog"][aria-modal="true"], dialog';
      const containsDialog = (node: Node) => node instanceof Element
        && (node.matches(dialogSelector) || Boolean(node.querySelector(dialogSelector)));
      const observer = new MutationObserver(records => {
        // Ignore routine editor text updates; only locks and dialog lifecycles matter.
        if (records.some(record => record.type === "attributes"
          ? record.target === document.body || (record.target instanceof Element && record.target.matches(dialogSelector))
          : [...record.addedNodes, ...record.removedNodes].some(containsDialog))) syncLock();
      });
      observer.observe(document.body, {
        attributes: true, attributeFilter: ["style", "class", "open", "aria-modal"], childList: true, subtree: true,
      });
      const onKeyDown = (event: KeyboardEvent) => {
        if (!event.defaultPrevented && ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
          interruptSmoothScroll(lenis);
        }
      };
      // Native focus/scrollIntoView can run immediately before click. Synchronize
      // Lenis before its bubble-phase anchor handler computes target geometry.
      const onClick = (event: MouseEvent) => {
        if (event.composedPath().some(node => node instanceof HTMLAnchorElement)) interruptSmoothScroll(lenis);
      };
      // Responsive stories can change geometry while an anchor is still easing.
      // Cancel its old target before native/GSAP chapter restoration, without
      // taking ownership of the browser's current scroll position.
      const onViewportResize = () => {
        interruptSmoothScroll(lenis);
        lenis.resize();
      };
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown);
      window.addEventListener("resize", onViewportResize);
      syncLock();
      return () => {
        observer.disconnect();
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("resize", onViewportResize);
        controller.current = null;
        lenis.destroy();
      };
    };
    const syncPreference = () => {
      // Do not change document classes while the browser saves its history
      // position. RAF is natively paused while hidden; refresh on return instead.
      if (document.hidden) return;
      dispose?.();
      // Use fully native scrolling, not even a one-frame interpolation, for reduce.
      dispose = preference.matches ? undefined : mount();
    };
    syncPreference();
    preference.addEventListener("change", syncPreference);
    document.addEventListener("visibilitychange", syncPreference);
    return () => {
      preference.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", syncPreference);
      dispose?.();
    };
  }, []);

  useEffect(() => {
    // A fresh instance has no old-page inertia; do not reset browser-restored
    // scroll during the initial hydration of a back/forward navigation.
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    // Cancel old-page inertia without overriding Next's scroll/history restoration.
    const lenis = controller.current;
    if (lenis) {
      interruptSmoothScroll(lenis);
      lenis.resize();
    }
  }, [pathname]);

  return null;
}
