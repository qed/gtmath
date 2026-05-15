"use client";

import { useState, useEffect } from "react";
import { MODES, MODE_ORDER } from "@/lib/solver";
import "./leaderboard.css";

interface SolveEntry {
  child_id: string;
  child_name: string;
  solve_count: number;
  rank: number;
}

interface FastestEntry {
  child_id: string;
  child_name: string;
  avg_time_ms: number;
  solve_count: number;
  rank: number;
}

interface QualifyInfo {
  solveCount: number;
  needed: number;
}

type Entry = SolveEntry | FastestEntry;

function fmtTime(ms: number) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return m > 0
    ? `${m}:${sec.toFixed(1).padStart(4, "0")}`
    : `${sec.toFixed(1)}s`;
}

function rankBadge(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

export default function LeaderboardPage() {
  const [mode, setMode] = useState(4);
  const [metric, setMetric] = useState<"solves" | "fastest">("solves");
  const [period, setPeriod] = useState<"all" | "today" | "week">("all");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [qualify, setQualify] = useState<QualifyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?mode=${mode}&metric=${metric}&period=${period}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setQualify(data.qualify ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mode, metric, period]);

  return (
    <div className="lb-stage">
      <header className="lb-top">
        <div className="lb-brand">
          <span className="fm-brand-mark">⚡</span>
          <span>GTMath<span className="fm-brand-52">52</span></span>
        </div>
        <h4 className="lb-title">Leaderboard</h4>
        <div className="lb-nav">
          <a href="/play" className="lb-link">Play</a>
        </div>
      </header>

      <main className="lb-main">
        {/* Filters */}
        <div className="lb-filters">
          {/* Mode pills */}
          <div className="lb-filter-group">
            <span className="eyebrow">Mode</span>
            <div className="lb-pills">
              {MODE_ORDER.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`lb-pill ${m === mode ? "is-on" : ""}`}
                >
                  {MODES[m].label}
                </button>
              ))}
            </div>
          </div>

          {/* Metric pills */}
          <div className="lb-filter-group">
            <span className="eyebrow">Rank by</span>
            <div className="lb-pills">
              <button
                onClick={() => setMetric("solves")}
                className={`lb-pill ${metric === "solves" ? "is-on" : ""}`}
              >
                Most solved
              </button>
              <button
                onClick={() => setMetric("fastest")}
                className={`lb-pill ${metric === "fastest" ? "is-on" : ""}`}
              >
                Fastest
              </button>
            </div>
          </div>

          {/* Period pills */}
          <div className="lb-filter-group">
            <span className="eyebrow">Period</span>
            <div className="lb-pills">
              {(["all", "week", "today"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`lb-pill ${p === period ? "is-on" : ""}`}
                >
                  {p === "all" ? "All time" : p === "week" ? "This week" : "Today"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="lb-table-wrap">
          {loading ? (
            <div className="lb-empty">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="lb-empty">
              No solves yet for {MODES[mode]?.label} mode
              {period !== "all" ? ` (${period === "today" ? "today" : "this week"})` : ""}.
              Be the first!
            </div>
          ) : (
            <div className="lb-table">
              <div className="lb-row lb-header">
                <span className="lb-rank">#</span>
                <span className="lb-name">Player</span>
                <span className="lb-stat">
                  {metric === "solves" ? "Solves" : "Avg top 10"}
                </span>
              </div>
              {entries.map((entry) => (
                <div key={entry.child_id} className="lb-row">
                  <span className={`lb-rank ${entry.rank <= 3 ? "is-top" : ""}`}>
                    {rankBadge(entry.rank)}
                  </span>
                  <span className="lb-name">
                    <span className="lb-avatar">
                      {entry.child_name[0]?.toUpperCase()}
                    </span>
                    {entry.child_name}
                  </span>
                  <span className="lb-stat">
                    {metric === "solves"
                      ? (entry as SolveEntry).solve_count
                      : fmtTime((entry as FastestEntry).avg_time_ms)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {metric === "fastest" && qualify && (
            <div className="lb-qualify">
              Solve {qualify.needed} more {MODES[mode]?.label} hand{qualify.needed !== 1 ? "s" : ""} to qualify for the fastest leaderboard ({qualify.solveCount}/10)
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
