import type { Metadata } from "next";
import { portfolioBody, portfolioDisplay } from "@/lib/fonts";
import "./globals.css";
import "./app-theme.css";
import { AppThemeProvider } from "@/components/theme/AppThemeProvider";
import { ThemeBootstrap } from "@/components/theme/ThemeBootstrap";
import { PrivacySafeAnalytics } from "@/components/analytics/PrivacySafeAnalytics";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://www.vivintro.com"
  ),
  title: {
    default: "VivIntro — Marriage Introductions Shared with Care",
    template: "%s | VivIntro",
  },
  description:
    "Share one current marriage introduction link. Keep contact details and documents protected until you approve access.",
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
      className={`${portfolioDisplay.variable} ${portfolioBody.variable} antialiased`}
    >
      <body className="min-h-dvh" suppressHydrationWarning>
        <ThemeBootstrap />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <AppThemeProvider>{children}</AppThemeProvider>
        <PrivacySafeAnalytics />
      </body>
    </html>
  );
}
