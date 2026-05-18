import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/play/:path*",
    "/pin/:path*",
    "/login/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
