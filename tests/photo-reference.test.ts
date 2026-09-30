import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PhotoReferenceError, preparePhotoReference } from "@/features/identity-verification/server/photo-reference";

describe("candidate primary-photo reference", () => {
  it("preserves the stored content digest while preparing a transient provider image", async () => {
    const stored = await sharp({ create: {
      width: 120, height: 120, channels: 3, background: "#aabbcc",
    } }).webp().toBuffer();
    const prepared = await preparePhotoReference(stored);
    expect(prepared.sourceSha256).toBe(createHash("sha256").update(stored).digest("hex"));
    expect(Buffer.from(prepared.portraitImageBase64, "base64")).toEqual(stored);
  });

  it("rejects malformed, empty and oversized reference input", async () => {
    await expect(preparePhotoReference(Buffer.alloc(0))).rejects.toBeInstanceOf(PhotoReferenceError);
    await expect(preparePhotoReference(Buffer.from("not an image"))).rejects.toBeInstanceOf(PhotoReferenceError);
    await expect(preparePhotoReference(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(PhotoReferenceError);
  });
});
