import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const mode = Number(url.searchParams.get("mode") ?? 4);
  const metric = url.searchParams.get("metric") ?? "solves";
  const period = url.searchParams.get("period") ?? "all";

  if (mode < 2 || mode > 9) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
  if (!["solves", "fastest"].includes(metric)) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  const supabase = createServiceClient();

  let dateFilter = "";
  if (period === "today") {
    dateFilter = `AND s.created_at >= CURRENT_DATE`;
  } else if (period === "week") {
    dateFilter = `AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'`;
  }

  if (metric === "solves") {
    const { data, error } = await supabase.rpc("leaderboard_solves", {
      p_mode: mode,
      p_period: period,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data ?? [] });
  }

  // metric === "fastest"
  const { data, error } = await supabase.rpc("leaderboard_fastest", {
    p_mode: mode,
    p_period: period,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}
