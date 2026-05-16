import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyChildJwt } from "@/lib/jwt";
import "./auth.css";
import { LandingCTA } from "./landing-cta";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const childToken = cookieStore.get("child_jwt")?.value;

  if (childToken) {
    const result = await verifyChildJwt(childToken);
    if (result) {
      redirect("/play");
    }
  }

  const params = await searchParams;
  const error = params.error;

  return (
    <div className="fm-login-overlay">
      <div className="fm-login-bg" />
      <div className="fm-login-card">
        <div className="fm-login-mark">
          <span className="fm-brand-mark-lg">⚡</span>
        </div>
        <h1 className="fm-login-title">GT Math</h1>
        <p className="fm-login-sub">
          Practice Fast Math. Climb Leaderboards. Earn Home Bucks.
        </p>

        <LandingCTA error={error} />

        <p className="fm-parents-note">For Parents — Coming Soon</p>
      </div>
    </div>
  );
}
