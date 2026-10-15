// @vitest-environment jsdom
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const search = vi.hoisted(() => vi.fn());
vi.mock("@/features/portfolio/client/location-reference.api", () => ({ searchLocationSuggestions: search, resolveLocationSuggestion: vi.fn() }));
import { StructuredInterestLocation } from "../src/components/portfolio/StructuredInterestLocation";
import type { LocationValue } from "../src/components/portfolio/LocationFields";

const location = { country: "United States", countryCode: "US", region: "Massachusetts", regionCode: "US-MA", city: "Boston", postalCode: "02108", locationSource: "zippopotam" as const };
function Harness({ initial = {}, error }: { initial?: LocationValue; error?: string }) {
  const [value, setValue] = useState<LocationValue>(initial);
  return <form aria-label="Location form"><StructuredInterestLocation prefix="candidate" label="Candidate’s location" value={value} onChange={changes => setValue(current => ({ ...current, ...changes }))} portfolioToken="portfolio-token" error={error} /></form>;
}
const formData = () => new FormData(screen.getByRole("form", { name: "Location form" }) as HTMLFormElement);

describe("structured interest location", () => {
  beforeEach(() => {
    search.mockReset().mockResolvedValue([{ id: "zip-boston", provider: "zippopotam", label: "Boston, Massachusetts 02108", country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston", postalCode: "02108", locationSource: "zippopotam" }]);
  });
  it("uses the portfolio ZIP API and serializes canonical candidate fields", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Candidate’s location search country"), { target: { value: "US" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Candidate’s location ZIP or PIN code" }), { target: { value: "02108" } });
    fireEvent.click(await screen.findByRole("option", { name: "Boston, Massachusetts 02108" }));
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: "02108", countryCode: "US", portfolioToken: "portfolio-token" }), expect.any(AbortSignal));
    expect(formData().get("candidateSubdivisionCode")).toBe("US-MA");
    expect(formData().get("candidatePostalCode")).toBe("02108");
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(formData().get("candidateCity")).toBe("");
    expect(formData().get("candidatePostalCode")).toBe("");
  });
  it("restores a selected location and exposes an accessible group error", () => {
    render(<Harness initial={location} error="Choose a complete location, or remove it." />);
    expect(screen.getByText(/Boston, Massachusetts, United States/)).toBeInTheDocument();
    expect(formData().get("candidateCity")).toBe("Boston");
    expect(screen.getByRole("group", { name: "Candidate’s location" })).toHaveAccessibleDescription("Choose a complete location, or remove it.");
  });
  it("preserves manual fallback after provider failure and clears child geography", async () => {
    search.mockResolvedValue([]);
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox", { name: "Candidate’s location ZIP or PIN code" }), { target: { value: "560001" } });
    expect(await screen.findByText(/No match found/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter location manually" }));
    fireEvent.change(screen.getByLabelText("Candidate’s location state"), { target: { value: "IN-KA" } });
    fireEvent.change(screen.getByLabelText("Candidate’s location city"), { target: { value: "Bangalore" } });
    fireEvent.change(screen.getByLabelText("Candidate’s location ZIP or PIN code"), { target: { value: "560001" } });
    expect(formData().get("candidateLocationSource")).toBe("manual");
    fireEvent.change(screen.getByLabelText("Candidate’s location country"), { target: { value: "US" } });
    expect(formData().get("candidateSubdivisionCode")).toBe("");
    expect(formData().get("candidateCity")).toBe("");
    expect(formData().get("candidatePostalCode")).toBe("");
  });
});
