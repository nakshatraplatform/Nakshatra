import type { Metadata } from "next";
import PilotAccessClient from "./pilot-access-client";

export const metadata: Metadata = {
  title: "Request pilot access",
  description: "Request access to Nakshatra's private portfolio pilot.",
};

export default function PilotAccessPage() {
  return <PilotAccessClient />;
}
