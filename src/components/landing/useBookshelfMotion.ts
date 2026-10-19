"use client";

import { useRef, type RefObject } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Native sticky layout owns pinning; one scrubbed timeline owns the four books. */
export function useBookshelfMotion(
  root: RefObject<HTMLElement | null>,
  onStep: (index: number) => void,
  onEnhanced: (enabled: boolean) => void,
) {
  const navigate = useRef<((index: number) => void) | null>(null);

  useGSAP(() => {
    const element = root.current;
    if (!element) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const scene = element.querySelector<HTMLElement>("[data-shelf-scene]")!;
      const stage = element.querySelector<HTMLElement>("[data-shelf-stage]")!;
      const books = Array.from(element.querySelectorAll<HTMLElement>("[data-shelf-book]"));
      const anchors = Array.from(element.querySelectorAll<HTMLElement>("[data-shelf-anchor]"));
      const covers = books.map(book => book.querySelector<HTMLElement>("[data-shelf-cover]")!);
      const papers = books.map(book => book.querySelector<HTMLElement>("[data-shelf-paper]")!);
      element.dataset.bookshelf = "true";
      onEnhanced(true);

      const slot = () => Math.min(stage.clientWidth / 4.5, 245);
      const shelfX = (index: number) => (index - 1.5) * slot();
      const shelfScale = () => Math.min(0.78, slot() / books[0].offsetWidth * 0.86);
      const shelfY = () => Math.max(10, stage.clientHeight * 0.08);
      const restBooks = () => gsap.set(books, { xPercent: -50, yPercent: -50, x: shelfX, y: shelfY, scale: shelfScale, rotationY: -24, rotationX: 3 });
      restBooks();
      gsap.set(covers, { rotationY: 0 });
      gsap.set(papers, { autoAlpha: 0 });

      const readings: number[] = [];
      const intervals: { start: number; end: number }[] = [];
      const timeline = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: element,
          start: "top top",
          end: () => `+=${element.offsetHeight - scene.offsetHeight}`,
          scrub: 0.45,
          invalidateOnRefresh: true,
        },
        onUpdate: () => {
          const time = timeline.time();
          const active = intervals.findIndex(interval => time >= interval.start && time <= interval.end);
          onStep(active);
        },
      });

      books.forEach((book, index) => {
        const start = 0.5 + index * 3.6;
        readings.push(start + 1.55);
        intervals.push({ start: start + 0.7, end: start + 2.85 });
        timeline.set(book, { zIndex: 5 }, start);
        // The book leaves its shelf before its front cover hinges open.
        timeline.to(book, { x: () => stage.clientWidth < 800 ? 0 : book.offsetWidth * 0.46, y: 0, scale: 1, rotationY: 0, rotationX: 0, duration: 0.85 }, start);
        books.forEach((other, otherIndex) => {
          if (otherIndex === index) return;
          timeline.to(other, {
            x: () => (otherIndex < index ? -1 : 1) * stage.clientWidth * 0.44,
            scale: () => shelfScale() * 0.65, autoAlpha: 0, duration: 0.7,
          }, start);
        });
        timeline.to(covers[index], { rotationY: -175, duration: 0.85 }, start + 0.4);
        timeline.to(papers[index], { autoAlpha: 1, duration: 0.3 }, start + 0.65);
        // The gap between opening and closing is the reading interval.
        timeline.to(covers[index], { rotationY: 0, duration: 0.65 }, start + 2.6);
        timeline.to(papers[index], { autoAlpha: 0, duration: 0.25 }, start + 2.85);
        timeline.to(books, { x: shelfX, y: shelfY, scale: shelfScale, rotationY: -24, rotationX: 3, autoAlpha: 1, duration: 0.6 }, start + 3);
        timeline.set(book, { zIndex: 1 }, start + 3.6);
      });

      // Keep real fragment targets in the scrolling document, outside the sticky
      // scene. Native reload/history restoration then lands on the reading pose.
      const positionAnchors = () => {
        // A refresh at timeline zero does not render a tween. Recalculate the
        // initial shelf explicitly so desktop offsets cannot survive on phones.
        if (timeline.time() < 0.5) restBooks();
        gsap.set(anchors, { top: (index: number) => (element.offsetHeight - scene.offsetHeight) * readings[index] / timeline.duration() });
        // Refresh may restore the timeline with callbacks suppressed. Keep the
        // accessible reading state aligned with the rendered page after reload.
        onStep(intervals.findIndex(interval => timeline.time() >= interval.start && timeline.time() <= interval.end));
      };
      positionAnchors();
      ScrollTrigger.addEventListener("refresh", positionAnchors);

      const goToStep = (index: number) => {
        const trigger = timeline.scrollTrigger;
        if (!trigger || readings[index] === undefined) return;
        // A single native jump avoids a competing smooth-scroll controller.
        // Timeline scrub supplies the visual transition to the requested book.
        window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * readings[index] / timeline.duration(), behavior: "instant" });
      };
      navigate.current = (index) => {
        history.replaceState(history.state, "", `#tour-step-${String(index + 1).padStart(2, "0")}`);
        goToStep(index);
      };
      const followHash = () => {
        const index = books.findIndex(book => `#tour-step-${book.dataset.tourStep}` === window.location.hash);
        if (index >= 0) goToStep(index);
      };
      let disposed = false;
      let hashFrame = 0;
      let resizeFrame = 0;
      let viewportWidth = window.innerWidth;
      const preserveChapterOnResize = () => {
        if (window.innerWidth === viewportWidth) return;
        viewportWidth = window.innerWidth;
        const index = intervals.findIndex(interval => timeline.time() >= interval.start && timeline.time() <= interval.end);
        if (index < 0 || !timeline.scrollTrigger?.isActive) return;
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          if (disposed) return;
          ScrollTrigger.refresh();
          goToStep(index);
        });
      };
      const alignHashAfterLayout = () => {
        cancelAnimationFrame(hashFrame);
        // Wait for React to move fragment IDs from static articles to markers.
        hashFrame = requestAnimationFrame(() => {
          hashFrame = requestAnimationFrame(() => {
            if (disposed) return;
            ScrollTrigger.refresh();
            followHash();
          });
        });
      };
      window.addEventListener("hashchange", alignHashAfterLayout);
      window.addEventListener("load", alignHashAfterLayout);
      window.addEventListener("resize", preserveChapterOnResize);
      void document.fonts?.ready.then(() => {
        if (disposed) return;
        ScrollTrigger.refresh();
        if (document.readyState === "complete") alignHashAfterLayout();
      });

      return () => {
        disposed = true;
        cancelAnimationFrame(hashFrame);
        cancelAnimationFrame(resizeFrame);
        ScrollTrigger.removeEventListener("refresh", positionAnchors);
        window.removeEventListener("hashchange", alignHashAfterLayout);
        window.removeEventListener("load", alignHashAfterLayout);
        window.removeEventListener("resize", preserveChapterOnResize);
        navigate.current = null;
        delete element.dataset.bookshelf;
        onEnhanced(false);
        onStep(-1);
      };
    });
    return () => media.revert();
  }, { scope: root });

  return navigate;
}
