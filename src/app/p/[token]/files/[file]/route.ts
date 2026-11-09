import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { portfolioSharePathSchema } from "@/features/portfolio/share-path";
import {
  approvedPhotoKeyPattern,
  resolveApprovedHoroscope,
  resolveApprovedPhoto,
} from "@/features/portfolio/server/public-portfolio.service";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const photoTypes = new Map([
  ["jpeg", "image/jpeg"], ["jpg", "image/jpeg"], ["png", "image/png"],
  ["webp", "image/webp"], ["heic", "image/heic"], ["heif", "image/heif"],
]);

export async function GET(request: Request, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await params;
  const horoscope = file === "horoscope";
  const photoKey = file.startsWith("photo-") ? file.slice(6) : "";
  if (!portfolioSharePathSchema.safeParse(token).success || (!horoscope && !approvedPhotoKeyPattern.test(photoKey))) {
    return new Response(null, { status: 404, headers });
  }

  try {
    const viewer = await createClient();
    const { data: { user }, error: authError } = await viewer.auth.getUser();
    if (authError || !user?.email || !user.email_confirmed_at || user.is_anonymous) {
      return new Response(null, { status: 404, headers });
    }
    // These resolvers also verify that the Auth session and the approval are still live.
    const descriptor = horoscope
      ? await resolveApprovedHoroscope(viewer, token)
      : await resolveApprovedPhoto(viewer, token, photoKey);
    if (!descriptor) return new Response(null, { status: 404, headers });
    const contentType = horoscope ? "image/webp" : photoTypes.get(descriptor.accessPath.split(".").at(-1)?.toLowerCase() ?? "");
    if (!contentType) return new Response(null, { status: 404, headers });

    // The browser receives bytes from this route. The Storage credential stays server-side.
    const storage = createServiceRoleClient((input, init) => fetch(input, {
      ...init, redirect: "error", cache: "no-store",
    })).storage;
    const { data, error } = await storage.from(horoscope ? "horoscopes" : "photos")
      .download(descriptor.accessPath, {}, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]) }).asStream();
    if (error || !data) return new Response(null, { status: 503, headers });
    return new Response(data, { headers: { ...headers, "Content-Type": contentType } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
