import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/account/", "/admin/", "/brokerdesk/", "/dashboard/", "/edit/", "/preview/", "/approved-preview/", "/access/", "/verify/"] }],
    sitemap: "https://www.vivintro.com/sitemap.xml",
    host: "https://www.vivintro.com",
  };
}
