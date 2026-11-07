import { LoadingStatus } from "@/components/loading/LoadingStatus";

export default function LoadingFamilyDashboard() {
  return <main id="main-content" tabIndex={-1} className="px-6 py-16">
    <LoadingStatus title="Loading family introductions" state="connecting" />
  </main>;
}
