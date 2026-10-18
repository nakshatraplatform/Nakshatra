// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LivenessCompletionDialog } from "@/features/identity-verification/client/liveness-completion-dialog";

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function () { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function () { this.removeAttribute("open"); } });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
describe("liveness completion feedback", () => {
  it.each([
    ["accepted", "accepted by our email provider. Inbox delivery may take longer"],
    ["queued", "confirmation email is queued"],
    ["processing", "confirmation email is queued"],
    ["failed", "could not send the confirmation email"],
    ["skipped", "could not send the confirmation email"],
    [null, "Email status is unavailable"],
  ] as const)("describes %s honestly and restores focus and scrolling on dismissal", (status, message) => {
    const trigger = document.createElement("button");
    document.body.append(trigger); trigger.focus();
    const dismiss = vi.fn();
    const view = render(<LivenessCompletionDialog emailStatus={status} returnPage={false} onDismiss={dismiss} />);
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(dismiss).toHaveBeenCalledOnce();
    view.unmount();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
    trigger.remove();
  });
  it("provides dashboard continuation and keeps Escape local to the completion dialog", () => {
    const dismiss = vi.fn(), parentKey = vi.fn();
    render(<div onKeyDown={parentKey}><LivenessCompletionDialog emailStatus="queued" returnPage onDismiss={dismiss} /></div>);
    const dialog = screen.getByRole("dialog", { name: "Liveness check complete" });
    expect(screen.getByRole("link", { name: "Continue to dashboard" })).toHaveAttribute("href", "/dashboard");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(parentKey).not.toHaveBeenCalled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(dismiss).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Stay on this page" }));
    expect(dismiss).toHaveBeenCalledTimes(2);
  });
});
