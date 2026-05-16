"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import "../../../../auth.css";

interface Child {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  deactivated_at: string | null;
}

interface Solve {
  id: string;
  mode: number;
  target: number;
  time_ms: number;
  hb_earned: number;
  created_at: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  created_at: string;
}

interface SpeedTrend {
  mode: number;
  avgTimeMs: number;
  solveCount: number;
}

function fmtHB(amount: number): string {
  return amount >= 1000
    ? `${(amount / 1000).toFixed(1)}k`
    : amount.toFixed(amount % 1 === 0 ? 0 : 2);
}

function fmtTime(ms: number): string {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
}

export default function StudentDrilldown() {
  const params = useParams();
  const id = params.id as string;

  const [child, setChild] = useState<Child | null>(null);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [speedTrends, setSpeedTrends] = useState<SpeedTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch(`/api/admin/students/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setChild(data.child);
        setSolves(data.solves ?? []);
        setTransactions(data.transactions ?? []);
        setSpeedTrends(data.speedTrends ?? []);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const executeAction = async (action: string) => {
    setActionPending(action);
    setConfirmAction(null);
    await fetch("/api/admin/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, childId: id }),
    });
    setActionPending(null);
    fetchData();
  };

  if (loading) {
    return (
      <div>
        <header className="fm-dash-header">
          <Link href="/admin" className="fm-dash-brand">← Back</Link>
        </header>
        <p style={{ textAlign: "center", color: "var(--ink-3)", marginTop: 40 }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!child) {
    return (
      <div>
        <header className="fm-dash-header">
          <Link href="/admin" className="fm-dash-brand">← Back</Link>
        </header>
        <p style={{ textAlign: "center", color: "var(--ink-3)", marginTop: 40 }}>
          Student not found.
        </p>
      </div>
    );
  }

  const isDeactivated = !!child.deactivated_at;

  return (
    <div>
      <header className="fm-dash-header">
        <Link href="/admin" className="fm-dash-brand">← Back</Link>
        <nav className="fm-dash-nav">
          <span style={{ fontSize: 14, color: "var(--ink-3)" }}>
            {child.name} {isDeactivated && "(Deactivated)"}
          </span>
        </nav>
      </header>

      <div className="fm-admin-content">
        {/* Student info + actions */}
        <div className="fm-admin-actions-bar">
          <div>
            <strong>{child.name}</strong>
            {child.email && <span style={{ marginLeft: 8, color: "var(--ink-3)" }}>{child.email}</span>}
            {isDeactivated && <span className="fm-admin-badge-inactive">Deactivated</span>}
          </div>
          <div className="fm-admin-actions">
            {/* Reset HB */}
            {confirmAction === "reset_hb" ? (
              <span className="fm-admin-confirm">
                Reset HB to 0? This cannot be undone.{" "}
                <button
                  onClick={() => executeAction("reset_hb")}
                  disabled={!!actionPending}
                  className="fm-admin-confirm-btn"
                >
                  Confirm
                </button>
                <button onClick={() => setConfirmAction(null)} className="fm-admin-cancel-btn">
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmAction("reset_hb")}
                disabled={!!actionPending}
                className="fm-btn fm-btn-ghost"
                style={{ padding: "12px 16px", fontSize: 14, minHeight: 44 }}
              >
                Reset HB
              </button>
            )}

            {/* Deactivate / Reactivate */}
            {isDeactivated ? (
              confirmAction === "reactivate" ? (
                <span className="fm-admin-confirm">
                  Reactivate {child.name}?{" "}
                  <button
                    onClick={() => executeAction("reactivate")}
                    disabled={!!actionPending}
                    className="fm-admin-confirm-btn"
                  >
                    Confirm
                  </button>
                  <button onClick={() => setConfirmAction(null)} className="fm-admin-cancel-btn">
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmAction("reactivate")}
                  disabled={!!actionPending}
                  className="fm-btn fm-btn-ghost"
                  style={{ padding: "12px 16px", fontSize: 14, minHeight: 44 }}
                >
                  Reactivate
                </button>
              )
            ) : confirmAction === "deactivate" ? (
              <span className="fm-admin-confirm">
                Deactivate {child.name}? They will lose access immediately.{" "}
                <button
                  onClick={() => executeAction("deactivate")}
                  disabled={!!actionPending}
                  className="fm-admin-confirm-btn"
                >
                  Confirm
                </button>
                <button onClick={() => setConfirmAction(null)} className="fm-admin-cancel-btn">
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmAction("deactivate")}
                disabled={!!actionPending}
                className="fm-btn fm-btn-ghost"
                style={{ padding: "12px 16px", fontSize: 14, minHeight: 44 }}
              >
                Deactivate
              </button>
            )}
          </div>
        </div>

        {/* Speed trends */}
        {speedTrends.length > 0 && (
          <section className="fm-admin-section">
            <h3>Speed by Mode</h3>
            <div className="fm-stat-grid">
              {speedTrends.map((t) => (
                <div key={t.mode} className="fm-stat">
                  <div className="fm-stat-value">{fmtTime(t.avgTimeMs)}</div>
                  <div className="fm-stat-label">Mode {t.mode} ({t.solveCount} solves)</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Solve history */}
        <section className="fm-admin-section">
          <h3>Recent Solves</h3>
          {solves.length === 0 ? (
            <p style={{ color: "var(--ink-3)" }}>No solves yet.</p>
          ) : (
            <div className="fm-admin-table-wrap">
              <table className="fm-admin-table">
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>Target</th>
                    <th>Time</th>
                    <th>HB</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {solves.map((s) => (
                    <tr key={s.id}>
                      <td>{s.mode}</td>
                      <td>{s.target}</td>
                      <td>{fmtTime(s.time_ms)}</td>
                      <td>{fmtHB(s.hb_earned)}</td>
                      <td>{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* HB Transactions */}
        <section className="fm-admin-section">
          <h3>HB Ledger</h3>
          {transactions.length === 0 ? (
            <p style={{ color: "var(--ink-3)" }}>No transactions.</p>
          ) : (
            <div className="fm-admin-table-wrap">
              <table className="fm-admin-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td>{t.type}</td>
                      <td>{t.amount >= 0 ? "+" : ""}{fmtHB(t.amount)}</td>
                      <td>{fmtHB(t.balance_after)}</td>
                      <td>{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
