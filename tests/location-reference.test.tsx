// @vitest-environment jsdom

import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LocationFields,
  type LocationValue,
} from "../src/components/portfolio/LocationFields";
import { getLocationReferences } from "../src/features/portfolio/client/location-reference.api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("location reference client", () => {
  it("keeps an unmatched country input stable while clearing and retyping its label", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ options: [] }))));
    function Harness() {
      const [location, setLocation] = useState<LocationValue>({ country: "South Africa", region: "Gauteng", city: "Johannesburg" });
      return <LocationFields value={location} onChange={(changes) => setLocation((current) => ({ ...current, ...changes }))} />;
    }
    render(<Harness />);
    const country = screen.getByLabelText("Country");
    country.focus();
    fireEvent.change(country, { target: { value: "" } });
    expect(screen.getByLabelText("Country")).toBe(country);
    expect(country).toHaveFocus();
    expect(screen.getByLabelText("City")).toBeDisabled();
    fireEvent.change(country, { target: { value: "India" } });
    expect(screen.getByLabelText("Country")).toBe(country);
    expect(country).toHaveValue("India");
    expect(country).toHaveFocus();
    expect(screen.getByLabelText("City")).toBeEnabled();
  });
  it("preserves and edits unmatched legacy countries and their labels without inventing identifiers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ options: [] }))));
    const onChange = vi.fn();
    render(<LocationFields value={{ country: "South Africa", region: "Gauteng", city: "Johannesburg" }} onChange={onChange} />);
    expect(screen.getByLabelText("Country")).toHaveValue("South Africa");
    expect(screen.getByLabelText("State or region")).toBeEnabled();
    expect(screen.getByLabelText("City")).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "Mauritius" } });
    expect(onChange).toHaveBeenLastCalledWith({ country: "Mauritius", countryCode: undefined, region: "", regionCode: undefined, city: "", cityGeonameId: undefined });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Pretoria" } });
    expect(onChange).toHaveBeenLastCalledWith({ city: "Pretoria", cityGeonameId: undefined });
    fireEvent.click(screen.getByRole("button", { name: /Choose from the country directory/ }));
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "US" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ country: "United States", countryCode: "US", region: "", city: "" }));
  });
  it("keeps the country parent for a regionless city selected from a legacy label", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({
      options: String(input).includes("level=cities")
        ? [{ geoname_id: 1880252, name: "Singapore", region_code: null }] : [],
    }))));
    const onChange = vi.fn();
    render(<LocationFields value={{ country: "Singapore", city: "Sing" }} onChange={onChange} />);
    await waitFor(() => expect(document.querySelector('datalist option[value="Singapore"]')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Singapore" } });
    expect(onChange).toHaveBeenLastCalledWith({ countryCode: "SG", city: "Singapore", cityGeonameId: 1880252 });
  });
  it("never silently picks the first city when names repeat", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({ options: String(input).includes("level=cities") ? [
      { geoname_id: 101, name: "Springfield", region_code: "MA" },
      { geoname_id: 102, name: "Springfield", region_code: "IL" },
    ] : [] }))));
    const onChange = vi.fn();
    render(<LocationFields value={{ country: "United States", countryCode: "US", city: "Spr" }} onChange={onChange} />);
    await waitFor(() => expect(document.querySelector('datalist option[value="Springfield · MA · 101"]')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Springfield" } });
    expect(onChange).toHaveBeenLastCalledWith({ city: "Springfield", cityGeonameId: undefined });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Springfield · IL · 102" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ city: "Springfield", cityGeonameId: 102, countryCode: "US", regionCode: "IL" }));
  });

  it("clears stale descendants when the country changes and retains unmatched manual regions", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({ options: String(input).includes("level=regions") ? [{ region_code: "MA", name: "Massachusetts" }] : [] }))));
    const onChange = vi.fn();
    render(<LocationFields value={{ country: "United States", countryCode: "US", region: "Legacy region", city: "Boston", cityGeonameId: 4930956 }} onChange={onChange} />);
    await waitFor(() => expect(screen.getByLabelText("State or region")).toHaveValue("__saved_manual__"));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Region not listed/ }));
    expect(screen.getByLabelText("State or region")).toHaveValue("Legacy region");
    fireEvent.change(screen.getByLabelText("State or region"), { target: { value: "My region" } });
    expect(onChange).toHaveBeenLastCalledWith({ region: "My region", regionCode: undefined, city: "", cityGeonameId: undefined });
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "IN" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ countryCode: "IN", region: "", regionCode: undefined, city: "", cityGeonameId: undefined }));
  });
  it("normalizes successful, failed, malformed, and unavailable responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ options: [{ country_code: "US", name: "United States" }] }))
      )
      .mockResolvedValueOnce(new Response("no", { status: 503 }))
      .mockResolvedValueOnce(new Response("{", { status: 200 }))
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    const params = new URLSearchParams({ level: "countries" });
    await expect(getLocationReferences(params)).resolves.toEqual([
      { country_code: "US", name: "United States" },
    ]);
    await expect(getLocationReferences(params)).resolves.toEqual([]);
    await expect(getLocationReferences(params)).resolves.toEqual([]);
    await expect(getLocationReferences(params)).resolves.toEqual([]);
  });

  it("loads dependent options and retains manual entry fallbacks", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("level=countries")) {
        return new Response(
          JSON.stringify({
            options: [
              { country_code: "IN", name: "India" },
              { country_code: "US", name: "United States" },
            ],
          })
        );
      }
      if (url.includes("level=regions")) {
        return new Response(
          JSON.stringify({
            options: [{ region_code: "MA", name: "Massachusetts" }],
          })
        );
      }
      return new Response(
        JSON.stringify({
          options: [
            { geoname_id: 4930956, name: "Boston", region_code: "MA" },
          ],
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    function Harness() {
      const [location, setLocation] = useState<LocationValue>({});
      return (
        <LocationFields
          value={location}
          onChange={(changes) =>
            setLocation((current) => ({ ...current, ...changes }))
          }
        />
      );
    }

    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByLabelText("Country")).toHaveValue("")
    );
    fireEvent.change(screen.getByLabelText("Country"), {
      target: { value: "US" },
    });
    await waitFor(() =>
      expect(screen.getByLabelText("State or region")).toBeInstanceOf(
        HTMLSelectElement
      )
    );
    fireEvent.change(screen.getByLabelText("State or region"), {
      target: { value: "MA" },
    });
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Bo" },
    });
    await waitFor(
      () =>
        expect(
          document.querySelector('datalist option[value="Boston"]')
        ).toBeInTheDocument(),
      { timeout: 1500 }
    );
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Boston" },
    });
    expect(screen.getByLabelText("City")).toHaveValue("Boston");
  });

  it("accepts manual regions when reference data is not populated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ options: [] }), { status: 200 })
      )
    );
    const onChange = vi.fn();
    render(
      <LocationFields
        value={{ country: "United States", countryCode: "US" }}
        onChange={onChange}
      />
    );
    await waitFor(() =>
      expect(screen.getByLabelText("State or region")).toBeInstanceOf(
        HTMLInputElement
      )
    );
    fireEvent.change(screen.getByLabelText("State or region"), {
      target: { value: "Massachusetts" },
    });
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Boston" },
    });
    expect(onChange).toHaveBeenCalledWith({
      region: "Massachusetts",
      regionCode: undefined,
      city: "",
      cityGeonameId: undefined,
    });
    expect(onChange).toHaveBeenCalledWith({
      city: "Boston",
      cityGeonameId: undefined,
    });
  });
});
