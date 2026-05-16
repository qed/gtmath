import { NextRequest, NextResponse } from "next/server";
import { verifyChildJwt } from "@/lib/jwt";
import { createServiceClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const childToken = request.cookies.get("child_jwt")?.value;
  if (!childToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await verifyChildJwt(childToken);
  if (!auth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("children")
    .update({ tutorial_seen: true })
    .eq("id", auth.childId);

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
