"use client";

import { useId } from "react";
import { LocationFields, type LocationValue } from "./LocationFields";

export function interestLocationError(errors: Record<string, string>) {
  const keys = ["location", "country", "countryCode", "state", "subdivisionCode", "city", "cityGeonameId", "postalCode", "locationSource"];
  return keys.map(key => errors[key]).find(Boolean);
}

/** Form serialization for the same search-first picker used by portfolio authoring. */
export function StructuredInterestLocation({ prefix = "", label, value, onChange, portfolioToken, error }: {
  prefix?: string; label: string; value: LocationValue;
  onChange: (changes: LocationValue) => void; portfolioToken: string; error?: string;
}) {
  const errorId = useId();
  const fields = { country: value.country, state: value.region, city: value.city, countryCode: value.countryCode,
    subdivisionCode: value.regionCode, cityGeonameId: value.cityGeonameId, postalCode: value.postalCode, locationSource: value.locationSource };
  return <div role="group" tabIndex={error ? -1 : undefined} aria-label={label} data-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="interest-location-group">
    <LocationFields value={value} onChange={onChange} portfolioToken={portfolioToken} requireCompleteHierarchy
      labels={{ country: "Country", region: "State", city: "City", postalCode: "ZIP or PIN code", searchCountry: "Country" }} />
    {Object.entries(fields).map(([key, field]) => <input key={key} type="hidden" name={prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key} value={field ?? ""} />)}
    {error && <p id={errorId} className="interest-form-error" role="alert">{error}</p>}
  </div>;
}

export function locationValue(location?: { country: string; state: string; city: string; countryCode: string; subdivisionCode: string; cityGeonameId?: number; postalCode?: string; locationSource: LocationValue["locationSource"] }): LocationValue {
  return location ? { country: location.country, countryCode: location.countryCode, region: location.state,
    regionCode: location.subdivisionCode, city: location.city, cityGeonameId: location.cityGeonameId,
    postalCode: location.postalCode, locationSource: location.locationSource } : {};
}
