import type { ReactNode } from "react";
import { PreviewNavigation } from "@/components/navigation/PreviewNavigation";

export default function ApprovedPreviewLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col"><PreviewNavigation complete />{children}</div>;
}
