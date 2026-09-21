// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "../src/components/landing/LandingExperience";

describe("LandingExperience consent-led messaging", () => {
  it("makes controlled disclosure and honest forwarding boundaries clear", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("heading", { name: /one introduction.*one link.*always current/i })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/Anyone who receives the link can forward and open the shared introduction/i);
    expect(document.body).toHaveTextContent(/private details do not have to/i);
    expect(screen.getByRole("list", { name: /privacy assurances/i })).toHaveTextContent(/Not searchable/i);
  });

  it("connects every promise to a real route", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getAllByRole("link", { name: /view.*sample introduction/i })[0]).toHaveAttribute("href", "/demo");
    for (const link of screen.getAllByRole("link", { name: /request an invitation/i })) expect(link).toHaveAttribute("href", "/waitlist");
    expect(screen.getByRole("link", { name: /read the viewer guide/i })).toHaveAttribute("href", "/received-a-link");
  });

  it("keeps the guided lifecycle and 15-day approved access distinct", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("navigation", { name: "Guided tour steps" })).toHaveTextContent(/Create.*Preview and verify.*Share.*Approve/i);
    expect(screen.getByRole("heading", { name: /how vivintro works/i })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/create once, share carefully, and decide what comes next/i);
    expect(document.body).toHaveTextContent(/protected access lasts 15 days/i);
    expect(document.body).toHaveTextContent(/current creator pilot is free and invitation-only/i);
    expect(document.body).toHaveTextContent(/public introduction remains available until its owner unpublishes/i);
  });
});
