// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { lockPageScroll } from "../src/lib/ui/scroll-lock";

afterEach(() => { vi.restoreAllMocks(); document.body.removeAttribute("style"); });
describe("modal document scroll lock", () => {
  it("freezes the saved position and restores exact inline styles on final release", () => {
    vi.spyOn(window, "scrollY", "get").mockReturnValue(1234);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    document.body.style.setProperty("overflow", "auto", "important");
    document.body.style.paddingRight = "8px";
    const original = document.body.style.cssText;
    const release = lockPageScroll(document);
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-1234px");
    expect(document.body.style.overflow).toBe("hidden");
    release(); release();
    expect(document.body.style.cssText).toBe(original);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 1234, left: 0, behavior: "instant" });
  });
  it("does not unlock another open portal or capture the already-fixed scroll position", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const first = lockPageScroll(document), second = lockPageScroll(document);
    first();
    expect(document.body.style.position).toBe("fixed");
    expect(scrollTo).not.toHaveBeenCalled();
    second();
    expect(document.body.style.position).toBe("");
    expect(scrollTo).toHaveBeenCalledOnce();
  });
});
