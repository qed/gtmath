import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function isSuperadmin(email: string): boolean {
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return superadminEmails.includes(email.toLowerCase());
}

const VALID_ACTIONS = ["reset_hb", "deactivate", "reactivate"] as const;
type AdminAction = (typeof VALID_ACTIONS)[number];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email || !isSuperadmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { action, childId } = body as { action: string; childId: string };

  if (!VALID_ACTIONS.includes(action as AdminAction)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!childId || !uuidRegex.test(childId)) {
    return NextResponse.json({ error: "Invalid childId" }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify child exists
  const { data: child } = await service
    .from("children")
    .select("id, name")
    .eq("id", childId)
    .single();

  if (!child) {
    return NextResponse.json({ error: "Child not found" }, { status: 404 });
  }

  if (action === "reset_hb") {
    await service.from("hb_transactions").insert({
      child_id: childId,
      type: "ADMIN_RESET",
      amount: 0,
      balance_after: 0,
    });
  } else if (action === "deactivate") {
    await service
      .from("children")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("id", childId);
  } else if (action === "reactivate") {
    await service
      .from("children")
      .update({ deactivated_at: null })
      .eq("id", childId);
  }

  // Audit log
  await service.from("admin_audit_log").insert({
    admin_email: user.email,
    action,
    target_child_id: childId,
  });

  return NextResponse.json({ success: true });
}
