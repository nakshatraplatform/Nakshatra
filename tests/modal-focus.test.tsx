// @vitest-environment jsdom
import React, { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
});
afterEach(() => vi.restoreAllMocks());

it("lets only the top nested dialog own Escape and restores its invoking control", () => {
  function Nested() {
    const [parentOpen, setParentOpen] = useState(false);
    const [childOpen, setChildOpen] = useState(false);
    const parent = useRef<HTMLElement>(null), child = useRef<HTMLElement>(null);
    useModalFocus(parentOpen, parent, () => setParentOpen(false));
    useModalFocus(childOpen, child, () => setChildOpen(false));
    return <><button onClick={() => setParentOpen(true)}>Open parent</button>{parentOpen && <section role="dialog" aria-label="Parent" ref={parent} tabIndex={-1}>
      <button onClick={() => setChildOpen(true)}>Open child</button><button>Parent last</button>
      {childOpen && <section role="dialog" aria-modal="true" aria-label="Child" ref={child} tabIndex={-1}><button>Child first</button><button>Child last</button></section>}
    </section>}</>;
  }
  render(<Nested />);
  fireEvent.click(screen.getByText("Open parent"));
  const trigger = screen.getByText("Open child"); trigger.focus(); fireEvent.click(trigger);
  const child = screen.getByRole("dialog", { name: "Child" });
  expect(within(child).getByText("Child first")).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(within(child).getByText("Child last")).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Child" })).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "Parent" })).toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe("hidden");
});

it("isolates newly inserted background nodes and releases only its own inert state", async () => {
  const late = document.createElement("button"); late.textContent = "Late background";
  const preserved = document.createElement("aside"); preserved.setAttribute("inert", "");
  document.body.append(preserved);
  try {
    render(<Fixture />); fireEvent.click(screen.getByText("Open"));
    document.body.append(late);
    await waitFor(() => expect(late).toHaveAttribute("inert"));
    late.focus(); expect(screen.getByText("First")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(late).not.toHaveAttribute("inert");
    expect(preserved).toHaveAttribute("inert");
  } finally { late.remove(); preserved.remove(); }
});

it("pauses the custom focus trap while a native dialog is open", () => {
  const native = document.createElement("dialog"); native.setAttribute("open", "");
  const control = document.createElement("button"); native.append(control);
  render(<Fixture />); fireEvent.click(screen.getByText("Open"));
  try {
    document.body.append(native); control.focus();
    expect(control).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByText("First")).toBeInTheDocument();
  } finally { native.remove(); }
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByText("First")).not.toBeInTheDocument();
});

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

it("does not resurrect caller-controlled inert after that caller removes it", () => {
  function ControlledFixture() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLElement>(null);
    useModalFocus(open, ref, () => setOpen(false));
    return <><main inert={open} data-testid="controlled"><button onClick={() => setOpen(true)}>Open controlled</button></main>
      {open && <section ref={ref} role="dialog" tabIndex={-1}><button>Close target</button></section>}</>;
  }
  render(<ControlledFixture />);
  fireEvent.click(screen.getByText("Open controlled"));
  expect(screen.getByTestId("controlled")).toHaveAttribute("inert");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByTestId("controlled")).not.toHaveAttribute("inert");
});

it("preserves an editor's explicitly focusable heading as its entry point", () => {
  function HeadingFixture() {
    const ref = useRef<HTMLElement>(null);
    useModalFocus(true, ref, () => {});
    return <section ref={ref} role="dialog" aria-labelledby="editor-entry"><h2 id="editor-entry" tabIndex={-1}>Editor entry</h2><button>First action</button><button>Last action</button></section>;
  }
  render(<HeadingFixture />);
  expect(screen.getByRole("heading", { name: "Editor entry" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(screen.getByRole("button", { name: "First action" })).toHaveFocus();
  screen.getByRole("heading", { name: "Editor entry" }).focus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(screen.getByRole("button", { name: "Last action" })).toHaveFocus();
});
