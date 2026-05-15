"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

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
      <main className="flex-1 flex items-center justify-center p-[var(--s-5)]">
        <div className="w-full max-w-[400px] text-center">
          <h3 className="mb-[var(--s-5)]">Who's playing?</h3>
          {loadingChildren ? (
            <p className="text-ink-3">Loading...</p>
          ) : children.length === 0 ? (
            <div className="text-ink-3">
              <p className="mb-[var(--s-4)]">
                No players found. Ask a parent to create your profile first.
              </p>
              <a href="/login" className="text-alpha-blue font-medium hover:underline">
                Parent sign-in
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--s-3)]">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setChildId(child.id)}
                  className="h-14 bg-alpha-sky-soft text-alpha-blue font-semibold text-lg
                             hover:bg-alpha-sky active:scale-[0.98] transition-all cursor-pointer"
                  style={{
                    borderRadius: "var(--r-md)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {child.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-[var(--s-7)]">
            <a href="/login" className="text-ink-4 text-sm hover:underline">
              Parent sign-in
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-[var(--s-5)]">
      <div className="w-full max-w-[320px] text-center">
        <button
          onClick={() => {
            setChildId(null);
            setPin("");
            setError("");
          }}
          className="text-ink-4 text-sm mb-[var(--s-5)] hover:underline cursor-pointer"
        >
          ← Back
        </button>
        <h3 className="mb-[var(--s-5)]">Enter your PIN</h3>

        {/* PIN dots */}
        <div className="flex justify-center gap-[var(--s-3)] mb-[var(--s-5)]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full transition-colors"
              style={{
                backgroundColor:
                  i < pin.length ? "var(--alpha-blue)" : "var(--line)",
                transitionDuration: "var(--dur-fast)",
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-danger text-sm mb-[var(--s-3)]">{error}</p>
        )}

        {/* Keypad */}
        <div
          className="grid grid-cols-3 gap-[var(--s-3)] mx-auto"
          style={{ maxWidth: "256px" }}
        >
          {DIGITS.map((d, i) => (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              disabled={loading || d === ""}
              className="w-16 h-16 flex items-center justify-center text-2xl font-bold
                         bg-paper-2 hover:bg-alpha-sky-soft active:scale-95
                         disabled:opacity-0 transition-all cursor-pointer"
              style={{
                borderRadius: "var(--r-md)",
                fontFamily: "var(--font-display)",
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
