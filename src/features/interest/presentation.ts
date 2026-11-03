/** Display labels only: stored statuses and permission decisions are unchanged. */
export function interestStatusLabel(status: string): string {
  if (status === "new" || status === "pending_review") return "Awaiting review";
  if (status === "set_aside") return "Set aside";
  if (status === "rejected") return "Declined";
  if (status === "approved" || status === "revealed") return "Details shared";
  return "Closed";
}

export function sharingStatusLabel(status: string): string {
  if (status === "active") return "Sharing details";
  if (status === "expired") return "Sharing period ended";
  if (status === "revoked") return "Sharing stopped";
  return "Not sharing";
}
