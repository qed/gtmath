import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { mintChildJwt } from "@/lib/jwt";

const ALLOWED_NEXT = ["/play", "/admin"];

function isEmailAllowed(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowedDomains.includes(domain) || superadminEmails.includes(email.toLowerCase());
}

function isSuperadmin(email: string): boolean {
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return superadminEmails.includes(email.toLowerCase());
}

function extractDisplayName(fullName: string | undefined, email: string): string {
  if (fullName && fullName.trim().length > 0) return fullName.trim();
  const prefix = email.split("@")[0];
  return prefix
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const email = user.email;

  // Domain enforcement
  if (!isEmailAllowed(email)) {
    await supabase.auth.signOut();
    const service = createServiceClient();
    try {
      await service.auth.admin.deleteUser(user.id);
    } catch {
      // Best-effort cleanup — orphan auth.users row has no impact
    }
    return NextResponse.redirect(`${origin}/?error=domain`);
  }

  // Find or create child
  const service = createServiceClient();
  const { data: existingChild } = await service
    .from("children")
    .select("id, deactivated_at")
    .eq("supabase_uid", user.id)
    .maybeSingle();

  let childId: string;

  if (existingChild) {
    // Check deactivation
    if (existingChild.deactivated_at) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/?error=deactivated`);
    }
    childId = existingChild.id;
  } else {
    // Create new child via SSO function
    const displayName = extractDisplayName(
      user.user_metadata?.full_name,
      email
    );
    const { data, error: rpcError } = await service.rpc("create_child_sso", {
      p_supabase_uid: user.id,
      p_name: displayName,
      p_email: email,
    });

    if (rpcError || !data) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }
    childId = data;
  }

  // Mint child_jwt
  const token = await mintChildJwt(childId);

  // Determine redirect destination
  const nextParam = searchParams.get("next");
  let destination: string;
  if (nextParam && ALLOWED_NEXT.includes(nextParam)) {
    destination = nextParam;
  } else {
    destination = isSuperadmin(email) ? "/admin" : "/play";
  }

  const response = NextResponse.redirect(`${origin}${destination}`);
  response.cookies.set("child_jwt", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });

  return response;
}
