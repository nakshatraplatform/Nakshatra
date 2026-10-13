// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const references = vi.hoisted(() => vi.fn());
vi.mock("@/features/portfolio/client/location-reference.api", () => ({ getLocationReferences: references }));
import { InterestLocationFields } from "../src/components/portfolio/InterestLocationFields";
describe("interest location dropdowns", () => {
  beforeEach(() => {
    references.mockReset().mockImplementation(async (query: URLSearchParams) => query.get("level") === "countries" ? [{ country_code: "US", name: "United States" },{country_code:"IN",name:"India"}] : query.get("level") === "regions" ? [{ region_code: "MA", name: "Massachusetts" }] : [{ geoname_id: 4930956, name: "Boston", region_code: "MA" }]);
  });
  it("uses canonical selections and clears dependent values when country changes", async () => {
    render(<InterestLocationFields prefix="viewer" label="Your location" />);
    await screen.findByRole("option", { name: "United States" });
    fireEvent.change(screen.getByLabelText("Your location country"), { target: { value: "US" } });
    await screen.findByRole("option", { name: "Massachusetts" });
    fireEvent.change(screen.getByLabelText("Your location state"), { target: { value: "MA" } });
    await screen.findByRole("option", { name: "Boston" });
    fireEvent.change(screen.getByLabelText("Your location city"), { target: { value: "4930956" } });
    expect(screen.getByLabelText("Your location city")).toHaveValue("4930956");
    fireEvent.change(screen.getByLabelText("Your location country"), { target: { value: "IN" } });
    expect(screen.getByLabelText("Your location state")).toHaveValue("");
    expect(screen.getByLabelText("Your location city")).toHaveValue("");
    expect(screen.getByLabelText("Your location city")).toBeDisabled();
  });
  it("retains a searched city outside the first results when returning from verification", async () => {
    render(<InterestLocationFields prefix="viewer" label="Your location" initial={{countryCode:"US",regionCode:"MA",cityId:999,cityLabel:"Quincy"}} errors={{"location.cityId":"Choose a city."}} />);
    await screen.findByRole("option", { name: "Boston" });
    expect(screen.getByLabelText("Your location city")).toHaveValue("999");
    expect(screen.getByRole("option", { name: "Quincy" })).toBeInTheDocument();
    expect(screen.getByLabelText("Your location city")).toHaveAttribute("aria-invalid","true");
    expect(screen.getByLabelText("Your location city")).toHaveAccessibleDescription("Choose a city.");
    fireEvent.change(screen.getByRole("searchbox"), {target:{value:"Qui"}});
    await waitFor(() => expect(references).toHaveBeenCalledWith(expect.objectContaining({}), expect.any(AbortSignal)));
    expect(screen.getByLabelText("Your location city")).toHaveValue("");
  });
  it("allows retry when the directory is unavailable", async () => {
    references.mockResolvedValueOnce([]);
    render(<InterestLocationFields prefix="viewer" label="Your location" />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("option", { name: "United States" })).toBeVisible();
  });
});
