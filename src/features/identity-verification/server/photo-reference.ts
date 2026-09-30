import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

const MAX_PROVIDER_BYTES = 2 * 1024 * 1024;
const MAX_STORED_BYTES = 10 * 1024 * 1024;

export class PhotoReferenceError extends Error {
  constructor() {
    super("IDENTITY_VERIFICATION_REFERENCE_UNAVAILABLE");
  }
}

/** Converts a bound primary Storage object into a transient Didit reference. */
export async function preparePhotoReference(source: Buffer) {
  if (source.length === 0 || source.length > MAX_STORED_BYTES) throw new PhotoReferenceError();
  let metadata;
  try {
    metadata = await sharp(source, { failOn: "warning", limitInputPixels: 16_000_000 }).metadata();
  } catch {
    throw new PhotoReferenceError();
  }
  if (metadata.format !== "webp" || !metadata.width || !metadata.height
    || metadata.width > 1600 || metadata.height > 1600 || (metadata.pages ?? 1) !== 1) {
    throw new PhotoReferenceError();
  }

  let providerImage = source;
  if (source.length > MAX_PROVIDER_BYTES) {
    try {
      providerImage = await sharp(source, { failOn: "warning", limitInputPixels: 16_000_000 })
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
    } catch {
      throw new PhotoReferenceError();
    }
  }
  if (providerImage.length > MAX_PROVIDER_BYTES) throw new PhotoReferenceError();

  return {
    portraitImageBase64: providerImage.toString("base64"),
    sourceSha256: createHash("sha256").update(source).digest("hex"),
  };
}
