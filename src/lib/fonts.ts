import { Inter, Plus_Jakarta_Sans } from "next/font/google";

// Both variable families are self-hosted by Next; no browser Google Fonts calls.
export const portfolioBody = Inter({
  variable: "--font-portfolio-body",
  subsets: ["latin"],
  display: "swap",
});

export const portfolioDisplay = Plus_Jakarta_Sans({
  variable: "--font-portfolio-display",
  subsets: ["latin"],
  display: "swap",
});
