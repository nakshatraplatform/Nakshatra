// @vitest-environment jsdom

import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasCompleteLocationHierarchy, LocationFields, type LocationValue } from "../src/components/portfolio/LocationFields";
import { getLocationReferences, resolveLocationSuggestion, searchLocationSuggestions } from "../src/features/portfolio/client/location-reference.api";

afterEach(() => vi.unstubAllGlobals());

describe("location reference client", () => {
  it("opens location privacy help separately so unsaved editor answers remain intact", () => {
    render(<LocationFields value={{}} onChange={() => {}} />);
    const help = screen.getByRole("link", { name: "Location search privacy (opens in a new tab)" });
    expect(help).toHaveAttribute("href", "/privacy#location-search");
    expect(help).toHaveAttribute("target", "_blank");
    expect(help).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("normalizes legacy and structured API responses without throwing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ options: [{ country_code: "US", name: "United States" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ options: [{ id: "postal:1", label: "Boston", provider: "postalpincode" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ location: { country: "United States", countryCode: "US", city: "Boston" } })))
      .mockResolvedValueOnce(new Response("no", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLocationReferences(new URLSearchParams({ level: "countries" }))).resolves.toHaveLength(1);
    await expect(searchLocationSuggestions({ query: "Boston", countryCode: "US", sessionToken: crypto.randomUUID() })).resolves.toHaveLength(1);
    await expect(resolveLocationSuggestion({ placeId: "place_123", sessionToken: crypto.randomUUID() })).resolves.toMatchObject({ city: "Boston" });
    await expect(searchLocationSuggestions({ query: "offline", countryCode: "US", sessionToken: crypto.randomUUID() })).resolves.toEqual([]);
  });

  it("returns empty values for malformed successful location responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("not json", { status: 200 }))
      .mockResolvedValueOnce(new Response("not json", { status: 200 }))
      .mockResolvedValueOnce(new Response("not json", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLocationReferences(new URLSearchParams({ level: "countries" }))).resolves.toEqual([]);
    await expect(searchLocationSuggestions({
      query: "Boston",
      countryCode: "US",
      sessionToken: crypto.randomUUID(),
    })).resolves.toEqual([]);
    await expect(resolveLocationSuggestion({
      placeId: "place_123",
      sessionToken: crypto.randomUUID(),
    })).resolves.toBeNull();
  });

  it("searches by PIN and applies a normalized suggestion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ options: [{
      id: "postalpincode:560001:0", label: "Bengaluru GPO, Bengaluru, Karnataka 560001",
      provider: "postalpincode", country: "India", countryCode: "IN", state: "Karnataka",
      subdivisionCode: "IN-KA", city: "Bengaluru", postalCode: "560001", locationSource: "postalpincode",
    }] }))));
    function Harness() {
      const [location, setLocation] = useState<LocationValue>({});
      return <LocationFields value={location} onChange={(changes) => setLocation((current) => ({ ...current, ...changes }))} />;
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("ZIP or PIN code"), { target: { value: "560001" } });
    const result = await screen.findByRole("option", { name: /Bengaluru GPO/ }, { timeout: 1500 });
    const search = screen.getByRole("combobox", { name: "ZIP or PIN code" });
    fireEvent.focus(search);
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(search).toHaveAttribute("aria-activedescendant", result.id);
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(search, { key: "ArrowUp" });
    expect(search).toHaveAttribute("aria-activedescendant", result.id);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.getByText(/Bengaluru, Karnataka, India/)).toBeInTheDocument();
    expect(screen.getByText(/560001/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toHaveFocus();
  });

  it("applies a Zippopotam ZIP suggestion without an additional resolution request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ options: [{
      id: "zippopotam:02108:0", label: "Boston, Massachusetts 02108",
      provider: "zippopotam", country: "United States", countryCode: "US",
      state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston",
      postalCode: "02108", locationSource: "zippopotam",
    }] })));
    vi.stubGlobal("fetch", fetchMock);
    function Harness() {
      const [location, setLocation] = useState<LocationValue>({ country: "United States", countryCode: "US" });
      return <LocationFields value={location} onChange={(changes) => setLocation((current) => ({ ...current, ...changes }))} requireCompleteHierarchy />;
    }

    render(<Harness />);
    fireEvent.change(screen.getByLabelText("ZIP or PIN code"), { target: { value: "02108" } });
    expect(await screen.findByText("ZIP data by Zippopotam.us", {}, { timeout: 1500 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Boston, Massachusetts 02108" }));

    expect(screen.getByText(/Boston, Massachusetts, United States/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("supports manual ISO subdivision entry when lookup is unavailable", async () => {
    const onChange = vi.fn();
    render(<LocationFields value={{ country: "United States", countryCode: "US" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter location manually" }));
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "US-MA" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Boston" } });
    expect(onChange).toHaveBeenCalledWith({ region: "Massachusetts", regionCode: "US-MA", city: "", cityGeonameId: undefined, postalCode: "", locationSource: "manual" });
    expect(onChange).toHaveBeenCalledWith({ city: "Boston", cityGeonameId: undefined, locationSource: "manual" });
  });

  it("invalidates a confirmed hierarchy before searching for a replacement", () => {
    function Harness() {
      const [location, setLocation] = useState<LocationValue>({
        country: "United States", countryCode: "US", region: "Massachusetts", regionCode: "US-MA",
        city: "Boston", postalCode: "02108", locationSource: "manual",
      });
      return <>
        <LocationFields value={location} onChange={(changes) => setLocation((current) => ({ ...current, ...changes }))} requireCompleteHierarchy />
        <output data-testid="hierarchy-complete">{String(hasCompleteLocationHierarchy(location))}</output>
      </>;
    }

    render(<Harness />);
    expect(screen.getByTestId("hierarchy-complete")).toHaveTextContent("true");
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByTestId("hierarchy-complete")).toHaveTextContent("false");
    expect(screen.getByLabelText("ZIP or PIN code")).toHaveValue("");
  });

  it("clears city, GeoNames identity, and postal code when state changes", () => {
    const onChange = vi.fn();
    render(<LocationFields value={{
      country: "United States", countryCode: "US", region: "Massachusetts", regionCode: "US-MA",
      city: "Boston", cityGeonameId: 4930956, postalCode: "02108",
    }} onChange={onChange} requireCompleteHierarchy />);

    fireEvent.click(screen.getByRole("button", { name: "Enter location manually" }));
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "US-CA" } });
    expect(onChange).toHaveBeenCalledWith({
      region: "California", regionCode: "US-CA", city: "", cityGeonameId: undefined,
      postalCode: "", locationSource: "manual",
    });
  });

  it("requires the full hierarchy and validates India postal codes when requested", () => {
    render(<LocationFields value={{ country: "India", countryCode: "IN" }} onChange={vi.fn()} requireCompleteHierarchy />);
    expect(screen.getByLabelText("ZIP or PIN code")).toBeRequired();

    fireEvent.click(screen.getByRole("button", { name: "Enter location manually" }));
    expect(screen.getByLabelText("State")).toBeRequired();
    expect(screen.getByLabelText("City")).toBeRequired();
    expect(screen.getByLabelText("ZIP or PIN code")).toBeRequired();
    expect(screen.getByLabelText("ZIP or PIN code")).toHaveAttribute("pattern", "[1-9][0-9]{5}");
  });

  it("ignores an older autocomplete response that resolves after a newer query", async () => {
    let resolveFirst: (response: Response) => void = () => undefined;
    let resolveSecond: (response: Response) => void = () => undefined;
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    vi.stubGlobal("fetch", fetchMock);
    render(<LocationFields value={{}} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("ZIP or PIN code"), { target: { value: "Bo" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 1500 });
    fireEvent.change(screen.getByLabelText("ZIP or PIN code"), { target: { value: "Bos" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 1500 });
    await act(async () => resolveSecond(new Response(JSON.stringify({ options: [{ id: "new", label: "Boston, MA", provider: "google_places", requiresResolution: true }] }))));
    expect(await screen.findByRole("option", { name: "Boston, MA" })).toBeInTheDocument();
    await act(async () => resolveFirst(new Response(JSON.stringify({ options: [{ id: "old", label: "Bogota", provider: "google_places", requiresResolution: true }] }))));
    expect(screen.queryByRole("option", { name: "Bogota" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Boston, MA" })).toBeInTheDocument();
  });
});
