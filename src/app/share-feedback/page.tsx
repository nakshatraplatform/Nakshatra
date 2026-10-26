import type { Metadata } from "next";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = {
  title: "Share feedback with VivIntro",
  description: "Tell VivIntro what worked and what could be clearer when creating or receiving a marriage introduction.",
  robots: { index: false, follow: false },
};

export default function ShareFeedbackPage() { return <FeedbackForm />; }
