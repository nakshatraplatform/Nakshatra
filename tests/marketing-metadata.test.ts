import { describe, expect, it, vi } from "vitest";

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(public element: unknown, public options: unknown) {}
  },
}));

import { metadata } from "../src/app/page";
import OpenGraphImage, { alt, contentType, size } from "../src/app/opengraph-image";

describe("marketing metadata", () => {
  it("uses the controlled-introduction category and consent promise", () => {
    expect(metadata.title).toEqual({ absolute: "Marriage biodata link you control | VivIntro" });
    expect(metadata.description).toMatch(/marriage biodata/i);
    expect(metadata.description).toMatch(/until you choose to share them/i);
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      title: "Your biodata, as one link you control.",
      description: metadata.description,
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Your biodata, as one link you control.",
      description: metadata.description,
    });
    expect(metadata.alternates?.canonical).toBe("/");
  });

  it("defines a large, accessible root social preview", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(alt).toMatch(/VivIntro/i);
    expect(OpenGraphImage()).toMatchObject({ options: size });
  });
});
