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

type SigningOptions = { createSigningClient?: () => SupabaseClient };

/** Stored descriptors must not change object identity when the SDK constructs a URL. */
function canonicalStoragePath(path: string) {
  return /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+$/.test(path)
    && path.split("/").every(segment => segment !== "." && segment !== "..");
}

export interface PortfolioView extends ResolvedPortfolio {
  accessMode: "public" | "approved";
  photos: PortfolioPhoto[];
}

export type PublicPortfolioAvailability = "active" | "expired" | "unavailable";

/** Caps a private signed capability at five minutes without allowing it to outlive its reveal grant. */
export function privateCapabilityTtl(expiresAt: string, now = Date.now()) {
  const remainingSeconds = Math.floor((Date.parse(expiresAt) - now) / 1000);
  return remainingSeconds > 0 ? Math.min(5 * 60, remainingSeconds) : null;
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

/** Resolves an approved projection only when the authenticated viewer has an active full grant. */
export async function resolvePortfolioView(
  supabase: SupabaseClient,
  token: string,
  authenticated: boolean,
  { createSigningClient = createServiceRoleClient }: SigningOptions = {}
): Promise<PortfolioView | null> {
  const repository = new PublicPortfolioRepository(supabase);
  const publicPortfolio = await resolvePublicPortfolio(supabase, token);
  if (!publicPortfolio) return null;

  let resolved = publicPortfolio;
  const identityVerified = publicPortfolio.identityVerified;
  let accessMode: PortfolioView["accessMode"] = "public";
  if (authenticated) {
    const { data } = await repository.resolveApproved(token);
    const approved = resolvedPortfolioSchema.safeParse(data);
    if (approved.success && approved.data.accessExpiresAt && privateCapabilityTtl(approved.data.accessExpiresAt)) {
      resolved = approved.data;
      accessMode = "approved";
    }
  }

  return {
    ...resolved,
    identityVerified,
    accessMode,
    photos: await createSafePhotoUrls(
      accessMode === "approved" ? createSigningClient() : supabase,
      resolved.media,
      accessMode === "approved" && resolved.accessExpiresAt
        ? privateCapabilityTtl(resolved.accessExpiresAt)
        : 60 * 60
    ),
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

/** Resolves and signs an approved horoscope for five minutes. */
export async function resolveApprovedHoroscope(
  supabase: SupabaseClient,
  token: string,
  { createSigningClient = createServiceRoleClient }: SigningOptions = {}
): Promise<(ApprovedHoroscope & { signedUrl: string }) | null> {
  const repository = new PublicPortfolioRepository(supabase);
  const { data, error } = await repository.resolveApprovedHoroscope(token);
  if (error || !data) return null;
  const parsed = approvedHoroscopeSchema.safeParse(data);
  if (!parsed.success || !canonicalStoragePath(parsed.data.accessPath)) return null;
  const ttl = privateCapabilityTtl(parsed.data.accessExpiresAt);
  if (!ttl) return null;
  // Authorization stays on the viewer client. Privilege is used only for the
  // exact descriptor returned above, never for a path supplied by a browser.
  const signed = await new PublicPortfolioRepository(createSigningClient()).createHoroscopeUrl(
    parsed.data.accessPath,
    ttl,
    undefined
  );
  return signed.data?.signedUrl ? { ...parsed.data, signedUrl: signed.data.signedUrl } : null;
}

/** Converts only RPC-authorized media paths into temporary browser URLs. */
async function createSafePhotoUrls(
  supabase: SupabaseClient,
  media: PublicMediaDescriptor[],
  expiresInSeconds: number | null
): Promise<PortfolioPhoto[]> {
  if (!expiresInSeconds) return [];
  const authorized = media.filter(item => canonicalStoragePath(item.accessPath));
  const urls = await signPhotoPaths(supabase, authorized.map(item => item.accessPath), expiresInSeconds);
  return authorized.flatMap((item): PortfolioPhoto[] => {
    const url = urls.get(item.accessPath);
    if (!url) return [];
    return [{
      id: item.key,
      src: url,
      alt: item.altText || "Portfolio photo",
      mediaType: item.mediaType,
      width: item.width,
      height: item.height,
      aspectRatio: item.aspectRatio || (item.width && item.height ? item.width / item.height : undefined),
      orientation: item.orientation || classifyPhotoOrientation(item.width, item.height),
      presentation: item.presentation,
    }];
  });
}
