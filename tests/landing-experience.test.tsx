// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "../src/components/landing/LandingExperience";

describe("LandingExperience pilot messaging", () => {
  it("states the waitlist boundary without blocking the viewer journey", () => {
    render(<LandingExperience variant="clarity" />);

    expect(screen.getAllByText(/private pilot · public waitlist/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /pilot is private.*waitlist is open/i })).toBeInTheDocument();
    expect(screen.getByText(/receive a shared portfolio can still read its First View and express interest/i)).toBeInTheDocument();
    expect(screen.getByText(/receive seven-day Full View access after approval/i)).toBeInTheDocument();
  });

  it("describes the non-entitling waitlist and required creator verification", () => {
    render(<LandingExperience variant="clarity" />);

    expect(document.body).toHaveTextContent(/Waitlist registration does not create product access/i);
    expect(document.body).toHaveTextContent(/Didit identity verification before publication/i);
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
    expect(screen.queryByText(/choose a plan/i)).not.toBeInTheDocument();
  });

  it("uses waitlist calls to action and keeps existing-user sign-in available", () => {
    render(<LandingExperience variant="clarity" />);

    for (const link of screen.getAllByRole("link", { name: /join.*waitlist/i })) {
      expect(link).toHaveAttribute("href", "/pilot-access");
    }
    expect(screen.getByRole("link", { name: "Sign in to Nakshatra" })).toHaveAttribute("href", "/login");
  });
});
