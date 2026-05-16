"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import "../auth.css";

interface Student {
  id: string;
  name: string;
  email: string | null;
  hbBalance: number;
  totalSolves: number;
  lastActive: string | null;
}

interface Aggregate {
  totalStudents: number;
  activeToday: number;
  solvesThisWeek: number;
}

function fmtHB(amount: number): string {
  return amount >= 1000
    ? `${(amount / 1000).toFixed(1)}k`
    : amount.toFixed(amount % 1 === 0 ? 0 : 2);
}

export default function AdminDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [aggregate, setAggregate] = useState<Aggregate>({
    totalStudents: 0,
    activeToday: 0,
    solvesThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/students")
      .then((r) => r.json())
      .then((data) => {
        setStudents(data.students ?? []);
        setAggregate(data.aggregate ?? {});
        setLoading(false);
      });
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div>
      <header className="fm-dash-header">
        <span className="fm-dash-brand">Admin Dashboard</span>
        <nav className="fm-dash-nav">
          <Link href="/play">Play</Link>
          <button onClick={handleSignOut}>Sign out</button>
        </nav>
      </header>

      <div className="fm-admin-content">
        {/* Aggregate stats */}
        <div className="fm-stat-grid" style={{ maxWidth: 600, margin: "24px auto" }}>
          <div className="fm-stat">
            <div className="fm-stat-value">{aggregate.totalStudents}</div>
            <div className="fm-stat-label">Students</div>
          </div>
          <div className="fm-stat">
            <div className="fm-stat-value">{aggregate.activeToday}</div>
            <div className="fm-stat-label">Active Today</div>
          </div>
          <div className="fm-stat">
            <div className="fm-stat-value">{aggregate.solvesThisWeek}</div>
            <div className="fm-stat-label">Solves This Week</div>
          </div>
        </div>

        {/* Student list */}
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--ink-3)" }}>Loading...</p>
        ) : students.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--ink-3)" }}>
            No students yet.
          </p>
        ) : (
          <div className="fm-admin-table-wrap">
            <table className="fm-admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="fm-admin-col-email">Email</th>
                  <th>HB</th>
                  <th>Solves</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/students/${s.id}`} className="fm-admin-student-link">
                        {s.name}
                      </Link>
                    </td>
                    <td className="fm-admin-col-email">{s.email ?? "—"}</td>
                    <td>{fmtHB(s.hbBalance)}</td>
                    <td>{s.totalSolves}</td>
                    <td>{s.lastActive ?? "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
