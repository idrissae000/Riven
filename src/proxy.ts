import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicSupabaseEnv } from "@/lib/env";

/**
 * Sign-in is OPTIONAL. This only refreshes the Supabase session cookie when someone is signed in
 * (and sends signed-in users away from /login). Nothing is gated here: features that need an account
 * (saving rivens, Warframe Market listing, screenshot scan) check for a user in their own routes/pages.
 */
export async function proxy(request: NextRequest) {
  const env = publicSupabaseEnv();
  const { pathname } = request.nextUrl;

  if (!env) {
    if (pathname.startsWith("/setup") || pathname.startsWith("/_next")) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  // Visitors with no auth cookie have nothing to refresh — skip the work.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasSession) return response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (data?.claims && pathname === "/login") return NextResponse.redirect(new URL("/rivens", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
