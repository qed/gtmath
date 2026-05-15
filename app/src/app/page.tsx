import Link from "next/link";
import "./auth.css";

export default function Home() {
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
        <p className="fm-login-sub">
          Math meets strategy. Deal cards, combine numbers, hit the target.
        </p>

        <div className="fm-login-form">
          <Link
            href="/pin"
            className="fm-btn fm-btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            Play
          </Link>

          <Link
            href="/login"
            className="fm-btn fm-btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            Parent sign-in
          </Link>
        </div>
      </div>
    </div>
  );
}
