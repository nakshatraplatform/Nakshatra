import "server-only";
import { cookies } from "next/headers";
import { guestViewingCookieName, hashGuestViewingProof } from "./guest-viewing-proof";

export async function readGuestViewingProof(token: string) {
  const store = await cookies();
  return hashGuestViewingProof(store.get(guestViewingCookieName(token))?.value);
}
