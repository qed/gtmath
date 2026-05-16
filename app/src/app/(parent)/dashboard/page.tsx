"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { MODES } from "@/lib/solver";
import "../../auth.css";

interface ChildData {
  id: string;
  name: string;
  role: string;
  tutorialSeen: boolean;
  hbBalance: number;
  totalSolves: number;
  streakDays: number;
  unlockedModes: number[];
  createdAt: string;
}

const MILESTONES = [
  { threshold: 100, label: "Bronze", color: "#CD7F32" },
  { threshold: 500, label: "Silver", color: "#C0C0C0" },
  { threshold: 2000, label: "Gold", color: "#FFD700" },
];

function getBadge(balance: number) {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (balance >= MILESTONES[i].threshold) return MILESTONES[i];
  }
  return null;
}

function getNextMilestone(balance: number) {
  for (const m of MILESTONES) {
    if (balance < m.threshold) return m;
  }
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchChildren = useCallback(async () => {
    const res = await fetch("/api/children");
    if (res.ok) {
      const data = await res.json();
      setChildren(data.children);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  async function handleAddChild(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAdding(true);

    const res = await fetch("/api/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, pin: newPin }),
    });

    if (res.ok) {
      setShowAddChild(false);
      setNewName("");
      setNewPin("");
      fetchChildren();
    } else {
      const data = await res.json();
      setAddError(data.error || "Failed to create child");
    }
    setAdding(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="fm-login-overlay">
        <div className="fm-login-bg" />
        <p style={{ color: "var(--ink-3)", fontFamily: "var(--font-display)" }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--paper-2)" }}>
      <header className="fm-dash-header">
        <span className="fm-dash-brand">
          GTMath<span style={{ color: "var(--alpha-blue)" }}>52</span>
        </span>
        <nav className="fm-dash-nav">
          <a href="/leaderboard">Leaderboard</a>
          <a href="/play">Play</a>
          <button onClick={handleSignOut}>Sign out</button>
        </nav>
      </header>

      <main style={{ flex: 1, maxWidth: 1280, margin: "0 auto", width: "100%", padding: "48px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
          <div>
            <h3>Parent Dashboard</h3>
            <p style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic", color: "var(--ink-3)", marginTop: 4 }}>
              Track your child&apos;s progress
            </p>
          </div>
          <button className="fm-btn fm-btn-primary" onClick={() => setShowAddChild(true)}>
            + Add child
          </button>
        </div>

        {showAddChild && (
          <div className="fm-child-card" style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 16 }}>New player profile</h4>
            <form onSubmit={handleAddChild} className="fm-login-form">
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--ink-2)", marginBottom: 4 }}>
                  Child&apos;s first name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  maxLength={50}
                  className="fm-input"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--ink-2)", marginBottom: 4 }}>
                  4-digit PIN (child uses this to log in)
                </label>
                <input
                  type="text"
                  value={newPin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setNewPin(v);
                  }}
                  required
                  pattern="\d{4}"
                  inputMode="numeric"
                  maxLength={4}
                  className="fm-input"
                  style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.3em" }}
                />
              </div>
              {addError && (
                <div className="fm-pin-error">{addError}</div>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button type="submit" disabled={adding} className="fm-btn fm-btn-primary" style={{ padding: "12px 24px", fontSize: 14 }}>
                  {adding ? "Creating..." : "Create profile"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddChild(false); setAddError(""); }}
                  className="fm-link"
                  style={{ fontSize: 14 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {children.length === 0 && !showAddChild ? (
          <div className="fm-child-card" style={{ textAlign: "center", padding: "48px 32px" }}>
            <h4 style={{ marginBottom: 8 }}>Welcome to GTMath!</h4>
            <p style={{ color: "var(--ink-3)", marginBottom: 24 }}>
              Create a player profile for your child to get started. You&apos;ll set
              their name and a 4-digit PIN they&apos;ll use to log in.
            </p>
            <button className="fm-btn fm-btn-primary" onClick={() => setShowAddChild(true)}>
              + Add your first child
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))" }}>
            {children.map((child) => {
              const badge = getBadge(child.hbBalance);
              const next = getNextMilestone(child.hbBalance);
              return (
                <div key={child.id} className="fm-child-card">
                  <div className="fm-child-header">
                    <div className="fm-child-identity">
                      <span
                        className="fm-avatar"
                        style={{
                          width: 40,
                          height: 40,
                          fontSize: 18,
                          background: "var(--alpha-blue)",
                        }}
                      >
                        {child.name[0]?.toUpperCase()}
                      </span>
                      <div>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{child.name}</span>
                        {badge && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "var(--r-pill)",
                              background: badge.color + "22",
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="eyebrow" style={{ fontSize: 11 }}>{child.role}</span>
                  </div>

                  <div className="fm-stat-grid">
                    <div className="fm-stat">
                      <div className="fm-stat-value" style={{ color: "var(--alpha-blue)" }}>{child.totalSolves}</div>
                      <div className="fm-stat-label">Solves</div>
                    </div>
                    <div className="fm-stat">
                      <div className="fm-stat-value">{child.streakDays}</div>
                      <div className="fm-stat-label">Day streak</div>
                    </div>
                    <div className="fm-stat">
                      <div className="fm-stat-value" style={{ color: "var(--success)" }}>{Number.isInteger(Number(child.hbBalance)) ? String(Number(child.hbBalance)) : Number(child.hbBalance).toFixed(1)}</div>
                      <div className="fm-stat-label">Home Bucks</div>
                    </div>
                  </div>

                  <div className="fm-mode-tags">
                    {child.unlockedModes.map((m) => (
                      <span key={m} className="fm-mode-tag">
                        {MODES[m]?.label ?? `Mode ${m}`}
                      </span>
                    ))}
                  </div>

                  {next && (
                    <div className="fm-next-milestone">
                      Next: {next.label} at {next.threshold} HB ({Math.max(0, Math.ceil(next.threshold - Number(child.hbBalance)))} to go)
                    </div>
                  )}

                  <button
                    className="fm-play-as"
                    onClick={() => {
                      sessionStorage.setItem(
                        "pin_children",
                        JSON.stringify([{ id: child.id, name: child.name }])
                      );
                      router.push("/pin");
                    }}
                  >
                    Play as {child.name}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
