import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.TALLERYA_PUBLIC_URL;
  return site && process.env.TALLERYA_DEMO !== "1" ? ["/es","/en"].map(path=>({url:new URL(path,site).href})) : [];
}
