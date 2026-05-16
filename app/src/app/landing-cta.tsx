"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function LandingCTA({ error }: { error?: string }) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  };

  return (
    <div className="fm-login-form">
      {error && (
        <div className="fm-alert-error">
          {error === "deactivated"
            ? "Your account has been deactivated. Contact your teacher."
            : "GT Math is for Alpha and GT students. Please sign in with your @gt.school email."}
        </div>
      )}

      <p className="fm-cta-context">For existing Alpha or GT Students</p>

      <button
        className="fm-btn fm-btn-primary"
        onClick={handleSignIn}
        disabled={loading}
      >
        {loading ? "Signing in..." : "Join with your Alpha or GT email"}
      </button>
    </div>
  );
}
