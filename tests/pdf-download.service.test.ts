import { beforeEach, describe, expect, it, vi } from "vitest";

const render = vi.hoisted(() => vi.fn());
vi.mock("../src/features/portfolio/server/pdf-renderer", () => ({ renderIntroductionPdf: render }));
import { downloadPortfolioPdf } from "../src/features/portfolio/server/pdf-download.service";
import sharp from "sharp";

const code = "a".repeat(32);
const projection = { templateId: 1, data: { personal: { name: "Test Person", dob: "1990-01-01" }, contact: { secure_note: "PRIVATE-SENTINEL" } }, media: [] };
function client(overrides: { prepare?: unknown; validate?: boolean; error?: unknown } = {}) {
  const rpc = vi.fn(async (name: string) => name === "prepare_portfolio_pdf"
    ? { data: overrides.prepare ?? { status: "ready", code, shareToken: "b".repeat(21), projection }, error: overrides.error ?? null }
    : { data: overrides.validate ?? true, error: null });
  const download = vi.fn();
  return { rpc, storage: { from: vi.fn(() => ({ download })) }, download };
}

describe("owner PDF generation", () => {
  beforeEach(() => { vi.clearAllMocks(); render.mockResolvedValue(Buffer.from("%PDF-test")); });

  it("passes only the allowlisted public projection and date, then revalidates before returning", async () => {
    const db = client();
    const result = await downloadPortfolioPdf(db as never, new Date("2026-10-17T12:00:00Z"));
    expect(result.filename).toBe("vivintro-Test-Person-2026-10-17.pdf");
    expect(result.bytes.toString()).toBe("%PDF-test");
    expect(JSON.stringify(render.mock.calls)).not.toContain("PRIVATE-SENTINEL");
    expect(JSON.stringify(render.mock.calls)).not.toContain("1990-01-01");
    expect(render.mock.calls[0][0].qrUrl).toContain(`/i/${code}`);
    expect(db.rpc).toHaveBeenLastCalledWith("validate_portfolio_pdf", { p_code: code, p_projection: projection });
  });

  it.each([
    [{ status: "unavailable" }, "PDF_NOT_AVAILABLE"],
    [{ status: "rate_limited" }, "PDF_RATE_LIMITED"],
    [{ status: "ready", code: "bad" }, "PDF_PREPARATION_FAILED"],
  ])("fails closed before rendering on a denied or malformed ticket", async (prepare, errorCode) => {
    const db = client({ prepare });
    await expect(downloadPortfolioPdf(db as never)).rejects.toMatchObject({ code: errorCode });
    expect(render).not.toHaveBeenCalled(); expect(db.download).not.toHaveBeenCalled();
  });

  it("does not deliver a rendered file after rotation, unpublish, session revocation or public-data change", async () => {
    await expect(downloadPortfolioPdf(client({ validate: false }) as never)).rejects.toMatchObject({ code: "PDF_CHANGED" });
    expect(render).toHaveBeenCalledOnce();
  });

  it("ignores approved/gallery/blurred photo candidates instead of downloading them", async () => {
    const media = [{ key: "photo", accessPath: "private/photo.webp", mediaType: "hero", sortOrder: 0, presentation: "blurred" }];
    const db = client({ prepare: { status: "ready", code, shareToken: "b".repeat(21), projection: { ...projection, media } } });
    await downloadPortfolioPdf(db as never);
    expect(db.download).not.toHaveBeenCalled();
    expect(render.mock.calls[0][0].photo).toBeUndefined();
  });

  it("falls back to initials on missing or oversized public hero without arbitrary HTTP fetches", async () => {
    const media = [{ key: "photo", accessPath: "public/hero.webp", mediaType: "hero", sortOrder: 0, presentation: "clear" }];
    const db = client({ prepare: { status: "ready", code, shareToken: "b".repeat(21), projection: { ...projection, media } } });
    db.download.mockResolvedValue({ data: { size: 6 * 1024 * 1024 }, error: null });
    await downloadPortfolioPdf(db as never);
    expect(db.download).toHaveBeenCalledWith("public/hero.webp", {}, expect.objectContaining({ signal: expect.any(AbortSignal), cache: "no-store" }));
    expect(render.mock.calls[0][0].photo).toBeUndefined();
  });
  it("normalizes a permitted public photo and strips metadata before rendering", async () => {
    const media = [{ key: "photo", accessPath: "public/hero.webp", mediaType: "hero", sortOrder: 0, presentation: "clear" }];
    const db = client({ prepare: { status: "ready", code, shareToken: "b".repeat(21), projection: { ...projection, media } } });
    const image = await sharp({ create: { width: 12, height: 16, channels: 3, background: "#eeeeee" } }).withMetadata({ orientation: 6 }).webp().toBuffer();
    db.download.mockResolvedValue({ data: new Blob([new Uint8Array(image)], { type: "image/webp" }), error: null });
    await downloadPortfolioPdf(db as never);
    const photo = render.mock.calls[0][0].photo;
    const metadata = await sharp(photo).metadata();
    expect(metadata.format).toBe("jpeg"); expect(metadata.orientation).toBeUndefined(); expect(metadata.exif).toBeUndefined();
    expect(metadata.width).toBe(16); expect(metadata.height).toBe(12);
  });
});
