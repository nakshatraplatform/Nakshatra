import { getAuthenticatedUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BiodataTemplate } from "@/components/templates";
import type { Metadata } from "next";
import { loadOwnerPublicPreview } from "@/features/portfolio/server/owner-preview.service";
import { getCelestialAppearance } from "@/features/portfolio/celestial-theme";
import type { PortfolioData } from "@/types/portfolio";

export const metadata: Metadata = {
  title: "Public introduction preview",
  robots: { index: false, follow: false },
};

export default async function PreviewPage() {
  const { supabase, user } = await getAuthenticatedUser();
  const preview = await loadOwnerPublicPreview(supabase, user.id);
  if (!preview) redirect("/dashboard?edit=1");
  const { portfolio, data, photos } = preview;
  const sunSign = portfolio.sun_sign;
  const previousSharingSetup = (portfolio.draft_data as PortfolioData).privacy_mode === "private";

  return (
    <div className="flex flex-1 flex-col" style={{ colorScheme: getCelestialAppearance(data.style) }}>
      {previousSharingSetup && <p className="px-4 py-3 text-sm text-[color:var(--workspace-ink)]">Your active link remains unchanged until you review and publish</p>}

      <div className="flex-1">
        <BiodataTemplate
          templateId={portfolio.template_id}
          data={data}
          sunSign={sunSign}
          accessMode="public"
          photos={photos}
        />
      </div>
    </div>
  );
}
