import { Suspense } from "react";
import Workspace from "../components/workspace";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-navy" aria-busy="true">
          Opening sample workspace…
        </main>
      }
    >
      <Workspace />
    </Suspense>
  );
}
