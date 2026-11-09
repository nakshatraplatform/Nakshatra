import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { signPhotoPaths } from "@/features/media/server/signed-photo-urls";
import { classifyPhotoOrientation, type PortfolioPhoto } from "@/features/media/portfolio-photo";
import {
  approvedHoroscopeSchema,
  resolvedPortfolioSchema,
  type ApprovedHoroscope,
  type PublicMediaDescriptor,
  type ResolvedPortfolio,
} from "./public-portfolio.contract";
import { PublicPortfolioRepository } from "./public-portfolio.repository";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { guestViewingRpc } from "@/features/access/server/guest-viewing-proof";

type GuestViewingOptions = { createGuestClient?: () => SupabaseClient; guestProofHash?: string | null };

/** Stored descriptors must not change object identity when the SDK constructs a URL. */
function canonicalStoragePath(path: string) {
  return /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+$/.test(path)
    && path.split("/").every(segment => segment !== "." && segment !== "..");
}

export interface PortfolioView extends ResolvedPortfolio {
  accessMode: "public" | "approved";
  photos: PortfolioPhoto[];
  filesRequireApprovedAccount: boolean;
}

export type PublicPortfolioAvailability = "active" | "expired" | "unavailable";

function approvalIsCurrent(expiresAt?: string) {
  return Boolean(expiresAt && Date.parse(expiresAt) > Date.now());
}

export const approvedPhotoKeyPattern = /^[A-Za-z0-9_-]{1,64}$/;

export function approvedFileHref(token: string, file: string) {
  return `/p/${encodeURIComponent(token)}/files/${encodeURIComponent(file)}`;
}

async function resolveAccountApproval(repository: PublicPortfolioRepository, token: string) {
  const { data, error } = await repository.resolveApproved(token);
  const parsed = resolvedPortfolioSchema.safeParse(data);
  return !error && parsed.success && approvalIsCurrent(parsed.data.accessExpiresAt) ? parsed.data : null;
}

/** Match the opaque photo key only inside the current account's authorized projection. */
export async function resolveApprovedPhoto(supabase: SupabaseClient, token: string, key: string) {
  const approved = await resolveAccountApproval(new PublicPortfolioRepository(supabase), token);
  return approved?.media.find(item => item.key === key && canonicalStoragePath(item.accessPath)) ?? null;
}

/** Resolves one exact public token without exposing direct table reads to the caller. */
export const resolvePublicPortfolio = cache(async function resolvePublicPortfolio(
  supabase: SupabaseClient,
  token: string
): Promise<ResolvedPortfolio | null> {
  const repository = new PublicPortfolioRepository(supabase);
  const [{ data, error }, verification] = await Promise.all([
    repository.resolvePublic(token),
    repository.resolvePublicIdentityVerified(token),
  ]);
  if (error || !data) return null;
  const parsed = resolvedPortfolioSchema.safeParse(data);
  return parsed.success
    ? { ...parsed.data, identityVerified: !verification.error && verification.data === true }
    : null;
});

/** Distinguishes an expired canonical link from malformed, unknown, rotated, or unpublished links. */
export async function resolvePublicPortfolioAvailability(
  supabase: SupabaseClient,
  token: string
): Promise<PublicPortfolioAvailability> {
  if (await resolvePublicPortfolio(supabase, token)) return "active";
  const { data, error } = await new PublicPortfolioRepository(supabase)
    .resolvePublicStatus(token);
  if (error || data !== "expired") return "unavailable";
  return "expired";
}

/** A remembered guest may read approved details. Only account approval reveals private file links. */
export async function resolvePortfolioView(
  supabase: SupabaseClient,
  token: string,
  authenticated: boolean,
  { createGuestClient = createServiceRoleClient, guestProofHash }: GuestViewingOptions = {}
): Promise<PortfolioView | null> {
  const publicPortfolio = await resolvePublicPortfolio(supabase, token);
  if (!publicPortfolio) return null;

  const accountApproval = authenticated
    ? await resolveAccountApproval(new PublicPortfolioRepository(supabase), token)
    : null;
  let approved = accountApproval;
  if (!approved && guestProofHash) {
    const { data, error } = await guestViewingRpc(createGuestClient())("resolve_guest_approved_portfolio", {
      p_share_token: token, p_proof_hash: guestProofHash,
    });
    const parsed = resolvedPortfolioSchema.safeParse(data);
    if (!error && parsed.success && approvalIsCurrent(parsed.data.accessExpiresAt)) approved = parsed.data;
  }

  return {
    ...(approved ?? publicPortfolio),
    identityVerified: publicPortfolio.identityVerified,
    accessMode: approved ? "approved" : "public",
    filesRequireApprovedAccount: !accountApproval && Boolean(approved && (approved.horoscope || approved.media.some(
      item => !publicPortfolio.media.some(publicItem => publicItem.accessPath === item.accessPath)
    ))),
    horoscope: accountApproval?.horoscope,
    photos: accountApproval
      ? accountApproval.media.filter(item => approvedPhotoKeyPattern.test(item.key) && canonicalStoragePath(item.accessPath))
        .map(item => portfolioPhoto(item, approvedFileHref(token, `photo-${item.key}`)))
      : await createPublicPhotoUrls(supabase, publicPortfolio.media),
  };
}

/** Records a view using only the share token; unavailable tokens are ignored uniformly. */
export async function recordPublicPortfolioView(
  supabase: SupabaseClient,
  token: string
) {
  const repository = new PublicPortfolioRepository(supabase);
  await repository.recordView(token);
}

/** Detects the owner so the public page can disable self-interest in the UI. */
export async function isPortfolioOwner(
  supabase: SupabaseClient,
  token: string,
  userId: string | null | undefined
) {
  if (!userId) return false;
  const { data, error } = await new PublicPortfolioRepository(supabase)
    .findOwnedPortfolio(token, userId);
  return !error && Boolean(data);
}

/** Resolve the document for the current account. Storage access is handled only by the file route. */
export async function resolveApprovedHoroscope(supabase: SupabaseClient, token: string): Promise<ApprovedHoroscope | null> {
  const { data, error } = await new PublicPortfolioRepository(supabase).resolveApprovedHoroscope(token);
  const parsed = approvedHoroscopeSchema.safeParse(data);
  return !error && parsed.success && canonicalStoragePath(parsed.data.accessPath) && approvalIsCurrent(parsed.data.accessExpiresAt)
    ? parsed.data : null;
}

async function createPublicPhotoUrls(supabase: SupabaseClient, media: PublicMediaDescriptor[]): Promise<PortfolioPhoto[]> {
  const authorized = media.filter(item => canonicalStoragePath(item.accessPath));
  const urls = await signPhotoPaths(supabase, authorized.map(item => item.accessPath), 60 * 60);
  return authorized.flatMap(item => {
    const url = urls.get(item.accessPath);
    return url ? [portfolioPhoto(item, url)] : [];
  });
}

function portfolioPhoto(item: PublicMediaDescriptor, src: string): PortfolioPhoto {
  return {
    id: item.key,
    src,
    alt: item.altText || "Portfolio photo",
    mediaType: item.mediaType,
    width: item.width,
    height: item.height,
    aspectRatio: item.aspectRatio || (item.width && item.height ? item.width / item.height : undefined),
    orientation: item.orientation || classifyPhotoOrientation(item.width, item.height),
    presentation: item.presentation,
  };
}
