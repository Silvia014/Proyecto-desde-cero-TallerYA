import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.TALLERYA_PUBLIC_URL;
  return {
    rules: {userAgent:"*", allow:"/", disallow:["/api/","/es/learn","/en/learn"]},
    sitemap: site ? new URL("/sitemap.xml",site).href : undefined,
  };
}
