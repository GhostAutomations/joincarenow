import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/accept-invite",
  "/auth",
  "/careers",
  "/applicant",
  // One-tap interview response links (token-secured, no login).
  "/interview",
  // Referee reference forms (token-secured, no login).
  "/reference",
  // Job offer accept/decline links (token-secured, no login).
  "/offer",
  // Talent-pool opt-in links from rejection emails (token-secured, no login).
  "/talent-pool",
  // Guarded at the page level (redirects to the applicant sign-in, not staff).
  "/portal",
  // Inbound webhooks — authenticated by provider signature, not a user session.
  "/api/twilio",
  "/api/resend",
  // Hourly reminder cron — authenticated by CRON_SECRET bearer, not a session.
  "/api/cron",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/** Refreshes the Supabase session cookie and guards private routes. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
