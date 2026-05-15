"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-[var(--s-5)]">
      <div
        className="w-full max-w-[400px] p-[var(--s-7)] text-center"
        style={{ borderRadius: "var(--r-lg)" }}
      >
        <h2 className="mb-[var(--s-2)]">GTMath</h2>
        <p
          className="text-ink-3 mb-[var(--s-7)]"
          style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", fontSize: "20px" }}
        >
          Parent sign-in
        </p>

        {sent ? (
          <div
            className="bg-alpha-sky-soft p-[var(--s-5)] text-center"
            style={{ borderRadius: "var(--r-md)" }}
          >
            <p className="font-semibold text-alpha-blue mb-[var(--s-2)]">
              Check your email
            </p>
            <p className="text-ink-3 text-sm">
              We sent a magic link to <strong>{email}</strong>. Click it to sign
              in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-left text-sm font-medium text-ink-2 mb-[var(--s-1)]">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="parent@example.com"
              className="w-full h-12 px-[var(--s-4)] border border-line text-[17px] outline-none
                         focus:border-alpha-blue transition-colors"
              style={{ borderRadius: "var(--r-sm)" }}
            />
            {error && (
              <p className="text-danger text-sm mt-[var(--s-2)]">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-[var(--s-4)] bg-alpha-blue text-white font-semibold
                         hover:bg-alpha-blue-600 active:bg-alpha-blue-700
                         disabled:opacity-50 transition-colors cursor-pointer"
              style={{
                borderRadius: "var(--r-pill)",
                fontFamily: "var(--font-display)",
              }}
            >
              {loading ? "Sending..." : "Send magic link"}
            </button>
          </form>
        )}

        <div className="mt-[var(--s-7)] pt-[var(--s-5)] border-t border-line">
          <a
            href="/pin"
            className="text-alpha-blue font-medium hover:underline text-sm"
          >
            Child? Enter your PIN instead
          </a>
        </div>
      </div>
    </main>
  );
}
