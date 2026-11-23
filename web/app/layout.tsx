import "./globals.css";
import { headers } from "next/headers";

export default async function Layout({children}: {children: React.ReactNode}) {
  const requestHeaders = await headers();
  return <html lang={requestHeaders.get("x-tallerya-locale")==="en" ? "en" : "es"}><body>{children}</body></html>;
}
