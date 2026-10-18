"use client";

import { createContext, useContext, type ReactNode } from "react";
import { portfolioFieldAnchor, type EditorFieldIssue } from "@/features/portfolio/editor-validation";

const Context = createContext<EditorFieldIssue[]>([]);
export function PortfolioFieldValidation({ issues, children }: { issues: EditorFieldIssue[]; children: ReactNode }) {
  return <Context.Provider value={issues}>{children}</Context.Provider>;
}

export function usePortfolioFieldError(path?: string) {
  return useContext(Context).find(issue => issue.path === path)?.message;
}

/** A stable focus target for composite controls such as location and photo selection. */
export function PortfolioAnswer({ path, children }: { path: string; children: ReactNode }) {
  const error = usePortfolioFieldError(path);
  return <div id={portfolioFieldAnchor(path)} tabIndex={-1} className="min-w-0 space-y-2" aria-describedby={error ? `${portfolioFieldAnchor(path)}-error` : undefined}>
    {children}
    {error && <p id={`${portfolioFieldAnchor(path)}-error`} role="alert" className="text-sm text-[var(--ui-danger)]">{error}</p>}
  </div>;
}
