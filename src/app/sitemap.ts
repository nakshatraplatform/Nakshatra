import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/demo", "/received-a-link", "/waitlist", "/about", "/trust", "/privacy", "/terms"];
  return pages.map((path) => ({ url: `https://www.vivintro.com${path}`, changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : path === "/demo" ? 0.8 : 0.6 }));
}
