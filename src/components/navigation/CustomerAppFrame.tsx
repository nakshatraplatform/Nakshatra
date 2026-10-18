import { Suspense, type ReactNode } from "react";
import { CustomerAppHeader } from "./CustomerAppHeader";
import { LoadingStatus } from "@/components/loading/LoadingStatus";

/** Render after authentication; only the data region suspends, not navigation. */
export function CustomerAppFrame({ currentPage, userEmail, loadingTitle, className, children }: {
  currentPage: "dashboard" | "account" | "brokers";
  userEmail?: string;
  loadingTitle: string;
  className: string;
  children: ReactNode;
}) {
  return <div className={className}>
    <CustomerAppHeader currentPage={currentPage} userEmail={userEmail} />
    <Suspense fallback={<main id="main-content" tabIndex={-1} aria-busy="true" className="flex-1 px-4 py-16">
      <LoadingStatus title={loadingTitle} state="connecting" />
    </main>}>
      {children}
    </Suspense>
  </div>;
}
