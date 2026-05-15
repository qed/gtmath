"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import "../../auth.css";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export default function PinPage() {
  const router = useRouter();
  const [childId, setChildId] = useState<string | null>(null);
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("pin_children");
    if (stored) {
      const parsed = JSON.parse(stored);
      setChildren(parsed);
      setLoadingChildren(false);
      return;
    }
    setLoadingChildren(false);
  }, []);

  const handleDigit = useCallback(
    (digit: string) => {
      if (digit === "⌫") {
        setPin((p) => p.slice(0, -1));
        setError("");
        return;
      }
      if (digit === "") return;
      if (pin.length >= 4) return;
      const next = pin + digit;
      setPin(next);
      setError("");

      if (next.length === 4 && childId) {
        submitPin(childId, next);
      }
    },
    [pin, childId]
  );

  async function submitPin(cid: string, p: string) {
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/child-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: cid, pin: p }),
    });

    if (res.ok) {
      router.push("/play");
    } else {
      const data = await res.json();
      setError(data.error || "Wrong PIN");
      setPin("");
      setLoading(false);
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      if (e.key === "Backspace") handleDigit("⌫");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleDigit]);

  if (!childId) {
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
          <p className="fm-login-sub">Who&apos;s playing?</p>

          {loadingChildren ? (
            <p style={{ color: "var(--ink-3)" }}>Loading...</p>
          ) : children.length === 0 ? (
            <div style={{ color: "var(--ink-3)" }}>
              <p style={{ marginBottom: 16 }}>
                No players found. Ask a parent to create your profile first.
              </p>
              <a href="/login" className="fm-link">
                Parent sign-in →
              </a>
            </div>
          ) : (
            <>
              <div className="fm-user-list">
                {children.map((child) => (
                  <button
                    key={child.id}
                    className="fm-user-row"
                    onClick={() => setChildId(child.id)}
                  >
                    <span
                      className="fm-avatar"
                      style={{
                        width: 36,
                        height: 36,
                        fontSize: 16,
                        background: "var(--alpha-blue)",
                      }}
                    >
                      {child.name[0]?.toUpperCase()}
                    </span>
                    <span className="fm-user-row-name">{child.name}</span>
                    <span className="fm-user-row-arrow">→</span>
                  </button>
                ))}
              </div>
              <a href="/login" className="fm-link" style={{ marginTop: 18 }}>
                Parent sign-in
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fm-login-overlay">
      <div className="fm-login-bg" />
      <div className="fm-login-card">
        <button
          onClick={() => {
            setChildId(null);
            setPin("");
            setError("");
          }}
          className="fm-link"
          style={{ alignSelf: "flex-start", marginBottom: 8 }}
        >
          ← Back
        </button>

        <div className="fm-login-mark">
          <span className="fm-brand-mark-lg">⚡</span>
        </div>
        <h1 className="fm-login-title" style={{ fontSize: 28 }}>
          Enter your PIN
        </h1>

        <div className="fm-pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`fm-pin-dot ${i < pin.length ? "is-on" : ""}`}
            />
          ))}
        </div>

        {error && <div className="fm-pin-error">{error}</div>}

        <div className="fm-pin-pad">
          {DIGITS.map((d, i) => (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              disabled={loading || d === ""}
              className={`fm-pin-key ${d === "⌫" ? "is-backspace" : ""}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
