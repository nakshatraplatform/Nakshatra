import type { StructuredLocation } from "./location.contract";

export type SupportedSubdivision = {
  countryCode: "IN" | "US";
  subdivisionCode: string;
  name: string;
  aliases?: readonly string[];
};

export const SUPPORTED_SUBDIVISIONS: readonly SupportedSubdivision[] = [
  { countryCode: "IN", subdivisionCode: "IN-AN", name: "Andaman and Nicobar Islands" },
  { countryCode: "IN", subdivisionCode: "IN-AP", name: "Andhra Pradesh" },
  { countryCode: "IN", subdivisionCode: "IN-AR", name: "Arunachal Pradesh" },
  { countryCode: "IN", subdivisionCode: "IN-AS", name: "Assam" },
  { countryCode: "IN", subdivisionCode: "IN-BR", name: "Bihar" },
  { countryCode: "IN", subdivisionCode: "IN-CH", name: "Chandigarh" },
  { countryCode: "IN", subdivisionCode: "IN-CT", name: "Chhattisgarh", aliases: ["Chattisgarh"] },
  { countryCode: "IN", subdivisionCode: "IN-DH", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { countryCode: "IN", subdivisionCode: "IN-DL", name: "Delhi", aliases: ["NCT of Delhi", "National Capital Territory of Delhi"] },
  { countryCode: "IN", subdivisionCode: "IN-GA", name: "Goa" },
  { countryCode: "IN", subdivisionCode: "IN-GJ", name: "Gujarat" },
  { countryCode: "IN", subdivisionCode: "IN-HR", name: "Haryana" },
  { countryCode: "IN", subdivisionCode: "IN-HP", name: "Himachal Pradesh" },
  { countryCode: "IN", subdivisionCode: "IN-JK", name: "Jammu and Kashmir" },
  { countryCode: "IN", subdivisionCode: "IN-JH", name: "Jharkhand" },
  { countryCode: "IN", subdivisionCode: "IN-KA", name: "Karnataka" },
  { countryCode: "IN", subdivisionCode: "IN-KL", name: "Kerala" },
  { countryCode: "IN", subdivisionCode: "IN-LA", name: "Ladakh" },
  { countryCode: "IN", subdivisionCode: "IN-LD", name: "Lakshadweep" },
  { countryCode: "IN", subdivisionCode: "IN-MP", name: "Madhya Pradesh" },
  { countryCode: "IN", subdivisionCode: "IN-MH", name: "Maharashtra" },
  { countryCode: "IN", subdivisionCode: "IN-MN", name: "Manipur" },
  { countryCode: "IN", subdivisionCode: "IN-ML", name: "Meghalaya" },
  { countryCode: "IN", subdivisionCode: "IN-MZ", name: "Mizoram" },
  { countryCode: "IN", subdivisionCode: "IN-NL", name: "Nagaland" },
  { countryCode: "IN", subdivisionCode: "IN-OD", name: "Odisha", aliases: ["Orissa"] },
  { countryCode: "IN", subdivisionCode: "IN-PY", name: "Puducherry", aliases: ["Pondicherry"] },
  { countryCode: "IN", subdivisionCode: "IN-PB", name: "Punjab" },
  { countryCode: "IN", subdivisionCode: "IN-RJ", name: "Rajasthan" },
  { countryCode: "IN", subdivisionCode: "IN-SK", name: "Sikkim" },
  { countryCode: "IN", subdivisionCode: "IN-TN", name: "Tamil Nadu" },
  { countryCode: "IN", subdivisionCode: "IN-TG", name: "Telangana" },
  { countryCode: "IN", subdivisionCode: "IN-TR", name: "Tripura" },
  { countryCode: "IN", subdivisionCode: "IN-UP", name: "Uttar Pradesh" },
  { countryCode: "IN", subdivisionCode: "IN-UT", name: "Uttarakhand", aliases: ["Uttaranchal"] },
  { countryCode: "IN", subdivisionCode: "IN-WB", name: "West Bengal" },
  { countryCode: "US", subdivisionCode: "US-AL", name: "Alabama" },
  { countryCode: "US", subdivisionCode: "US-AK", name: "Alaska" },
  { countryCode: "US", subdivisionCode: "US-AZ", name: "Arizona" },
  { countryCode: "US", subdivisionCode: "US-AR", name: "Arkansas" },
  { countryCode: "US", subdivisionCode: "US-CA", name: "California" },
  { countryCode: "US", subdivisionCode: "US-CO", name: "Colorado" },
  { countryCode: "US", subdivisionCode: "US-CT", name: "Connecticut" },
  { countryCode: "US", subdivisionCode: "US-DE", name: "Delaware" },
  { countryCode: "US", subdivisionCode: "US-DC", name: "District of Columbia", aliases: ["Washington DC", "Washington, D.C."] },
  { countryCode: "US", subdivisionCode: "US-FL", name: "Florida" },
  { countryCode: "US", subdivisionCode: "US-GA", name: "Georgia" },
  { countryCode: "US", subdivisionCode: "US-HI", name: "Hawaii" },
  { countryCode: "US", subdivisionCode: "US-ID", name: "Idaho" },
  { countryCode: "US", subdivisionCode: "US-IL", name: "Illinois" },
  { countryCode: "US", subdivisionCode: "US-IN", name: "Indiana" },
  { countryCode: "US", subdivisionCode: "US-IA", name: "Iowa" },
  { countryCode: "US", subdivisionCode: "US-KS", name: "Kansas" },
  { countryCode: "US", subdivisionCode: "US-KY", name: "Kentucky" },
  { countryCode: "US", subdivisionCode: "US-LA", name: "Louisiana" },
  { countryCode: "US", subdivisionCode: "US-ME", name: "Maine" },
  { countryCode: "US", subdivisionCode: "US-MD", name: "Maryland" },
  { countryCode: "US", subdivisionCode: "US-MA", name: "Massachusetts" },
  { countryCode: "US", subdivisionCode: "US-MI", name: "Michigan" },
  { countryCode: "US", subdivisionCode: "US-MN", name: "Minnesota" },
  { countryCode: "US", subdivisionCode: "US-MS", name: "Mississippi" },
  { countryCode: "US", subdivisionCode: "US-MO", name: "Missouri" },
  { countryCode: "US", subdivisionCode: "US-MT", name: "Montana" },
  { countryCode: "US", subdivisionCode: "US-NE", name: "Nebraska" },
  { countryCode: "US", subdivisionCode: "US-NV", name: "Nevada" },
  { countryCode: "US", subdivisionCode: "US-NH", name: "New Hampshire" },
  { countryCode: "US", subdivisionCode: "US-NJ", name: "New Jersey" },
  { countryCode: "US", subdivisionCode: "US-NM", name: "New Mexico" },
  { countryCode: "US", subdivisionCode: "US-NY", name: "New York" },
  { countryCode: "US", subdivisionCode: "US-NC", name: "North Carolina" },
  { countryCode: "US", subdivisionCode: "US-ND", name: "North Dakota" },
  { countryCode: "US", subdivisionCode: "US-OH", name: "Ohio" },
  { countryCode: "US", subdivisionCode: "US-OK", name: "Oklahoma" },
  { countryCode: "US", subdivisionCode: "US-OR", name: "Oregon" },
  { countryCode: "US", subdivisionCode: "US-PA", name: "Pennsylvania" },
  { countryCode: "US", subdivisionCode: "US-RI", name: "Rhode Island" },
  { countryCode: "US", subdivisionCode: "US-SC", name: "South Carolina" },
  { countryCode: "US", subdivisionCode: "US-SD", name: "South Dakota" },
  { countryCode: "US", subdivisionCode: "US-TN", name: "Tennessee" },
  { countryCode: "US", subdivisionCode: "US-TX", name: "Texas" },
  { countryCode: "US", subdivisionCode: "US-UT", name: "Utah" },
  { countryCode: "US", subdivisionCode: "US-VT", name: "Vermont" },
  { countryCode: "US", subdivisionCode: "US-VA", name: "Virginia" },
  { countryCode: "US", subdivisionCode: "US-WA", name: "Washington" },
  { countryCode: "US", subdivisionCode: "US-WV", name: "West Virginia" },
  { countryCode: "US", subdivisionCode: "US-WI", name: "Wisconsin" },
  { countryCode: "US", subdivisionCode: "US-WY", name: "Wyoming" },
  { countryCode: "US", subdivisionCode: "US-AS", name: "American Samoa" },
  { countryCode: "US", subdivisionCode: "US-GU", name: "Guam" },
  { countryCode: "US", subdivisionCode: "US-MP", name: "Northern Mariana Islands" },
  { countryCode: "US", subdivisionCode: "US-PR", name: "Puerto Rico" },
  { countryCode: "US", subdivisionCode: "US-UM", name: "United States Minor Outlying Islands" },
  { countryCode: "US", subdivisionCode: "US-VI", name: "United States Virgin Islands", aliases: ["Virgin Islands, U.S.", "U.S. Virgin Islands"] },
] as const;

function normalizedName(value: string) {
  return value.normalize("NFKD").replace(/[.']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function findSubdivision(
  countryCode: StructuredLocation["countryCode"],
  value: string | undefined
) {
  if (!countryCode || !value) return undefined;
  const candidate = value.trim().toUpperCase();
  const fullCode = candidate.startsWith(`${countryCode}-`)
    ? candidate
    : `${countryCode}-${candidate}`;
  const byCode = SUPPORTED_SUBDIVISIONS.find(
    (item) => item.countryCode === countryCode && item.subdivisionCode === fullCode
  );
  if (byCode) return byCode;
  const name = normalizedName(value);
  return SUPPORTED_SUBDIVISIONS.find(
    (item) => item.countryCode === countryCode &&
      [item.name, ...(item.aliases ?? [])].some((label) => normalizedName(label) === name)
  );
}

export function subdivisionsForCountry(countryCode: "IN" | "US") {
  return SUPPORTED_SUBDIVISIONS.filter((item) => item.countryCode === countryCode);
}
