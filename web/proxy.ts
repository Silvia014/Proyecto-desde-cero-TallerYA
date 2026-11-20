import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-tallerya-locale", request.nextUrl.pathname.startsWith("/en") ? "en" : "es");
  return NextResponse.next({request:{headers}});
}
export const config = { matcher: ["/es/:path*", "/en/:path*"] };
