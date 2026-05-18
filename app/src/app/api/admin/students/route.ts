import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function isSuperadmin(email: string): boolean {
  const superadminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return superadminEmails.includes(email.toLowerCase());
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email || !isSuperadmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();

  // Get all active children with stats
  const { data: children } = await service
    .from("children")
    .select("id, name, email, created_at, deactivated_at")
    .is("deactivated_at", null)
    .order("name");

  if (!children) {
    return NextResponse.json({ students: [], aggregate: {} });
  }

  const childIds = children.map((c) => c.id);

  // Get solve counts per child
  const { data: solveCounts } = await service
    .from("solves")
    .select("child_id")
    .in("child_id", childIds);

  const solveCountMap: Record<string, number> = {};
  for (const s of solveCounts ?? []) {
    solveCountMap[s.child_id] = (solveCountMap[s.child_id] ?? 0) + 1;
  }

  // Get latest HB balance per child
  const { data: latestHb } = await service
    .from("hb_transactions")
    .select("child_id, balance_after, created_at")
    .in("child_id", childIds)
    .order("created_at", { ascending: false });

  const balanceMap: Record<string, number> = {};
  for (const tx of latestHb ?? []) {
    if (!(tx.child_id in balanceMap)) {
      balanceMap[tx.child_id] = tx.balance_after;
    }
  }

  // Get last activity per child
  const { data: lastActivity } = await service
    .from("daily_activity")
    .select("child_id, active_date")
    .in("child_id", childIds)
    .order("active_date", { ascending: false });

  const lastActiveMap: Record<string, string> = {};
  for (const a of lastActivity ?? []) {
    if (!(a.child_id in lastActiveMap)) {
      lastActiveMap[a.child_id] = a.active_date;
    }
  }

  // Aggregate stats
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const { count: activeToday } = await service
    .from("daily_activity")
    .select("*", { count: "exact", head: true })
    .eq("active_date", today);

  const { count: solvesThisWeek } = await service
    .from("solves")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo);

  const students = children.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    hbBalance: balanceMap[c.id] ?? 0,
    totalSolves: solveCountMap[c.id] ?? 0,
    lastActive: lastActiveMap[c.id] ?? null,
  }));

  return NextResponse.json({
    students,
    aggregate: {
      totalStudents: children.length,
      activeToday: activeToday ?? 0,
      solvesThisWeek: solvesThisWeek ?? 0,
    },
  });
}
