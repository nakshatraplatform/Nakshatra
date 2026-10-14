"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LocationSuggestion, StructuredLocation } from "@/features/location/location.contract";
import { isValidPostalCode, locationDisplayValue, normalizePostalCode } from "@/features/location/location.contract";
import { subdivisionsForCountry } from "@/features/location/subdivisions";
import { resolveLocationSuggestion, searchLocationSuggestions } from "@/features/portfolio/client/location-reference.api";

type SupportedCountryCode = "IN" | "US";
const COUNTRIES: ReadonlyArray<{ code: SupportedCountryCode; name: string }> = [
  { code: "IN", name: "India" }, { code: "US", name: "United States" },
];

export interface LocationValue {
  country?: string; countryCode?: string; region?: string; regionCode?: string;
  city?: string; cityGeonameId?: number; postalCode?: string;
  locationSource?: StructuredLocation["locationSource"];
}
type Labels = { country: string; region: string; city: string; postalCode?: string };
const newSessionToken = () => globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000000";

export function hasCompleteLocationHierarchy(value: LocationValue) {
  if (value.countryCode !== "IN" && value.countryCode !== "US") return false;
  const expectedCountry = value.countryCode === "IN" ? "India" : "United States";
  const subdivision = subdivisionsForCountry(value.countryCode)
    .find((item) => item.subdivisionCode === value.regionCode);
  const validPostalCode = isValidPostalCode(value.countryCode, value.postalCode);
  return Boolean(
    value.country?.trim().toLowerCase() === expectedCountry.toLowerCase()
      && subdivision
      && value.region?.trim().toLowerCase() === subdivision.name.toLowerCase()
      && value.city?.trim()
      && validPostalCode
      && value.locationSource
  );
}

export function LocationFields({ value, onChange, labels = { country: "Country", region: "State", city: "City", postalCode: "ZIP or PIN code" }, requireCountryAndCity = false, requireCompleteHierarchy = false, portfolioToken }: {
  value: LocationValue; onChange: (changes: LocationValue) => void; labels?: Labels;
  requireCountryAndCity?: boolean; requireCompleteHierarchy?: boolean; portfolioToken?: string;
}) {
  const locationRequired = requireCountryAndCity || requireCompleteHierarchy;
  const initialCountry = value.countryCode === "US" ? "US" : "IN";
  const [countryCode, setCountryCode] = useState<SupportedCountryCode>(initialCountry);
  const [mode, setMode] = useState<"search" | "manual" | "confirmed">(
    requireCompleteHierarchy
      ? hasCompleteLocationHierarchy(value) ? "confirmed" : "search"
      : value.country && value.city ? "confirmed" : "search"
  );
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");
  const sessionToken = useRef(newSessionToken());
  const operationId = useRef(0);
  const listboxId = useMemo(() => `location-options-${newSessionToken()}`, []);
  const subdivisions = subdivisionsForCountry(countryCode);

  useEffect(() => {
    if (mode !== "search" || query.trim().length < 2) return;
    const requestId = ++operationId.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsSearching(true); setMessage("");
      void searchLocationSuggestions({ query: query.trim(), countryCode, sessionToken: sessionToken.current, portfolioToken }, controller.signal).then((options) => {
        if (controller.signal.aborted || requestId !== operationId.current) return;
        setSuggestions(options); setIsSearching(false);
        if (!options.length) setMessage("No match found. Try another spelling or enter the location manually.");
      });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [countryCode, mode, portfolioToken, query]);

  function chooseCountry(nextCode: SupportedCountryCode) {
    operationId.current += 1; setCountryCode(nextCode); setQuery(""); setSuggestions([]); sessionToken.current = newSessionToken();
    onChange({ country: COUNTRIES.find((item) => item.code === nextCode)?.name, countryCode: nextCode, region: "", regionCode: undefined, city: "", cityGeonameId: undefined, postalCode: "", locationSource: undefined });
  }
  function beginSearch() {
    operationId.current += 1;
    const nextCountryCode = value.countryCode === "US" ? "US" : value.countryCode === "IN" ? "IN" : countryCode;
    setCountryCode(nextCountryCode);
    setMode("search"); setQuery(""); setSuggestions([]); setIsSearching(false); setMessage("");
    sessionToken.current = newSessionToken();
    onChange({
      country: COUNTRIES.find((item) => item.code === nextCountryCode)?.name,
      countryCode: nextCountryCode,
      region: "",
      regionCode: undefined,
      city: "",
      cityGeonameId: undefined,
      postalCode: "",
      locationSource: undefined,
    });
  }
  function applyLocation(location: LocationValue) {
    operationId.current += 1;
    onChange(location);
    setMode(requireCompleteHierarchy && !hasCompleteLocationHierarchy(location) ? "manual" : "confirmed");
    setMessage(requireCompleteHierarchy && !hasCompleteLocationHierarchy(location) ? "Complete the missing state or ZIP/PIN code." : "");
    setQuery(""); setSuggestions([]); sessionToken.current = newSessionToken();
  }
  async function selectSuggestion(suggestion: LocationSuggestion) {
    setMessage("");
    if (suggestion.provider === "google_places" && suggestion.requiresResolution) {
      const requestId = ++operationId.current;
      setSuggestions([]); setIsSearching(true);
      const resolved = await resolveLocationSuggestion({ placeId: suggestion.id, sessionToken: sessionToken.current, portfolioToken });
      if (requestId !== operationId.current) return;
      setIsSearching(false);
      if (!resolved) { setMessage("We could not confirm that location. Enter it manually instead."); return; }
      applyLocation({ country: resolved.country, countryCode: resolved.countryCode, region: resolved.state, regionCode: resolved.subdivisionCode, city: resolved.city, cityGeonameId: resolved.cityGeonameId, postalCode: resolved.postalCode, locationSource: resolved.locationSource });
      return;
    }
    applyLocation({ country: suggestion.country, countryCode: suggestion.countryCode, region: suggestion.state, regionCode: suggestion.subdivisionCode, city: suggestion.city, cityGeonameId: suggestion.cityGeonameId, postalCode: suggestion.postalCode, locationSource: suggestion.locationSource });
  }
  function beginManualEntry() {
    operationId.current += 1;
    if (!value.countryCode || !["IN", "US"].includes(value.countryCode)) chooseCountry(countryCode);
    setMode("manual"); setSuggestions([]); setMessage("");
  }

  if (mode === "confirmed") return (
    <div className="rounded-2xl border border-[color:var(--workspace-line)] bg-white/70 p-4">
      <div className="flex items-start justify-between gap-4"><div>
        <p className="text-sm font-semibold text-[color:var(--workspace-ink)]">Selected location</p>
        <p className="mt-1 text-sm text-[color:var(--workspace-muted)]">{locationDisplayValue({ country: value.country, state: value.region, city: value.city, postalCode: value.postalCode }) || "No location selected"}{value.postalCode ? ` · ${value.postalCode}` : ""}</p>
      </div><button type="button" className="text-sm font-semibold text-[color:var(--workspace-teal)]" onClick={beginSearch}>Change</button></div>
    </div>
  );

  if (mode === "manual") return (
    <div className="grid gap-4 sm:grid-cols-2">
      {message ? <p className="text-sm text-[color:var(--workspace-muted)] sm:col-span-2" role="status">{message}</p> : null}
      <label className="flex flex-col gap-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><span>{labels.country}{locationRequired ? " *" : ""}</span><select aria-label={labels.country} autoComplete="country" required={locationRequired} value={value.countryCode || countryCode} onChange={(event) => chooseCountry(event.target.value as SupportedCountryCode)} className="biodata-field min-h-12">{COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><span>{labels.region}{requireCompleteHierarchy ? " *" : ""}</span><select aria-label={labels.region} autoComplete="address-level1" required={requireCompleteHierarchy} value={value.regionCode || ""} onChange={(event) => { const subdivision = subdivisions.find((item) => item.subdivisionCode === event.target.value); onChange({ region: subdivision?.name || "", regionCode: subdivision?.subdivisionCode, city: "", cityGeonameId: undefined, postalCode: "", locationSource: "manual" }); }} className="biodata-field min-h-12"><option value="">Select state</option>{subdivisions.map((item) => <option key={item.subdivisionCode} value={item.subdivisionCode}>{item.name}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><span>{labels.city}{locationRequired ? " *" : ""}</span><input aria-label={labels.city} autoComplete="address-level2" required={locationRequired} maxLength={120} value={value.city || ""} onChange={(event) => onChange({ city: event.target.value, cityGeonameId: undefined, locationSource: "manual" })} className="biodata-field min-h-12" /></label>
      <label className="flex flex-col gap-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><span>{labels.postalCode ?? "ZIP or PIN code"}{requireCompleteHierarchy ? " *" : ""}</span><input aria-label={labels.postalCode ?? "ZIP or PIN code"} autoComplete="postal-code" inputMode="numeric" required={requireCompleteHierarchy} pattern={countryCode === "IN" ? "[1-9][0-9]{5}" : "[0-9]{5}"} title={countryCode === "IN" ? "Enter a six-digit Indian PIN code." : "Enter a five-digit US ZIP code. ZIP+4 input is stored as its first five digits."} maxLength={countryCode === "IN" ? 6 : 10} value={value.postalCode || ""} onChange={(event) => onChange({ postalCode: normalizePostalCode(event.target.value), locationSource: "manual" })} className="biodata-field min-h-12" /></label>
      <div className="flex gap-4 sm:col-span-2"><button type="button" className="text-sm font-semibold text-[color:var(--workspace-teal)]" onClick={beginSearch}>Use search instead</button>{(requireCompleteHierarchy ? hasCompleteLocationHierarchy(value) : value.country && value.city) ? <button type="button" className="text-sm font-semibold text-[color:var(--workspace-ink)]" onClick={() => setMode("confirmed")}>Done</button> : null}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <label className="flex flex-col gap-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><span>Search country</span><select aria-label="Search country" value={countryCode} onChange={(event) => chooseCountry(event.target.value as SupportedCountryCode)} className="biodata-field min-h-12">{COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
        <label className="relative flex flex-col gap-2 text-[15px] font-semibold text-[color:var(--workspace-ink)]"><span>ZIP or PIN code{locationRequired ? " *" : ""}</span><input aria-label="ZIP or PIN code" role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0} aria-controls={listboxId} required={locationRequired} value={query} onChange={(event) => { operationId.current += 1; setQuery(event.target.value); setSuggestions([]); setIsSearching(false); setMessage(""); }} placeholder={countryCode === "IN" ? "Try 560001" : "Try 02108"} className="biodata-field min-h-12" />
          {suggestions.length > 0 ? <ul id={listboxId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-[color:var(--workspace-line)] bg-white p-1 shadow-lg">{suggestions.map((suggestion) => <li key={suggestion.id} role="option" aria-selected="false"><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-[color:var(--workspace-soft)]" onClick={() => void selectSuggestion(suggestion)}>{suggestion.label}</button></li>)}{suggestions.some((suggestion) => suggestion.provider === "zippopotam") ? <li role="presentation" className="px-3 py-1 text-right text-xs text-[color:var(--workspace-muted)]">ZIP data by Zippopotam.us</li> : null}{suggestions.some((suggestion) => suggestion.provider === "google_places") ? <li role="presentation" className="px-3 py-1 text-right text-xs text-[color:var(--workspace-muted)]">Powered by Google</li> : null}</ul> : null}
        </label>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-[color:var(--workspace-muted)]">{isSearching ? "Searching locations…" : message}</p>
      {requireCompleteHierarchy ? <p className="text-sm text-[color:var(--workspace-muted)]">Enter a ZIP/PIN to fill country, state, and city, or enter the location manually.</p> : null}
      <button type="button" className="text-sm font-semibold text-[color:var(--workspace-teal)]" onClick={beginManualEntry}>Enter location manually</button>
    </div>
  );
}
