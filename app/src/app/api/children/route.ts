import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: links } = await service
    .from("parent_children")
    .select("child_id, role, children(id, name, tutorial_seen, created_at)")
    .eq("parent_id", user.id);

  if (!links) {
    return NextResponse.json({ children: [] });
  }

  const children = await Promise.all(
    links.map(async (link: any) => {
      const child = link.children;
      const { data: lastTxn } = await service
        .from("hb_transactions")
        .select("balance_after")
        .eq("child_id", child.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { count: solveCount } = await service
        .from("solves")
        .select("id", { count: "exact", head: true })
        .eq("child_id", child.id);

      const { data: activity } = await service
        .from("daily_activity")
        .select("active_date")
        .eq("child_id", child.id)
        .order("active_date", { ascending: false })
        .limit(30);

      let streakDays = 0;
      if (activity && activity.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 0; i < activity.length; i++) {
          const d = new Date(activity[i].active_date);
          d.setHours(0, 0, 0, 0);
          const expected = new Date(today);
          expected.setDate(expected.getDate() - i);
          if (d.getTime() === expected.getTime()) {
            streakDays++;
          } else {
            break;
          }
        }
      }

      const { data: modeData } = await service
        .from("solves")
        .select("mode")
        .eq("child_id", child.id);

      const modeCounts: Record<number, number> = {};
      for (const s of modeData || []) {
        modeCounts[s.mode] = (modeCounts[s.mode] || 0) + 1;
      }

      const unlockedModes = [2];
      for (const m of [3, 4, 5]) {
        if ((modeCounts[m - 1] || 0) >= 5) {
          unlockedModes.push(m);
        }
      }

      return {
        id: child.id,
        name: child.name,
        role: link.role,
        tutorialSeen: child.tutorial_seen,
        hbBalance: lastTxn?.balance_after ?? 0,
        totalSolves: solveCount ?? 0,
        streakDays,
        unlockedModes,
        createdAt: child.created_at,
      };
    })
  );

  return NextResponse.json({ children });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, pin } = await request.json();

  if (!name || typeof name !== "string" || name.trim().length < 1 || name.trim().length > 50) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  if (!pin || typeof pin !== "string" || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const service = createServiceClient();

  const { data, error } = await service.rpc("create_child", {
    p_parent_id: user.id,
    p_name: name.trim(),
    p_pin_hash: pinHash,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ childId: data }, { status: 201 });
}
