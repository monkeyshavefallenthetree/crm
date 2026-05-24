import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Check for local MFT session (fallback when Supabase Auth is unavailable)
  const mftSession = request.cookies.get('mft_session')?.value;
  // Legacy demo bypass cookie
  const isDemo = request.cookies.get('demo_bypass')?.value === 'true';

  const isAuthenticated = !!user || !!mftSession || isDemo;

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard") && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users from login to dashboard
  if (request.nextUrl.pathname === "/" && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.webp|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
