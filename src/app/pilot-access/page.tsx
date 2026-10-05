import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default function PilotAccessPage() {
  redirect("/signup");
}
