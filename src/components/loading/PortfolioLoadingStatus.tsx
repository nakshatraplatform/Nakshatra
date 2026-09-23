"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { useAppTheme } from "@/components/theme/AppThemeProvider";

interface PortfolioLoadingStatusProps {
  title: string;
  detail: string;
  state?: OrbState;
  className?: string;
}

export function PortfolioLoadingStatus({
  title,
  detail,
  state = "working",
  className = "",
}: PortfolioLoadingStatusProps) {
  const { theme } = useAppTheme();

  return (
    <div className={`flex flex-col items-center gap-3 text-center ${className}`} role="status" aria-live="polite">
      <ThinkingOrb
        state={state}
        size={64}
        theme={theme}
        color={theme === "dark" ? "#edc978" : "#16505a"}
        aria-hidden="true"
      />
      <div className="max-w-sm">
        <p className="text-base font-semibold text-[light-dark(#183f49,var(--app-dark-ink))]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[light-dark(#5b6b73,var(--app-dark-muted))]">{detail}</p>
      </div>
    </div>
  );
}
