// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "../src/components/landing/LandingExperience";

describe("LandingExperience consent-led messaging", () => {
  it("makes controlled disclosure and honest forwarding boundaries clear", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("heading", { name: /phone number shouldn’t travel together/i })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/Anyone with the link can read the first introduction/i);
    expect(document.body).toHaveTextContent(/cannot stop someone from forwarding/i);
    expect(screen.getByRole("list", { name: /privacy assurances/i })).toHaveTextContent(/Not searchable/i);
  });

  it("connects every promise to a real route", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getAllByRole("link", { name: /see a real introduction|open the demo portfolio/i })[0]).toHaveAttribute("href", "/demo");
    for (const link of screen.getAllByRole("link", { name: /request an invitation/i })) expect(link).toHaveAttribute("href", "/waitlist");
    expect(screen.getByRole("link", { name: /read the viewer guide/i })).toHaveAttribute("href", "/received-a-link");
  });

  it("keeps the guided lifecycle and 15-day approved access distinct", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("navigation", { name: "Guided tour steps" })).toHaveTextContent(/Create.*Preview and verify.*Share.*Approve/i);
    expect(document.body).toHaveTextContent(/Complete Portfolio access lasts 15 days/i);
    expect(document.body).toHaveTextContent(/public introduction remains available until its owner unpublishes/i);
  });
});
