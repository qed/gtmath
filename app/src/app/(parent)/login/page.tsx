"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "../../auth.css";

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
    <div className="fm-login-overlay">
      <div className="fm-login-bg" />
      <div className="fm-login-card">
        <div className="fm-login-mark">
          <span className="fm-brand-mark-lg">⚡</span>
        </div>
        <h1 className="fm-login-title">
          GTMath<span style={{ color: "var(--alpha-blue)" }}>52</span>
        </h1>
        <p className="fm-login-sub">Parent sign-in</p>

        {sent ? (
          <div
            style={{
              width: "100%",
              padding: "20px",
              background: "var(--alpha-sky-soft)",
              borderRadius: "var(--r-md)",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--alpha-blue)",
                marginBottom: 8,
              }}
            >
              Check your email
            </p>
            <p style={{ color: "var(--ink-3)", fontSize: 14 }}>
              We sent a magic link to <strong>{email}</strong>. Click it to sign
              in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="fm-login-form">
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--ink-2)",
                  marginBottom: 4,
                }}
              >
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="parent@example.com"
                className="fm-input"
              />
            </div>
            {error && <div className="fm-pin-error">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="fm-btn fm-btn-primary"
              style={{ justifyContent: "center" }}
            >
              {loading ? "Sending..." : "Send magic link"}
            </button>
          </form>
        )}

        <a
          href="/pin"
          className="fm-link"
          style={{ marginTop: 18 }}
        >
          Child? Enter your PIN instead →
        </a>
      </div>
    </div>
  );
}
