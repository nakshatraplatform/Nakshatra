import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Manrope,
  Playfair_Display,
  Tenor_Sans,
} from "next/font/google";
import "./globals.css";
import "./app-theme.css";
import { AppThemeProvider } from "@/components/theme/AppThemeProvider";
import { ThemeBootstrap } from "@/components/theme/ThemeBootstrap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const portfolioDisplay = Playfair_Display({
  variable: "--font-portfolio-display",
  subsets: ["latin"],
});

const portfolioBody = Manrope({
  variable: "--font-portfolio-body",
  subsets: ["latin"],
});

const portfolioSection = Tenor_Sans({
  variable: "--font-portfolio-section",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://www.vivintro.com"
  ),
  title: {
    default: "VivIntro — Private Marriage Introductions You Control",
    template: "%s | VivIntro",
  },
  description:
    "Share one private marriage introduction. Keep contact details and documents protected until you approve each request.",
  openGraph: {
    type: "website",
    siteName: "VivIntro",
    locale: "en_IN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${portfolioDisplay.variable} ${portfolioBody.variable} ${portfolioSection.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeBootstrap />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
