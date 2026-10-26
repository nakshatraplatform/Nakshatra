import { describe, expect, it, vi } from "vitest";
import { classifyPhotoOrientation, isShareablePrimaryPhoto, orderPortfolioPhotos } from "../src/features/media/portfolio-photo";
import { createOwnerPortfolioMediaPreviewUrls, createPortfolioPhotoUrls } from "../src/features/media/server/photo-url.service";
import { signPhotoPaths } from "../src/features/media/server/signed-photo-urls";
import type { PortfolioMedia } from "../src/types/portfolio";

const media: PortfolioMedia[] = [
  { id: "gallery", portfolio_id: "portfolio", storage_path: "owner/portfolio/gallery.webp", thumbnail_path: null,
    media_type: "gallery", visibility: "public", sort_order: 0, alt_text: "Garden portrait" },
  { id: "hero", portfolio_id: "portfolio", storage_path: "owner/portfolio/hero.webp", thumbnail_path: null,
    media_type: "hero", visibility: "public", sort_order: 4, alt_text: null,
    metadata: { width: 900, height: 1200, aspectRatio: 0.75, orientation: "portrait" } },
];
function client() {
  const createSignedUrls = vi.fn(async (paths: string[], ttl: number): Promise<{ data: { path: string; signedUrl: string; error: string | null }[] | null }> => {
    void ttl;
    return { data: paths.map(path => ({ path, signedUrl: "https://photos.test/" + path, error: null })) };
  });
  return { createSignedUrls, supabase: { storage: { from: vi.fn(() => ({ createSignedUrls })) } } as never };
}
describe("batched portfolio photo URLs", () => {
  it("creates an owner thumbnail map and preserves individual failures", async () => {
    const c = client();
    const photos = [{ ...media[0], thumbnail_path: "owner/portfolio/thumb.webp" }, media[1]];
    c.createSignedUrls.mockResolvedValueOnce({ data: [
      { path: "owner/portfolio/thumb.webp", signedUrl: "https://photos.test/thumb", error: null },
      { path: media[1].storage_path, signedUrl: "", error: "not found" },
    ] });
    expect(await createOwnerPortfolioMediaPreviewUrls({ supabase: c.supabase, media: photos })).toEqual({ gallery: "https://photos.test/thumb" });
    expect(c.createSignedUrls).toHaveBeenCalledExactlyOnceWith(["owner/portfolio/thumb.webp", media[1].storage_path], 3600);
  });
  it("keeps the dashboard usable when the batch throws", async () => {
    const c = client(); c.createSignedUrls.mockRejectedValueOnce(new Error("Storage unavailable"));
    expect(await createOwnerPortfolioMediaPreviewUrls({ supabase: c.supabase, media })).toEqual({});
  });
  it("orders the hero first without changing the original array and retains dimensions", async () => {
    const c = client();
    const photos = await createPortfolioPhotoUrls({ supabase: c.supabase, media });
    expect(photos.map(photo => photo.id)).toEqual(["hero", "gallery"]);
    expect(photos[0]).toMatchObject({ alt: "Portfolio photo", width: 900, height: 1200, aspectRatio: 0.75, orientation: "portrait" });
    expect(media[0].id).toBe("gallery");
    expect(orderPortfolioPhotos(media)[0].id).toBe("hero");
    expect(c.createSignedUrls).toHaveBeenCalledExactlyOnceWith([media[1].storage_path, media[0].storage_path], 3600);
  });
  it("omits individual signing failures without dropping successful photos", async () => {
    const c = client();
    c.createSignedUrls.mockResolvedValueOnce({ data: [
      { path: media[0].storage_path, signedUrl: "https://photos.test/gallery", error: null },
      { path: media[1].storage_path, signedUrl: "", error: "not found" },
    ] });
    const photos = await createPortfolioPhotoUrls({ supabase: c.supabase, media });
    expect(photos).toEqual([expect.objectContaining({ id: "gallery", src: "https://photos.test/gallery", orientation: "unknown" })]);
  });
  it.each(["blurred", "interest_required", "approved_only"] as const)("signs only a safe derivative for %s public photos", async visibility => {
    const c = client();
    const protectedPhoto = { ...media[0], visibility, metadata: { blurPath: "owner/portfolio/blur.webp" } };
    expect(await createPortfolioPhotoUrls({ supabase: c.supabase, media: [protectedPhoto], viewer: "public" }))
      .toEqual([expect.objectContaining({ presentation: "blurred", src: "https://photos.test/owner/portfolio/blur.webp" })]);
    expect(c.createSignedUrls).toHaveBeenCalledExactlyOnceWith(["owner/portfolio/blur.webp"], 3600);
  });
  it("shows one clear private gallery photo and uses derivatives for the others", async () => {
    const c = client();
    const photos: PortfolioMedia[] = [
      { ...media[0], id: "first" },
      { ...media[0], id: "protected", sort_order: 1, visibility: "approved_only", metadata: { blurPath: "owner/portfolio/protected-blur.webp" } },
      { ...media[0], id: "second", sort_order: 2, storage_path: "owner/portfolio/second.webp", metadata: { blurPath: "owner/portfolio/second-blur.webp" } },
    ];
    const result = await createPortfolioPhotoUrls({ supabase: c.supabase, media: photos, viewer: "public", privacyMode: "private" });
    expect(result.map(photo => [photo.id, photo.presentation ?? "clear"])).toEqual([["first", "clear"], ["protected", "blurred"], ["second", "blurred"]]);
    expect(c.createSignedUrls).toHaveBeenCalledExactlyOnceWith([
      media[0].storage_path, "owner/portfolio/protected-blur.webp", "owner/portfolio/second-blur.webp",
    ], 3600);
  });
  it("keeps approved originals available while excluding hidden and owner-only photos", async () => {
    const c = client();
    const photos: PortfolioMedia[] = [
      { ...media[0], visibility: "approved_only" }, { ...media[1], visibility: "hidden" }, { ...media[1], id: "owner-only", visibility: "owner_only" },
    ];
    expect(await createPortfolioPhotoUrls({ supabase: c.supabase, media: photos, viewer: "approved" })).toHaveLength(1);
    expect(c.createSignedUrls).toHaveBeenCalledExactlyOnceWith([media[0].storage_path], 3600);
  });
  it.each(["public", "approved"] as const)("never signs hidden and owner-only photos for %s", async viewer => {
    const c = client();
    expect(await createPortfolioPhotoUrls({ supabase: c.supabase, viewer, media: [
      { ...media[0], visibility: "hidden" }, { ...media[1], visibility: "owner_only" },
    ] })).toEqual([]);
    expect(c.createSignedUrls).not.toHaveBeenCalled();
  });
  it("omits legacy protected photos without a derivative", async () => {
    const c = client();
    expect(await createPortfolioPhotoUrls({ supabase: c.supabase, media: [{ ...media[0], visibility: "interest_required" }], viewer: "public" })).toEqual([]);
    expect(c.createSignedUrls).not.toHaveBeenCalled();
  });
  it("deduplicates paths and ignores unrequested response paths", async () => {
    const c = client();
    c.createSignedUrls.mockResolvedValueOnce({ data: [
      { path: "unrequested/private.webp", signedUrl: "https://photos.test/private", error: null },
      { path: media[0].storage_path, signedUrl: "https://photos.test/gallery", error: null },
    ] });
    expect(await signPhotoPaths(c.supabase, [media[0].storage_path, media[0].storage_path], 300))
      .toEqual(new Map([[media[0].storage_path, "https://photos.test/gallery"]]));
    expect(c.createSignedUrls).toHaveBeenCalledExactlyOnceWith([media[0].storage_path], 300);
  });
  it("handles an empty batch response and preserves thrown failures for callers", async () => {
    const c = client(); c.createSignedUrls.mockResolvedValueOnce({ data: null });
    expect(await createPortfolioPhotoUrls({ supabase: c.supabase, media })).toEqual([]);
    c.createSignedUrls.mockRejectedValueOnce(new Error("network"));
    await expect(createPortfolioPhotoUrls({ supabase: c.supabase, media })).rejects.toThrow("network");
  });
  it("keeps photo classification and primary-photo eligibility unchanged", () => {
    expect(classifyPhotoOrientation(900, 1200)).toBe("portrait");
    expect(classifyPhotoOrientation(1600, 900)).toBe("landscape");
    expect(classifyPhotoOrientation(1000, 960)).toBe("square");
    expect(classifyPhotoOrientation()).toBe("unknown");
    expect(isShareablePrimaryPhoto(media[1])).toBe(true);
    expect(isShareablePrimaryPhoto({ ...media[1], visibility: "interest_required" })).toBe(true);
    expect(isShareablePrimaryPhoto({ ...media[1], visibility: "owner_only" })).toBe(false);
    expect(isShareablePrimaryPhoto(media[0])).toBe(false);
  });
});
