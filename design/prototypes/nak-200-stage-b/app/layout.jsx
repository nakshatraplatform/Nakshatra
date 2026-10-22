import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata = {
  title: "VivIntroDesk · NAK-208 workflow wireframes",
  description:
    "A fictional broker workspace for reviewing VivIntroDesk's responsive design.",
  robots: { index: false, follow: false },
};
export const viewport = { themeColor: "#FCFBFB" };

export default function Layout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="font-body text-sm font-normal antialiased">
        {children}
      </body>
    </html>
  );
}
