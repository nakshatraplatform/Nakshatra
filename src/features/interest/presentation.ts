/** Display labels only: stored statuses and permission decisions are unchanged. */
export function interestStatusLabel(status: string): string {
  if (status === "new" || status === "pending_review") return "Awaiting review";
  if (status === "rejected") return "Set aside";
  if (status === "approved" || status === "revealed") return "Details shared";
  return "Closed";
}

export function sharingStatusLabel(status: string): string {
  if (status === "active") return "Sharing details";
  if (status === "expired") return "Sharing period ended";
  if (status === "revoked") return "Sharing stopped";
  return "Not sharing";
}
