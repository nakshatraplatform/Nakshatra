import type { Metadata } from "next";
import { brokerIntroductionRouteRefSchema } from "@/features/security/public-reference";
import { BrokerIntroductionClient } from "./broker-introduction-client";

export const metadata: Metadata = {
  title: "Private introduction · VivIntro",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function BrokerIntroductionPage({ params }: {
  params: Promise<{ introductionRef: string }>;
}) {
  const { introductionRef } = await params;
  return <BrokerIntroductionClient
    introductionRef={brokerIntroductionRouteRefSchema.safeParse(introductionRef).success ? introductionRef : ""}
  />;
}
