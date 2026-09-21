import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const logoData = await readFile(join(process.cwd(), "public/brand/vivintro/vivintro-lockup-stacked-primary-og.png"), "base64");
const logoSrc = `data:image/png;base64,${logoData}`;

export const alt = "VivIntro — Private marriage introductions you control";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "68px",
          background: "#f8f6f0",
          color: "#162a33",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "2px solid #d9d7ce",
            borderRadius: "28px",
            padding: "52px 58px",
            background: "#fffdf8",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* next/image is not supported inside ImageResponse rendering. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="" width={120} height={102} />
            </div>
            <div style={{ display: "flex", border: "1px solid #8db7b1", borderRadius: "999px", padding: "10px 18px", background: "#e5efeb", color: "#174b55", fontFamily: "Arial, sans-serif", fontSize: 18, fontWeight: 700 }}>
              INVITE-ONLY PRIVATE BETA
            </div>
          </div>

          <div style={{ display: "flex", maxWidth: "930px", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 76, lineHeight: 1.02, letterSpacing: "-0.04em" }}>
              Make the introduction. Keep the decision.
            </div>
            <div style={{ display: "flex", maxWidth: "870px", marginTop: "28px", color: "#52666d", fontFamily: "Arial, sans-serif", fontSize: 27, lineHeight: 1.45 }}>
              One private marriage introduction link. Contact details and documents stay protected until the owner approves access.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#246d75", fontFamily: "Arial, sans-serif", fontSize: 20, fontWeight: 700 }}>
            <span>Shared introduction</span><span>→</span><span>Confirmed email</span><span>→</span><span>Owner approval</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
