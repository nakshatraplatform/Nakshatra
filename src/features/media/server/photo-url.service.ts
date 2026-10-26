import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyPhotoOrientation,
  orderPortfolioPhotos,
  type PortfolioPhoto,
} from "../portfolio-photo";
import type { PortfolioData, PortfolioMedia } from "../../../types/portfolio";
import { signPhotoPaths } from "./signed-photo-urls";

/** Creates short-lived thumbnail URLs for the authenticated owner's dashboard. */
export async function createOwnerPortfolioMediaPreviewUrls({
  supabase,
  media,
}: {
  supabase: SupabaseClient;
  media: PortfolioMedia[];
}) {
  try {
    const urls = await signPhotoPaths(supabase, media.map(item => item.thumbnail_path || item.storage_path), 60 * 60);
    return Object.fromEntries(media.flatMap(item => {
      const url = urls.get(item.thumbnail_path || item.storage_path);
      return url ? [[item.id, url]] : [];
    }));
  } catch {
    // A signing outage must not hide a successful upload or the entire owner dashboard.
    return {};
  }
}

/**
 * Creates temporary full-resolution photo URLs for media the calling Supabase role may read.
 * Input: a Supabase client and visible portfolio media records. Output: ordered slideshow images with signed URLs.
 */
export async function createPortfolioPhotoUrls({
  supabase,
  media,
  viewer = "owner",
  privacyMode = "balanced",
}: {
  supabase: SupabaseClient;
  media: PortfolioMedia[];
  viewer?: "owner" | "approved" | "public";
  privacyMode?: PortfolioData["privacy_mode"];
}): Promise<PortfolioPhoto[]> {
  const visibleMedia = viewer === "owner"
    ? media
    : media.filter((item) => item.visibility !== "hidden" && item.visibility !== "owner_only");
  const orderedMedia = orderPortfolioPhotos(visibleMedia);
  let hasClearPrivateGalleryPhoto = false;
  const descriptors = orderedMedia.flatMap(item => {
    const protectedByPhotoSetting =
      viewer === "public" &&
      (item.visibility === "blurred" ||
        item.visibility === "interest_required" ||
        item.visibility === "approved_only");
    const isPrivateGallery =
      viewer === "public" &&
      privacyMode === "private" &&
      item.media_type === "gallery";
    const isClearPrivateGalleryPhoto =
      isPrivateGallery &&
      !protectedByPhotoSetting &&
      item.visibility === "public" &&
      !hasClearPrivateGalleryPhoto;
    if (isClearPrivateGalleryPhoto) hasClearPrivateGalleryPhoto = true;
    const protectedPresentation =
      protectedByPhotoSetting || (isPrivateGallery && !isClearPrivateGalleryPhoto);
    const path = protectedPresentation ? item.metadata?.blurPath : item.storage_path;
    return path ? [{ item, path, protectedPresentation }] : [];
  });
  const urls = await signPhotoPaths(supabase, descriptors.map(item => item.path), 60 * 60);
  return descriptors.flatMap(({ item, path, protectedPresentation }): PortfolioPhoto[] => {
    const url = urls.get(path);
    if (!url) return [];
    const width = item.metadata?.width;
    const height = item.metadata?.height;
    const photo: PortfolioPhoto = {
      id: item.id,
      src: url,
      alt: item.alt_text || "Portfolio photo",
      mediaType: item.media_type === "hero" ? "hero" : "gallery",
      width,
      height,
      aspectRatio:
        item.metadata?.aspectRatio ||
        (width && height ? width / height : undefined),
      orientation:
        item.metadata?.orientation || classifyPhotoOrientation(width, height),
      ...(protectedPresentation ? { presentation: "blurred" as const } : {}),
    };
    return [photo];
  });
}
