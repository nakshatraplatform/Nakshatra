import { PortfolioLoadingStatus } from "@/components/loading/PortfolioLoadingStatus";

export default function PreviewLoading() {
  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <div className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-2xl flex flex-col items-center gap-4">
          <PortfolioLoadingStatus
            title="Preparing your Introduction preview"
            detail="Your saved portfolio will appear here shortly."
            state="weaving"
            className="mb-5 py-5"
          />
          <div className="mt-8 w-full flex flex-col gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 w-full animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
