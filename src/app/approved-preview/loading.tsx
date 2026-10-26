import { LoadingStatus } from "@/components/loading/LoadingStatus";

export default function ApprovedPreviewLoading() {
  return (
    <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-16">
      <LoadingStatus
        title="Preparing your Complete Portfolio preview"
        detail="Your saved details will appear here shortly."
        state="weaving"
      />
    </main>
  );
}
