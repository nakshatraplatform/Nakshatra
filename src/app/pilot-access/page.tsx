import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Waitlist moved",
  robots: { index: false, follow: false },
};

export default function PilotAccessPage() {
  redirect("/waitlist");
}
