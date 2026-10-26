import { lockPageScroll } from "./scroll-lock";

type ActiveModal = { dialog: HTMLElement; protectBackground: () => void; focusInside: () => void };
const stacks = new WeakMap<Document, ActiveModal[]>();

/** One lifecycle owns background isolation, nested focus, Escape and the shared scroll lock. */
export function activateModalLifecycle(dialog: HTMLElement, onEscape: () => void, returnFocus?: HTMLElement | null) {
  const document = dialog.ownerDocument;
  const previous = returnFocus || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const unlock = lockPageScroll(document);
  const background = new Set<HTMLElement>();
  const stack = stacks.get(document) || [];
  stacks.set(document, stack);
  const nativeDialog = () => document.querySelector("dialog[open]");
  const isTop = () => stack.at(-1) === entry && (!nativeDialog() || dialog.contains(nativeDialog()));
  const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
    'button, input:not([type="hidden"]), select, textarea, summary, iframe, [href], [tabindex]',
  )).filter(element => {
    if (element.tabIndex < 0 || element.matches(":disabled") || !element.getClientRects().length) return false;
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || node.hasAttribute("inert") || node.inert || style.display === "none" || style.visibility === "hidden") return false;
      if (node instanceof HTMLDetailsElement && !node.open && !node.querySelector("summary")?.contains(element)) return false;
    }
    return true;
  });
  const focusInside = () => (focusable()[0] ?? dialog).focus({ preventScroll: true });
  function protectBackground() {
    if (!isTop()) return;
    for (let branch: HTMLElement = dialog; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement) || sibling.hasAttribute("inert") || sibling.inert) continue;
        // A new modal may mount before its effect registers; let it take the top position.
        if (sibling.matches('dialog[open], [role="dialog"][aria-modal="true"]') || sibling.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) continue;
        background.add(sibling);
        sibling.setAttribute("inert", "");
        sibling.inert = true;
      }
      if (branch.parentElement === document.body) break;
    }
  }
  const entry: ActiveModal = { dialog, protectBackground, focusInside };
  stack.push(entry);
  // Child dialogs and later portal siblings are above their parent surface.
  stack.sort((a, b) => a.dialog.contains(b.dialog) ? -1 : b.dialog.contains(a.dialog) ? 1
    : a.dialog.compareDocumentPosition(b.dialog) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  protectBackground();
  if (isTop()) {
    const titleId = dialog.getAttribute("aria-labelledby")?.split(/\s+/)[0];
    const title = titleId ? document.getElementById(titleId) : null;
    if (title && dialog.contains(title) && title.hasAttribute("tabindex")) title.focus({ preventScroll: true });
    else focusInside();
  }
  const observer = new MutationObserver(protectBackground);
  observer.observe(document.body, { childList: true, subtree: true });
  function handleKey(event: KeyboardEvent) {
    if (!isTop() || event.defaultPrevented) return;
    if (event.key === "Escape") { event.preventDefault(); onEscape(); return; }
    if (event.key !== "Tab") return;
    const elements = focusable();
    const index = elements.indexOf(document.activeElement as HTMLElement);
    if (!elements.length || (event.shiftKey ? index <= 0 : index < 0 || index === elements.length - 1)) {
      event.preventDefault();
      (event.shiftKey ? elements.at(-1) ?? dialog : elements[0] ?? dialog).focus();
    }
  }
  function containFocus(event: FocusEvent) {
    if (isTop() && event.target instanceof Node && !dialog.contains(event.target)) focusInside();
  }
  document.addEventListener("keydown", handleKey);
  document.addEventListener("focusin", containFocus);
  return () => {
    observer.disconnect();
    document.removeEventListener("keydown", handleKey);
    document.removeEventListener("focusin", containFocus);
    stack.splice(stack.indexOf(entry), 1);
    background.forEach(element => { element.removeAttribute("inert"); element.inert = false; });
    stack.at(-1)?.protectBackground();
    if (!stack.length) stacks.delete(document);
    unlock();
    const top = stack.at(-1);
    if (nativeDialog() && !nativeDialog()?.contains(previous)) return;
    if (previous?.isConnected && (!top || top.dialog.contains(previous))) previous.focus({ preventScroll: true });
    else if (top) top.focusInside();
  };
}
