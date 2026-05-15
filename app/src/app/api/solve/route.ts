import { NextRequest, NextResponse } from "next/server";
import { verifyChildJwt } from "@/lib/jwt";
import { verify } from "@/lib/verify";
import { comboKey } from "@/lib/solver";
import { createServiceClient } from "@/lib/supabase/server";
import type { SolvePayload } from "@/lib/types";

export async function POST(request: NextRequest) {
  const childToken = request.cookies.get("child_jwt")?.value;
  if (!childToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await verifyChildJwt(childToken);
  if (!auth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const payload: SolvePayload = await request.json();
  const { expression, target, mode, timeMs, cards, offline } = payload;

  if (!expression || !target || !mode || !timeMs || !cards) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const result = verify(expression, target, mode, timeMs, cards);
  if (!result.valid) {
    return NextResponse.json(
      { error: "verification_failed", detail: result.error },
      { status: 400 }
    );
  }

  const combo = comboKey(mode, target, cards);
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("record_solve", {
    p_child_id: auth.childId,
    p_mode: mode,
    p_target: target,
    p_combo: combo,
    p_time_ms: timeMs,
    p_expression: expression,
    p_offline: offline ?? false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    hbEarned: data.hb_earned,
    newBalance: data.new_balance,
    streakDays: data.streak_days,
    speedBonus: data.speed_bonus ?? 0,
  });
}
