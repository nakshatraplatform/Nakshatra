import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BiodataTemplate } from "@/components/templates";
import { getAuthenticatedUser } from "@/lib/auth";
import { loadOwnerApprovedPreview } from "@/features/portfolio/server/owner-preview.service";
import { getCelestialAppearance } from "@/features/portfolio/celestial-theme";

export const metadata: Metadata = {
  title: "Private details preview",
  robots: { index: false, follow: false },
};

export default async function ApprovedPreviewPage() {
  const { supabase, user } = await getAuthenticatedUser();
  const preview = await loadOwnerApprovedPreview(supabase, user.id);
  if (!preview) redirect("/dashboard?edit=1");
  const { portfolio, data, photos, horoscopeAttachment } = preview;

  return (
    <div className="flex flex-1 flex-col" style={{ colorScheme: getCelestialAppearance(data.style) }}>
      <div className="flex-1">
        <BiodataTemplate
          templateId={portfolio.template_id}
          data={data}
          sunSign={portfolio.sun_sign}
          accessMode="owner"
          photos={photos}
          horoscopeAttachment={horoscopeAttachment}
        />
      </div>
    </div>
  );
}
