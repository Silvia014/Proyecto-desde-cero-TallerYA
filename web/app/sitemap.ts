import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.TALLERYA_PUBLIC_URL;
  return site ? ["/es","/en"].map(path=>({url:new URL(path,site).href})) : [];
}
