import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { mintChildJwt } from "@/lib/jwt";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const { childId, pin } = await request.json();

  if (!childId || !pin || typeof pin !== "string" || pin.length !== 4) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: child, error } = await supabase
    .from("children")
    .select("id, pin_hash, name")
    .eq("id", childId)
    .single();

  if (error || !child) {
    return NextResponse.json({ error: "Child not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(pin, child.pin_hash);
  if (!valid) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }

  const token = await mintChildJwt(child.id);

  const response = NextResponse.json({
    childId: child.id,
    name: child.name,
  });

  response.cookies.set("child_jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
