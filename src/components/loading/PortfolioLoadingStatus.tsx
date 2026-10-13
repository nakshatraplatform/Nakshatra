"use client";

import type { OrbState } from "thinking-orbs";
import { LoadingStatus } from "./LoadingStatus";

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
  return <LoadingStatus title={title} detail={detail} state={state} className={className} />;
}
