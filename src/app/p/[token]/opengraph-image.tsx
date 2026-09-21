import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { resolvePublicPortfolio } from "@/features/portfolio/server/public-portfolio.service";

export const alt = "A private marriage introduction shared through VivIntro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const primaryLogoData = await readFile(join(process.cwd(), "public/brand/vivintro/vivintro-lockup-stacked-primary-og.png"), "base64");
const reverseLogoData = await readFile(join(process.cwd(), "public/brand/vivintro/vivintro-lockup-stacked-reverse-og.png"), "base64");
const primaryLogoSrc = `data:image/png;base64,${primaryLogoData}`;
const reverseLogoSrc = `data:image/png;base64,${reverseLogoData}`;

/**
 * Generates a privacy-minimised social preview from the sanitized public snapshot.
 */
export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const snapshot = await resolvePublicPortfolio(supabase, token);
  const data = snapshot?.data;
  const foreground = isLightColor(snapshot?.themeColor) ? "#17151c" : "#fffdf8";
  const firstName = data?.personal?.first_name || data?.personal?.name?.split(" ")[0] || "A VivIntro member";
  const background = snapshot?.themeColor || "#17151c";

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background,
          color: foreground,
          display: "flex",
          height: "100%",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "64px",
            position: "relative" as const,
            width: "100%",
          }}
        >
          <div style={{ display: "flex" }}>
            {/* next/image is not supported inside ImageResponse rendering. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={isLightColor(snapshot?.themeColor) ? primaryLogoSrc : reverseLogoSrc} alt="" width={150} height={128} />
          </div>
          <div style={{ color: foreground, display: "flex", fontFamily: "serif", fontSize: 78, marginTop: 18 }}>
            {firstName}’s introduction
          </div>
          <div style={{ color: foreground, display: "flex", fontSize: 28, marginTop: 18, opacity: 0.86 }}>Private details require the owner’s approval</div>
        </div>
      </div>
    ),
    size
  );
}

/** Determines whether a hex background requires dark preview typography. Input: optional hex colour. Output: lightness decision. */
function isLightColor(color?: string | null) {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return false;
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 155;
}
