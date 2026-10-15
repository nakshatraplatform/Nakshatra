import type { StyleData } from "@/types/portfolio";

export type CelestialAppearance = "light" | "dark";

export const CELESTIAL_THEME_COLORS = {
  light: {
    background: "#f7f5ef",
    surface: "#fffdf9",
    surfaceSoft: "#e9e2d5",
    ink: "#1c2936",
    muted: "#59636e",
    primary: "#1c2936",
    teal: "#1c2936",
    gold: "#80551c",
    border: "#d5d0c5",
  },
  dark: {
    background: "#121a21",
    surface: "#1b252e",
    surfaceSoft: "#24333d",
    ink: "#f4f1e9",
    muted: "#c0c8ce",
    primary: "#f4f1e9",
    teal: "#f4f1e9",
    gold: "#dfb777",
    border: "#46525d",
  },
} as const;

/** Keeps old saved profiles compatible while making Light the calm default. */
export function getCelestialAppearance(style?: StyleData): CelestialAppearance {
  return style?.appearance === "dark" ? "dark" : "light";
}

export function getCelestialBackground(style?: StyleData) {
  return CELESTIAL_THEME_COLORS[getCelestialAppearance(style)].background;
}
