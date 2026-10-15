/** Freeze the document, not just overflow (which iOS can keep scrolling).
 * A final release restores the exact inline styles and pre-dialog position.
 * Nested portals share one snapshot and cannot unlock each other's background.
 */
const locks = new WeakMap<Document, { count: number; restore: () => void }>();

export function lockPageScroll(document: Document) {
  const existing = locks.get(document);
  if (existing) existing.count += 1;
  else {
    const view = document.defaultView;
    if (!view) return () => {};
    const body = document.body;
    const x = view.scrollX, y = view.scrollY;
    const properties = ["position", "top", "left", "width", "overflow", "padding-right"] as const;
    const previous = properties.map(property => [property, body.style.getPropertyValue(property), body.style.getPropertyPriority(property)] as const);
    const gutter = Math.max(0, view.innerWidth - document.documentElement.clientWidth);
    const padding = parseFloat(view.getComputedStyle(body).paddingRight) || 0;
    body.style.position = "fixed";
    body.style.top = `${-y}px`;
    body.style.left = `${-x}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (gutter) body.style.paddingRight = `${padding + gutter}px`;
    locks.set(document, { count: 1, restore() {
      previous.forEach(([property, value, priority]) => {
        if (value) body.style.setProperty(property, value, priority);
        else body.style.removeProperty(property);
      });
      view.scrollTo({ top: y, left: x, behavior: "instant" });
    } });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const lock = locks.get(document);
    if (lock && --lock.count === 0) { locks.delete(document); lock.restore(); }
  };
}
