import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabaseReady = Boolean(
  supabaseUrl && supabaseAnonKey && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
);
const publicPaths = ["/sign-in", "/access-denied"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!supabaseReady || !supabaseUrl || !supabaseAnonKey) {
    if (isPublicPath(pathname)) return NextResponse.next();
    if (request.method !== "GET" || pathname.startsWith("/api/")) {
      return new NextResponse("Supabase authentication is not configured.", {
        status: 503,
        headers: { "cache-control": "no-store" },
      });
    }
    return NextResponse.redirect(new URL("/sign-in?setup=supabase", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value);
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|pdf|txt)).*)", "/(api|trpc)(.*)"],
};
