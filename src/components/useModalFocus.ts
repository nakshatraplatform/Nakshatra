"use client";

import { useEffect, useRef, type RefObject } from "react";
import { lockPageScroll } from "@/lib/ui/scroll-lock";

/** Keyboard and background lifecycle for the application's existing modal surfaces. */
export function useModalFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScroll = lockPageScroll(document);
    const background: Array<{ element: HTMLElement; inert: boolean }> = [];
    // Inert sibling branches, never the dialog's own ancestors.
    for (let branch: HTMLElement = dialog; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        // Leave existing inert ownership to its caller (including React props).
        // Restoring it ourselves could undo a later render that cleared it.
        if (sibling !== branch && sibling instanceof HTMLElement && !sibling.hasAttribute("inert")) {
          background.push({ element: sibling, inert: sibling.hasAttribute("inert") });
          sibling.setAttribute("inert", "");
        }
      }
      if (branch.parentElement === document.body) break;
    }
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]',
    )).filter(element => element.tabIndex >= 0
      && !element.matches(":disabled")
      && !element.closest("[hidden], [inert]")
      && element.getClientRects().length > 0
      && getComputedStyle(element).visibility !== "hidden");
    const focusInside = () => (focusable()[0] ?? dialog).focus();
    const titleId = dialog.getAttribute("aria-labelledby")?.split(/\s+/)[0];
    const title = titleId ? document.getElementById(titleId) : null;
    // Long editors explicitly make their heading focusable; keep that entry
    // point while simple confirmations still focus their first control.
    if (title && dialog.contains(title) && title.hasAttribute("tabindex")) title.focus({ preventScroll: true });
    else focusInside();
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dismissRef.current();
      } else if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        const active = document.activeElement;
        if (!first || !elements.some(element => element === active) || (event.shiftKey ? active === first : active === last)) {
          event.preventDefault();
          (event.shiftKey ? last ?? dialog : first ?? dialog).focus();
        }
      }
    };
    const handleFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) focusInside();
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", handleFocus);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("focusin", handleFocus);
      background.forEach(({ element, inert }) => { element.toggleAttribute("inert", inert); });
      releaseScroll();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, dialogRef]);
}
