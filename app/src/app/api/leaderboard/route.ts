import { NextRequest, NextResponse } from "next/server";
import { verifyChildJwt } from "@/lib/jwt";
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

  let qualify: { solveCount: number; needed: number } | null = null;
  const childToken = request.cookies.get("child_jwt")?.value;
  if (childToken) {
    const auth = await verifyChildJwt(childToken);
    if (auth) {
      const already = (data ?? []).some((e: { child_id: string }) => e.child_id === auth.childId);
      if (!already) {
        const { count } = await supabase
          .from("solves")
          .select("id", { count: "exact", head: true })
          .eq("child_id", auth.childId)
          .eq("mode", mode);
        const c = count ?? 0;
        if (c < 10) {
          qualify = { solveCount: c, needed: 10 - c };
        }
      }
    }
  }

  return NextResponse.json({ entries: data ?? [], qualify });
}
