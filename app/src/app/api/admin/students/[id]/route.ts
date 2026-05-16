import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function isSuperadmin(email: string): boolean {
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return superadminEmails.includes(email.toLowerCase());
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email || !isSuperadmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: child } = await service
    .from("children")
    .select("id, name, email, created_at, deactivated_at")
    .eq("id", id)
    .single();

  if (!child) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Solve history (last 100)
  const { data: solves } = await service
    .from("solves")
    .select("id, mode, target, time_ms, hb_earned, created_at")
    .eq("child_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  // HB transactions (last 50)
  const { data: transactions } = await service
    .from("hb_transactions")
    .select("id, type, amount, balance_after, created_at")
    .eq("child_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Speed trends: avg time per mode
  const { data: speedData } = await service
    .from("solves")
    .select("mode, time_ms")
    .eq("child_id", id);

  const speedByMode: Record<number, { total: number; count: number }> = {};
  for (const s of speedData ?? []) {
    if (!speedByMode[s.mode]) speedByMode[s.mode] = { total: 0, count: 0 };
    speedByMode[s.mode].total += s.time_ms;
    speedByMode[s.mode].count += 1;
  }

  const speedTrends = Object.entries(speedByMode).map(([mode, data]) => ({
    mode: Number(mode),
    avgTimeMs: Math.round(data.total / data.count),
    solveCount: data.count,
  }));

  return NextResponse.json({
    child,
    solves: solves ?? [],
    transactions: transactions ?? [],
    speedTrends,
  });
}
