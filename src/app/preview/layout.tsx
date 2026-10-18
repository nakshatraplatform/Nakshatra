import type { ReactNode } from "react";
import { PreviewNavigation } from "@/components/navigation/PreviewNavigation";

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col"><PreviewNavigation />{children}</div>;
}
