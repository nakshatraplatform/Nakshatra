// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "../src/components/landing/LandingExperience";

describe("LandingExperience consent-led messaging", () => {
  it("makes controlled disclosure and honest forwarding boundaries clear", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("heading", { name: /one introduction.*one link.*always current/i })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/public Introduction can be forwarded or captured/i);
    expect(screen.getByRole("heading", { name: /share the introduction.*decide on the rest/i })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/protected details need approval/i);
    expect(screen.getByRole("list", { name: /privacy assurances/i })).toHaveTextContent(/Not searchable/i);
    expect(screen.getByRole("list", { name: /privacy assurances/i })).toHaveTextContent(/Photo checks are clearly marked/i);
    expect(document.body).not.toHaveTextContent(/Identity-checked creator|Required before publication/i);
    expect(document.body).toHaveTextContent(/A test publication without this check has no badge/i);
  });

  it("connects every promise to a real route", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getAllByRole("link", { name: /view.*sample introduction/i })[0]).toHaveAttribute("href", "/demo");
    for (const link of screen.getAllByRole("link", { name: /request an invitation/i })) expect(link).toHaveAttribute("href", "/waitlist");
    for (const link of screen.getAllByRole("link", { name: /read the viewer guide/i })) expect(link).toHaveAttribute("href", "/received-a-link");
  });

  it("keeps the guided lifecycle and 15-day approved access distinct", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("navigation", { name: "Guided tour steps" })).toHaveTextContent(/Create.*Preview and prepare.*Share.*Approve/i);
    expect(screen.getByRole("heading", { name: /how vivintro works/i })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/create once, share carefully, and decide what comes next/i);
    expect(document.body).toHaveTextContent(/protected access lasts up to 15 days/i);
    expect(document.body).toHaveTextContent(/current creator pilot is free and invitation-only/i);
    expect(document.body).toHaveTextContent(/unpublish it or rotate the link, which makes the previous link stop working/i);
    expect(document.body).toHaveTextContent(/creating an Introduction becomes available only after an invitation is issued/i);
  });
});
