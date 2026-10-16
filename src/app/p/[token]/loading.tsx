import { PortfolioLoadingStatus } from "@/components/loading/PortfolioLoadingStatus";

export default function SharedPortfolioLoading() {
  return (
    <main id="main-content" className="flex min-h-[50vh] items-center justify-center px-4 py-16">
      <PortfolioLoadingStatus
        title="Opening introduction…"
        detail="Checking this shared link."
      />
    </main>
  );
}
