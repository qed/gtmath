import { NextRequest, NextResponse } from "next/server";
import { verifyChildJwt } from "@/lib/jwt";
import { createServiceClient } from "@/lib/supabase/server";
import type { RankData } from "@/lib/types";

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

  const [{ data: solves }, { data: child }, { data: balanceRow }] = await Promise.all([
    supabase.from("solves").select("mode").eq("child_id", auth.childId),
    supabase.from("children").select("tutorial_seen").eq("id", auth.childId).single(),
    supabase
      .from("hb_transactions")
      .select("balance_after")
      .eq("child_id", auth.childId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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

  const rankPromises = unlockedModes.map((m) =>
    supabase.rpc("child_leaderboard_rank", {
      p_child_id: auth.childId,
      p_mode: m,
      p_period: "week",
    }).then(({ data, error }) => {
      if (error) console.error(`child_leaderboard_rank mode ${m}:`, error.message);
      return [m, data] as const;
    })
  );
  const rankResults = await Promise.all(rankPromises);

  const ranks: Record<number, RankData> = {};
  for (const [m, data] of rankResults) {
    const row = Array.isArray(data) ? data[0] : data;
    ranks[m] = {
      position: row?.rank ?? null,
      avgTimeMs: row?.avg_time_ms ?? null,
      totalRanked: row?.total_ranked ?? 0,
      solveCount: row?.solve_count ?? 0,
    };
  }

  return NextResponse.json({
    modeCounts,
    unlockedModes,
    unlockThreshold,
    tutorialSeen: child?.tutorial_seen ?? false,
    ranks,
    balance: Number(balanceRow?.balance_after ?? 0),
  });
}
