import "server-only";

const productionOrigin = "https://www.vivintro.com";

/** Keep live email links on VivIntro even when the build's public URL is missing or malformed. */
export function notificationAppOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const url = configured ? URL.parse(configured) : null;
  const usable = url && !url.username && !url.password;
  if (process.env.VERCEL_ENV === "production") {
    if (usable && (url.origin === productionOrigin || url.origin === "https://vivintro.com")) return url.origin;
    return productionOrigin;
  }
  if (usable && (url.protocol === "https:" || (
    url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ))) return url.origin;
  return null;
}
