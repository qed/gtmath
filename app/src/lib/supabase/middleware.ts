import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifyChildJwt } from "@/lib/jwt";

function isSuperadmin(email: string): boolean {
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return superadminEmails.includes(email.toLowerCase());
}

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
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Gate legacy parent routes
  if (
    path.startsWith("/login") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/pin")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Gate /play — require valid child_jwt signature
  if (path.startsWith("/play")) {
    const childToken = request.cookies.get("child_jwt")?.value;
    if (!childToken) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    const verified = await verifyChildJwt(childToken);
    if (!verified) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Gate /admin and /api/admin — require Supabase session + superadmin email
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    if (!user || !user.email || !isSuperadmin(user.email)) {
      if (path.startsWith("/api/admin")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}
