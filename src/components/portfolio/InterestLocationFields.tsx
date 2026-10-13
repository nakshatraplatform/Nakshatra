"use client";

import { useEffect, useState } from "react";
import { getLocationReferences, type CountryReference, type RegionReference, type CityReference } from "@/features/portfolio/client/location-reference.api";
import type { z } from "zod/v4";
import type { interestLocationSchema } from "@/features/interest/server/interest.contract";
import { InterestField } from "./InterestField";

export type InterestLocationDraft = z.infer<typeof interestLocationSchema> & { cityLabel?: string };
/** Uses the same directory as portfolio authoring, with explicit selected IDs. */
export function InterestLocationFields({ prefix, label, initial, errors = {} }: { prefix: string; label: string; initial?: InterestLocationDraft; errors?: Record<string, string> }) {
  const errorPrefix = prefix === "candidate" ? "candidate.location" : "location";
  const [country, setCountry] = useState(initial?.countryCode || "");
  const [region, setRegion] = useState(initial?.regionCode || "");
  const [countries, setCountries] = useState<CountryReference[]>([]);
  const [regions, setRegions] = useState<RegionReference[]>([]);
  const [cities, setCities] = useState<CityReference[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(String(initial?.cityId || ""));
  const [cityLabel, setCityLabel] = useState(initial?.cityLabel || "Selected city");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getLocationReferences<CountryReference>(new URLSearchParams({ level: "countries" }), controller.signal).then(options => {
      if (!controller.signal.aborted) { setCountries(options); setFailed(!options.length); }
    });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!country) return;
    const controller = new AbortController();
    void getLocationReferences<RegionReference>(new URLSearchParams({ level: "regions", country }), controller.signal).then(options => {
      if (!controller.signal.aborted) { setRegions(options); setFailed(!options.length); }
    });
    return () => controller.abort();
  }, [country, retry]);
  useEffect(() => {
    if (!country || !region) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getLocationReferences<CityReference>(new URLSearchParams({ level: "cities", country, region, q: search }), controller.signal).then(options => {
        if (!controller.signal.aborted) { setCities(options); setLoading(false); }
      });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [country, region, search, retry]);
  return <fieldset className="interest-location-fieldset"><legend>{label}</legend>
    <div className="interest-location-grid">
      <InterestField label="Country *" error={errors[`${errorPrefix}.countryCode`]}>{attributes => <select {...attributes} aria-label={`${label} country`} name={`${prefix}CountryCode`} required value={country} onChange={event => { setCountry(event.target.value); setRegion(""); setRegions([]); setCities([]); setCity(""); setCityLabel(""); setSearch(""); setFailed(false); }}><option value="">Choose country</option>{countries.map(option => <option key={option.country_code} value={option.country_code}>{option.name}</option>)}</select>}</InterestField>
      <InterestField label="State or province *" error={errors[`${errorPrefix}.regionCode`]}>{attributes => <select {...attributes} aria-label={`${label} state`} name={`${prefix}RegionCode`} required disabled={!country} value={region} onChange={event => { setRegion(event.target.value); setCities([]); setCity(""); setCityLabel(""); setSearch(""); setFailed(false); }}><option value="">Choose state</option>{regions.map(option => <option key={option.region_code} value={option.region_code}>{option.name}</option>)}</select>}</InterestField>
      <InterestField label="City *" error={errors[`${errorPrefix}.cityId`]}>{attributes => <select {...attributes} aria-label={`${label} city`} name={`${prefix}CityId`} required disabled={!region || loading} value={city} onChange={event => { setCity(event.target.value); setCityLabel(event.target.selectedOptions[0]?.textContent || ""); }}><option value="">{loading ? "Loading cities…" : "Choose city"}</option>{city && !cities.some(option => String(option.geoname_id) === city) && <option value={city}>{cityLabel}</option>}{cities.map(option => <option key={option.geoname_id} value={option.geoname_id}>{option.name}</option>)}</select>}</InterestField>
    </div>
    <input type="hidden" name={`${prefix}CityLabel`} value={cityLabel} />
    {region && <label className="interest-field"><span>Find your city</span><input type="search" autoComplete="off" value={search} maxLength={80} placeholder="Search the city directory…" onChange={event => { setSearch(event.target.value); setCity(""); setCityLabel(""); }} /><small>Search if your city is not among the first results.</small></label>}
    {failed && <p role="status">The location directory is unavailable or has no states for this country. <button type="button" className="interest-secondary-action" onClick={() => setRetry(value => value + 1)}>Try again</button></p>}
    {region && !loading && !cities.length && <p role="status">No matching cities. Try another spelling.</p>}
  </fieldset>;
}
