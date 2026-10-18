// @vitest-environment jsdom
import React, { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useModalFocus } from "../src/components/useModalFocus";

function Fixture({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useModalFocus(open, ref, () => { if (dismissible) setOpen(false); });
  return <><button onClick={() => setOpen(true)}>Open</button>
    <aside data-testid="background">Background</aside>
    {open && <section ref={ref} role="dialog" tabIndex={-1}>
      <button>First</button><input aria-label="Disabled" disabled /><button>Last</button>
    </section>}</>;
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
});
afterEach(() => vi.restoreAllMocks());

it("focuses inside, wraps both ways, prevents background focus and restores on Escape", () => {
  document.body.style.overflow = "auto";
  render(<Fixture />);
  const trigger = screen.getByRole("button", { name: "Open" });
  trigger.focus(); fireEvent.click(trigger);
  const first = screen.getByRole("button", { name: "First" });
  const last = screen.getByRole("button", { name: "Last" });
  expect(first).toHaveFocus();
  expect(screen.getByTestId("background")).toHaveAttribute("inert");
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true }); expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Tab" }); expect(first).toHaveFocus();
  trigger.focus(); expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe("auto");
  expect(screen.getByTestId("background")).not.toHaveAttribute("inert");
});

it("uses the latest dismissal guard and releases resources on unmount", () => {
  const view = render(<Fixture dismissible={false} />);
  fireEvent.click(screen.getByText("Open"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  view.rerender(<Fixture dismissible />);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Open"));
  view.unmount();
  expect(document.body.style.overflow).not.toBe("hidden");
});

it("preserves existing inert state and handles a dialog without focusable controls", () => {
  vi.mocked(HTMLElement.prototype.getClientRects).mockReturnValue([] as unknown as DOMRectList);
  render(<Fixture />);
  const background = screen.getByTestId("background");
  background.setAttribute("inert", "");
  fireEvent.click(screen.getByText("Open"));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(dialog).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(background).toHaveAttribute("inert");
});
