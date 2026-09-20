// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "../src/components/landing/LandingExperience";

describe("LandingExperience pilot messaging", () => {
  it("states the waitlist boundary without blocking the viewer journey", () => {
    render(<LandingExperience variant="clarity" />);

    expect(screen.getAllByText(/private pilot · public waitlist/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /pilot is private.*waitlist is open/i })).toBeInTheDocument();
    expect(screen.getByText(/receive a shared portfolio can still read its public Introduction and express interest/i)).toBeInTheDocument();
    expect(screen.getByText(/receive 15-day Complete Portfolio access after approval/i)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /privacy assurances/i })).toHaveTextContent(/No public directory/i);
    expect(screen.getByLabelText(/how protected access works/i)).toHaveTextContent(/Shared link.*Verified email.*Your decision/i);
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
    expect(screen.getByRole("link", { name: "Sign in to VivIntro" })).toHaveAttribute("href", "/login");
  });

  it("keeps section navigation available and presents the lifecycle as a guided tour", () => {
    render(<LandingExperience variant="clarity" />);

    expect(screen.getByRole("navigation", { name: "Page sections" })).toHaveTextContent(/Top.*Control.*Tour.*Questions/i);
    expect(screen.getByRole("navigation", { name: "Guided tour steps" })).toHaveTextContent(/Create.*Preview and verify.*Share.*Approve/i);
    expect(screen.getByRole("heading", { name: /four moves from a private draft to approved access/i })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/Complete Portfolio access for 15 days/i);
  });
});
