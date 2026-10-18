import { PortfolioLoadingStatus } from "@/components/loading/PortfolioLoadingStatus";

export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          <div className="h-6 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <main id="main-content" className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <PortfolioLoadingStatus
            title="Opening your dashboard"
            detail="Getting your portfolio and requests ready."
            className="mb-8 py-6"
          />
          <div aria-hidden="true" className="flex flex-col gap-6">
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
            <div className="h-48 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </main>
    </div>
  );
}
