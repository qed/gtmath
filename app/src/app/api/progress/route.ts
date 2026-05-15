import { NextRequest, NextResponse } from "next/server";
import { verifyChildJwt } from "@/lib/jwt";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const childToken = request.cookies.get("child_jwt")?.value;
  if (!childToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await verifyChildJwt(childToken);
  if (!auth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: solves } = await supabase
    .from("solves")
    .select("mode")
    .eq("child_id", auth.childId);

  const modeCounts: Record<number, number> = {};
  for (const s of solves || []) {
    modeCounts[s.mode] = (modeCounts[s.mode] || 0) + 1;
  }

  const unlockThreshold = 5;
  const unlockedModes = [2];
  for (const m of [3, 4, 5, 6, 7, 8, 9]) {
    if ((modeCounts[m - 1] || 0) >= unlockThreshold) {
      unlockedModes.push(m);
    }
  }

  return NextResponse.json({ modeCounts, unlockedModes, unlockThreshold });
}
