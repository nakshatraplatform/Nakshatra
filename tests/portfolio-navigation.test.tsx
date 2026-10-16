// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PortfolioNavigation } from "../src/components/templates/PortfolioNavigation";

describe("portfolio section disclosure", () => {
  const sections = [{ href: "#main-content", label: "Overview" }, { href: "#family", label: "Family" }];
  it("places the icon CTA before the menu with a readable, dismissible tooltip", () => {
    render(<PortfolioNavigation sections={sections} showInterest />);
    const interest = screen.getByRole("link", { name: "Show Interest" });
    const trigger = screen.getByRole("button", { name: "Open introduction sections" });
    expect(interest.textContent).toBe("");
    expect(interest.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(interest).toHaveAccessibleDescription("Show Interest");
    fireEvent.focus(interest);
    fireEvent.keyDown(interest,{key:"Escape"});
    expect(interest.parentElement).toHaveAttribute("data-tip-dismissed","true");
  });
  it("opens by keyboard, closes with Escape and returns focus to the trigger", () => {
    render(<PortfolioNavigation sections={sections} showInterest />);
    const trigger = screen.getByRole("button", { name: "Open introduction sections" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    screen.getByRole("link", { name: "Family" }).focus();
    fireEvent.keyDown(screen.getByRole("link", { name: "Family" }), { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
  it("keeps native links, closes after choosing a section, and omits owner-preview interest", () => {
    render(<PortfolioNavigation sections={sections} showInterest={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open introduction sections" }));
    const family = screen.getByRole("link", { name: "Family" });
    expect(family).toHaveAttribute("href", "#family");
    fireEvent.click(family);
    expect(screen.getByRole("button", { name: "Open introduction sections" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Show interest" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Education & work" })).not.toBeInTheDocument();
  });
});
