import { lockPageScroll } from "./scroll-lock";

/** Activates one modal, preserving the exact background/scroll/focus state for release. */
export function activateModalLifecycle(dialog: HTMLElement, onEscape: () => void, returnFocus?: HTMLElement | null) {
  const previous = returnFocus || document.activeElement as HTMLElement | null;
  const unlock = lockPageScroll(document);
  const background = new Map<HTMLElement, boolean>();
  // Walk siblings at each level: this also supports dialogs rendered inside an app shell.
  for (let node: HTMLElement = dialog; node.parentElement; node = node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (sibling !== node && sibling instanceof HTMLElement) {
        background.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }
    if (node.parentElement === document.body) break;
  }
  function handleKey(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); onEscape(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'
    )).filter(element => {
      if (element.tabIndex < 0) return false;
      for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        if (node.hidden || node.inert || getComputedStyle(node).display === "none") return false;
        if (node instanceof HTMLDetailsElement && !node.open && !node.querySelector("summary")?.contains(element)) return false;
      }
      return true;
    });
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    if (!focusable.length) { event.preventDefault(); dialog.focus(); }
    else if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
    else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) { event.preventDefault(); focusable[0].focus(); }
  }
  function containFocus(event: FocusEvent) {
    if (event.target instanceof Node && !dialog.contains(event.target)) dialog.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", handleKey);
  document.addEventListener("focusin", containFocus);
  return () => {
    document.removeEventListener("keydown", handleKey);
    document.removeEventListener("focusin", containFocus);
    background.forEach((inert, element) => { element.inert = inert; });
    unlock();
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  };
}
