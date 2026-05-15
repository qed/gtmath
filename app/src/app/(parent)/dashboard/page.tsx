"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
      <main className="flex-1 flex items-center justify-center">
        <p className="text-ink-3">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--paper-2)" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-[var(--s-5)] h-14 bg-paper border-b border-line">
        <span
          className="font-bold text-lg"
          style={{ fontFamily: "var(--font-display)" }}
        >
          GTMath
        </span>
        <div className="flex items-center gap-[var(--s-4)]">
          <a href="/play" className="text-alpha-blue text-sm font-medium hover:underline">
            Play
          </a>
          <button
            onClick={handleSignOut}
            className="text-ink-4 text-sm hover:text-ink-2 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1280px] mx-auto w-full px-[var(--s-5)] py-[var(--s-7)]">
        <div className="flex items-center justify-between mb-[var(--s-7)]">
          <div>
            <h3>Parent Dashboard</h3>
            <p
              className="text-ink-3 mt-[var(--s-1)]"
              style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic" }}
            >
              Track your child's progress
            </p>
          </div>
          <button
            onClick={() => setShowAddChild(true)}
            className="px-[var(--s-5)] h-12 bg-alpha-blue text-white font-semibold
                       hover:bg-alpha-blue-600 transition-colors cursor-pointer"
            style={{
              borderRadius: "var(--r-pill)",
              fontFamily: "var(--font-display)",
            }}
          >
            + Add child
          </button>
        </div>

        {/* Add child form */}
        {showAddChild && (
          <div
            className="bg-paper p-[var(--s-5)] mb-[var(--s-5)]"
            style={{
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h4 className="mb-[var(--s-4)]">New player profile</h4>
            <form onSubmit={handleAddChild} className="flex flex-col gap-[var(--s-3)]">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-[var(--s-1)]">
                  Child's first name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full h-12 px-[var(--s-4)] border border-line text-[17px] outline-none
                             focus:border-alpha-blue transition-colors"
                  style={{ borderRadius: "var(--r-sm)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-[var(--s-1)]">
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
                  className="w-full h-12 px-[var(--s-4)] border border-line text-[17px] outline-none
                             focus:border-alpha-blue transition-colors tracking-[0.3em]"
                  style={{
                    borderRadius: "var(--r-sm)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
              {addError && (
                <p className="text-danger text-sm">{addError}</p>
              )}
              <div className="flex gap-[var(--s-3)]">
                <button
                  type="submit"
                  disabled={adding}
                  className="px-[var(--s-5)] h-10 bg-alpha-blue text-white text-sm font-semibold
                             hover:bg-alpha-blue-600 disabled:opacity-50 transition-colors cursor-pointer"
                  style={{
                    borderRadius: "var(--r-pill)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {adding ? "Creating..." : "Create profile"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddChild(false);
                    setAddError("");
                  }}
                  className="px-[var(--s-5)] h-10 text-ink-3 text-sm font-medium
                             hover:text-ink transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Children list */}
        {children.length === 0 && !showAddChild ? (
          <div
            className="bg-paper p-[var(--s-7)] text-center"
            style={{
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h4 className="mb-[var(--s-2)]">Welcome to GTMath!</h4>
            <p className="text-ink-3 mb-[var(--s-5)]">
              Create a player profile for your child to get started. You'll set
              their name and a 4-digit PIN they'll use to log in.
            </p>
            <button
              onClick={() => setShowAddChild(true)}
              className="px-[var(--s-5)] h-12 bg-alpha-blue text-white font-semibold
                         hover:bg-alpha-blue-600 transition-colors cursor-pointer"
              style={{
                borderRadius: "var(--r-pill)",
                fontFamily: "var(--font-display)",
              }}
            >
              + Add your first child
            </button>
          </div>
        ) : (
          <div className="grid gap-[var(--s-5)] md:grid-cols-2">
            {children.map((child) => {
              const badge = getBadge(child.hbBalance);
              const next = getNextMilestone(child.hbBalance);
              return (
                <div
                  key={child.id}
                  className="bg-paper p-[var(--s-5)]"
                  style={{
                    borderRadius: "var(--r-md)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  {/* Child header */}
                  <div className="flex items-center justify-between mb-[var(--s-4)]">
                    <div className="flex items-center gap-[var(--s-3)]">
                      <div
                        className="w-10 h-10 bg-alpha-sky-soft text-alpha-blue flex items-center justify-center font-bold rounded-full"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {child.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold">{child.name}</span>
                        {badge && (
                          <span
                            className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: badge.color + "22",
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-ink-4 uppercase tracking-wider">
                      {child.role}
                    </span>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-[var(--s-3)] mb-[var(--s-4)]">
                    <div className="text-center">
                      <div
                        className="text-2xl font-bold text-alpha-blue"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {child.totalSolves}
                      </div>
                      <div className="text-xs text-ink-4">Solves</div>
                    </div>
                    <div className="text-center">
                      <div
                        className="text-2xl font-bold"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {child.streakDays}
                      </div>
                      <div className="text-xs text-ink-4">Day streak</div>
                    </div>
                    <div className="text-center">
                      <div
                        className="text-2xl font-bold text-success"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {Number(child.hbBalance).toFixed(0)}
                      </div>
                      <div className="text-xs text-ink-4">Home Bucks</div>
                    </div>
                  </div>

                  {/* Modes unlocked */}
                  <div className="flex gap-[var(--s-2)] mb-[var(--s-3)]">
                    {child.unlockedModes.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 text-xs font-semibold bg-alpha-sky-soft text-alpha-blue"
                        style={{ borderRadius: "var(--r-pill)" }}
                      >
                        Mode {m}
                      </span>
                    ))}
                  </div>

                  {/* Next milestone */}
                  {next && (
                    <div className="text-xs text-ink-4">
                      Next: {next.label} at {next.threshold} HB (
                      {Math.max(0, next.threshold - Number(child.hbBalance)).toFixed(0)} to go)
                    </div>
                  )}

                  {/* Play button for this child */}
                  <button
                    onClick={() => {
                      sessionStorage.setItem(
                        "pin_children",
                        JSON.stringify([{ id: child.id, name: child.name }])
                      );
                      router.push("/pin");
                    }}
                    className="mt-[var(--s-4)] w-full h-10 border border-alpha-blue text-alpha-blue text-sm font-semibold
                               hover:bg-alpha-sky-soft transition-colors cursor-pointer"
                    style={{
                      borderRadius: "var(--r-pill)",
                      fontFamily: "var(--font-display)",
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
