import "./globals.css";
import { headers } from "next/headers";
import {contactEmail,contactPhone,phoneHref} from "./contact";

export default async function Layout({children}: {children: React.ReactNode}) {
  const requestHeaders = await headers();
  const en=requestHeaders.get("x-tallerya-locale")==="en";
  const locale=en?"en":"es";
  return <html lang={locale}><body>
    {children}
    <footer className="border-t border-sand bg-peach/20">
      <div className="shell flex flex-wrap items-center gap-x-6 gap-y-3 py-6">
        <strong>TallerYA · Bogotá</strong>
        <a href={phoneHref} className="underline" aria-label={`${en?"Call":"Llamar al"} ${contactPhone}`}>{contactPhone}</a>
        <a href={`mailto:${contactEmail}`} className="underline">{contactEmail}</a>
        <a href={`/${locale}/privacy`} className="underline">{en?"Privacy notice":"Aviso de privacidad"}</a>
      </div>
    </footer>
  </body></html>;
}
