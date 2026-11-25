import { NextRequest, NextResponse } from "next/server";

const cookie = "tallerya_session";
const backend = (process.env.TALLERYA_API || "http://127.0.0.1:8000").replace(/\/+$/, "");
const routes = [
  /^register$/, /^login$/, /^telemetry$/, /^me(?:\/preferences|\/bookings(?:\/\d+\/(?:cancel|certificate))?)?$/,
  /^workshops(?:\/\d+(?:\/(?:book|interest))?)?$/,
  /^admin\/(?:telemetry|overview|teachers|users(?:\/\d+(?:\/(?:role|password))?)?|workshops(?:\/\d+(?:\/(?:settlement|archive))?)?|bookings(?:\/\d+(?:\/(?:payment-sent|paid|refund|certificate|cancel))?)?)$/,
];

async function proxy(request: NextRequest, {params}: {params: Promise<{path:string[]}>}) {
  const path = (await params).path.join("/");
  const write = request.method !== "GET";
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const publicOrigins = [process.env.TALLERYA_PUBLIC_URL,process.env.TALLERYA_LEARN_URL,process.env.TALLERYA_TEST_ORIGIN]
    .filter((value): value is string => Boolean(value))
    .map(value=>new URL(value).origin);
  // Standalone Next.js can normalize request.url to its bind address inside Docker.
  const incomingOrigin = host ? request.nextUrl.protocol + "//" + host : null;
  if (write && (!origin || ![request.nextUrl.origin,incomingOrigin,...publicOrigins].includes(origin))) {
    return NextResponse.json({detail:"origin_not_allowed"}, {status:403});
  }
  if (path === "logout" && request.method === "POST") {
    const response = new NextResponse(null, {status:204});
    response.cookies.delete(cookie);
    return response;
  }
  if (!routes.some(route => route.test(path))) return new NextResponse(null,{status:404});
  const headers = new Headers();
  const type = request.headers.get("content-type");
  if (type) headers.set("content-type", type);
  const token = request.cookies.get(cookie)?.value;
  if (token && path !== "telemetry") headers.set("authorization", "Bearer " + token);
  let upstream: Response;
  try {
    upstream = await fetch(backend + "/" + path, {
      method: request.method, headers, body: write && type ? await request.arrayBuffer() : undefined,
      cache:"no-store",
    });
  } catch {
    return NextResponse.json({detail:"service_unavailable"},{status:503});
  }
  if (path === "login" && upstream.ok) {
    const data = await upstream.json();
    const response = NextResponse.json({user:data.user});
    response.cookies.set(cookie,data.token,{httpOnly:true,sameSite:"lax",secure:request.nextUrl.protocol==="https:",path:"/",maxAge:7200});
    return response;
  }
  const output = new Headers({"cache-control":"no-store"});
  for (const header of ["content-type","content-disposition"]) {
    const value = upstream.headers.get(header);
    if (value) output.set(header,value);
  }
  return new NextResponse(upstream.body, {status:upstream.status,headers:output});
}

export {proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE};
