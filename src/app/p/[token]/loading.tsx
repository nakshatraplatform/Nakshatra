import { PortfolioLoadingStatus } from "@/components/loading/PortfolioLoadingStatus";

export default function SharedPortfolioLoading() {
  return (
    <main id="main-content" className="flex min-h-[50vh] items-center justify-center px-4 py-16">
      <PortfolioLoadingStatus
        title="Opening this Introduction"
        detail="Checking that the shared link is available."
      />
    </main>
  );
}
