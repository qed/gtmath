"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  R,
  apply,
  eqTarget,
  deal,
  rankLabel,
  rationalLabel,
  MODES,
} from "@/lib/solver";
import type { Card, Tile, HistoryEntry, GamePhase, OpSymbol, Deal, RankData, ProgressResponse } from "@/lib/types";
import Tutorial from "./tutorial";
import "./game.css";

const ALL_MODES = [2, 3, 4, 5, 6, 7, 8, 9];
const UNLOCK_THRESHOLD = 5;

let nextTileId = 0;
function tileId() {
  return `t${nextTileId++}`;
}

function cardToTile(card: Card): Tile {
  const value = R(card.rank)!;
  return {
    id: tileId(),
    kind: "card",
    card,
    value,
    expr: String(card.rank),
  };
}

const RED_SUITS = ["♥", "♦"];
const isRed = (suit: string) => RED_SUITS.includes(suit);

function fmtTime(ms: number | null) {
  if (ms == null) return "00:00.0";
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0")}`;
}

function fmtHB(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function PlayPage() {
  const [mode, setMode] = useState(2);
  const [phase, setPhase] = useState<GamePhase>("ready");
  const [hand, setHand] = useState<Deal | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingOp, setPendingOp] = useState<OpSymbol | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expression, setExpression] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [endMs, setEndMs] = useState<number | null>(null);
  const [hbEarned, setHbEarned] = useState<number | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [speedBonus, setSpeedBonus] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [flashError, setFlashError] = useState(false);
  const [unlockedModes, setUnlockedModes] = useState<number[]>([2]);
  const [modeCounts, setModeCounts] = useState<Record<number, number>>({});
  const [tutorialSeen, setTutorialSeen] = useState<boolean | null>(null);
  const [ranks, setRanks] = useState<Record<number, RankData>>({});
  const [celebrations, setCelebrations] = useState<Array<{ type: "unlock" | "qualify"; mode: number }>>([]);
  const [nudge, setNudge] = useState<string | null>(null);
  const [bonusDismissed, setBonusDismissed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevUnlockedRef = useRef<number[]>([2]);
  const prevModeCountsRef = useRef<Record<number, number>>({});
  const prevRanksRef = useRef<Record<number, RankData>>({});

  const router = useRouter();

  const target = hand?.target ?? 0;

  const fetchProgress = useCallback(async (): Promise<ProgressResponse | null> => {
    try {
      const res = await fetch("/api/progress", { cache: "no-store" });
      if (res.status === 401) {
        setSessionExpired(true);
        setTimeout(() => { window.location.href = "/"; }, 2000);
        return null;
      }
      if (res.ok) {
        const data: ProgressResponse = await res.json();
        setUnlockedModes(data.unlockedModes);
        setModeCounts(data.modeCounts);
        setTutorialSeen(data.tutorialSeen ?? false);
        setRanks(data.ranks ?? {});
        if (data.balance != null) setNewBalance(data.balance);
        prevUnlockedRef.current = data.unlockedModes;
        prevModeCountsRef.current = data.modeCounts;
        prevRanksRef.current = data.ranks ?? {};
        setMode((prev) => data.unlockedModes.includes(prev) ? prev : Math.max(...data.unlockedModes));
        return data;
      }
    } catch {
      // offline — keep current state
    }
    return null;
  }, []);

  const handleSignOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/";
  }, []);

  useEffect(() => {
    fetchProgress();
    const h = deal({ mode: 2, onlySolvable: true });
    setHand(h);
  }, [fetchProgress]);

  useEffect(() => {
    if (phase === "playing") {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 53);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime]);

  function dealHand() {
    if (!hand) return;
    const t = hand.cards.map(cardToTile);
    setTiles(t);
    setSelected([]);
    setPendingOp(null);
    setHistory([]);
    setExpression("");
    setStartTime(Date.now());
    setElapsed(0);
    setEndMs(null);
    setHbEarned(null);
    setNewBalance(null);
    setSpeedBonus(0);
    setPhase("playing");
  }

  function startReady(m?: number) {
    const useMode = m ?? mode;
    const h = deal({ mode: useMode, onlySolvable: true });
    setHand(h);
    setTiles([]);
    setSelected([]);
    setPendingOp(null);
    setHistory([]);
    setExpression("");
    setStartTime(0);
    setElapsed(0);
    setEndMs(null);
    setHbEarned(null);
    setNewBalance(null);
    setPhase("ready");
  }

  const handleTileTap = useCallback(
    (id: string) => {
      if (phase !== "playing") return;

      if (selected.length === 0) {
        setSelected([id]);
        return;
      }

      if (selected[0] === id) {
        setSelected([]);
        setPendingOp(null);
        return;
      }

      if (!pendingOp) {
        setSelected([id]);
        return;
      }

      const aIdx = tiles.findIndex((t) => t.id === selected[0]);
      const bIdx = tiles.findIndex((t) => t.id === id);
      if (aIdx === -1 || bIdx === -1) return;

      const a = tiles[aIdx];
      const b = tiles[bIdx];
      const result = apply(pendingOp, a.value, b.value);

      if (!result) {
        setFlashError(true);
        setTimeout(() => setFlashError(false), 280);
        return;
      }

      setHistory((prev) => [
        ...prev,
        { tiles: [...tiles], selected: [...selected], expression, pendingOp },
      ]);

      const aExpr = a.kind === "card" ? a.expr : `(${a.expr})`;
      const bExpr = b.kind === "card" ? b.expr : `(${b.expr})`;
      const newExpr = `${aExpr} ${pendingOp} ${bExpr}`;

      const newTile: Tile = {
        id: tileId(),
        kind: "res",
        value: result,
        expr: newExpr,
      };

      const insertAt = Math.min(aIdx, bIdx);
      const newTiles = tiles.filter((t) => t.id !== a.id && t.id !== b.id);
      newTiles.splice(insertAt, 0, newTile);

      setTiles(newTiles);
      setSelected([]);
      setPendingOp(null);
      setExpression(newExpr);

      if (newTiles.length === 1) {
        const ms = Date.now() - startTime;
        setEndMs(ms);
        if (eqTarget(newTiles[0].value, target)) {
          setPhase("won");
          submitSolve(newExpr);
        } else {
          setPhase("bust");
        }
      }
    },
    [phase, selected, pendingOp, tiles, expression, target, startTime]
  );


  const handleOp = useCallback(
    (op: OpSymbol) => {
      if (phase !== "playing" || selected.length !== 1) return;
      setPendingOp(op);
    },
    [phase, selected]
  );

  async function submitSolve(expr: string) {
    if (!hand) return;
    setSubmitting(true);
    setNudge(null);
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expression: expr,
          target: hand.target,
          mode: hand.mode,
          timeMs: Date.now() - startTime,
          cards: hand.cards,
        }),
      });
      if (res.status === 401) {
        setSessionExpired(true);
        setTimeout(() => { window.location.href = "/"; }, 2000);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setHbEarned(data.hbEarned);
        setNewBalance(data.newBalance);
        setSpeedBonus(data.speedBonus ?? 0);

        const prevUnlocked = [...prevUnlockedRef.current];
        const prevCounts = { ...prevModeCountsRef.current };
        const prevRanksSnap = { ...prevRanksRef.current };

        const progress = await fetchProgress();
        if (progress) {
          const newCelebrations: Array<{ type: "unlock" | "qualify"; mode: number }> = [];
          for (const m of progress.unlockedModes) {
            if (!prevUnlocked.includes(m)) {
              newCelebrations.push({ type: "unlock", mode: m });
            }
          }
          for (const m of progress.unlockedModes) {
            const prevCount = prevCounts[m] ?? 0;
            const newCount = progress.modeCounts[m] ?? 0;
            const r = progress.ranks?.[m];
            if (prevCount < 10 && newCount >= 10 && r?.position != null) {
              newCelebrations.push({ type: "qualify", mode: m });
            }
          }
          if (newCelebrations.length > 0) {
            setCelebrations(newCelebrations);
          }

          const curMode = hand.mode;
          const prevRank = prevRanksSnap[curMode];
          const newRank = progress.ranks?.[curMode];
          if (prevRank?.position != null && newRank?.position != null && newRank.position < prevRank.position) {
            setNudge(`You moved up to #${newRank.position} in ${MODES[curMode].label}!`);
          } else {
            const nextM = curMode + 1;
            const remaining = UNLOCK_THRESHOLD - (progress.modeCounts[curMode] ?? 0);
            if (nextM <= 9 && !progress.unlockedModes.includes(nextM) && remaining <= 2 && remaining > 0) {
              setNudge(`${remaining} more to unlock ${MODES[nextM].label}!`);
            } else {
              const solveCount = newRank?.solveCount ?? 0;
              const qualRemaining = 10 - solveCount;
              if (newRank?.position == null && solveCount > 0 && qualRemaining <= 2 && qualRemaining > 0) {
                setNudge(`${qualRemaining} more solve${qualRemaining > 1 ? "s" : ""} to qualify!`);
              }
            }
          }
        }
      }
    } catch {
      // offline -- will queue later
    }
    setSubmitting(false);
  }

  const undo = useCallback(() => {
    if (phase === "won" || phase === "bust") return;
    if (pendingOp) {
      setPendingOp(null);
      return;
    }
    if (selected.length > 0) {
      setSelected([]);
      return;
    }
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setTiles(last.tiles);
    setSelected(last.selected ?? []);
    setPendingOp(last.pendingOp ?? null);
    setHistory((prev) => prev.slice(0, -1));
  }, [phase, history, selected, pendingOp]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (celebrations.length > 0) {
        if (e.key === "Enter" || e.key === " " || e.key === "n" || e.key === "N") {
          e.preventDefault();
        }
        return;
      }
      if (phase === "ready" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        dealHand();
        return;
      }
      if (phase === "won" || phase === "bust") {
        if (e.key === "Enter" || e.key === " " || e.key === "n" || e.key === "N") {
          e.preventDefault();
          startReady();
        }
        return;
      }
      if (phase !== "playing") return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= tiles.length) {
        e.preventDefault();
        handleTileTap(tiles[num - 1].id);
        return;
      }
      const opMap: Record<string, OpSymbol> = {
        "+": "+", "-": "−", "*": "×", x: "×", X: "×", "/": "÷",
      };
      if (opMap[e.key]) {
        e.preventDefault();
        handleOp(opMap[e.key]);
        return;
      }
      if (e.key === "u" || e.key === "U" || e.key === "Backspace") { e.preventDefault(); undo(); }
      if (e.key === "Escape") { e.preventDefault(); setSelected([]); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, tiles, handleTileTap, handleOp, undo, celebrations]);

  async function handleTutorialComplete() {
    setTutorialSeen(true);
    try {
      await fetch("/api/tutorial", { method: "PATCH" });
    } catch {
      // offline — tutorial will re-show next time, which is fine
    }
  }

  // Derived: tile lookup helpers for preview
  const tileById = (id: string) => tiles.find((t) => t.id === id);
  const tileExprFor = (t: Tile | undefined) =>
    t ? (t.kind === "card" ? t.expr : `(${t.expr})`) : null;
  const aTile = selected[0] ? tileById(selected[0]) : undefined;

  // Preview tiles for ready state
  const previewCards = hand
    ? hand.cards.map((c, i) => ({
        id: `p${i}`,
        kind: "card" as const,
        card: c,
        value: R(c.rank)!,
        expr: rankLabel(c.rank),
      }))
    : [];

  const displayTiles = phase === "ready" ? previewCards : tiles;
  const tileCount = displayTiles.length || (hand ? MODES[hand.mode]?.cards : MODES[mode]?.cards) || 4;

  if (sessionExpired) {
    return (
      <div className="fm-login-overlay">
        <div className="fm-login-bg" />
        <div className="fm-login-card">
          <p className="fm-login-sub" style={{ margin: 0 }}>
            Your session expired. Sign in again to continue.
          </p>
        </div>
      </div>
    );
  }

  if (tutorialSeen === null) {
    return <div className="fm-stage" />;
  }

  if (!tutorialSeen) {
    return <Tutorial onComplete={handleTutorialComplete} />;
  }

  return (
    <div className={`fm-stage ${flashError ? "fm-flash" : ""}`}>
      {/* ── Header ── */}
      <header className="fm-top">
        <div className="fm-top-left">
          <div className="fm-brand">
            <span className="fm-brand-mark">⚡</span>
            <span>GTMath<span className="fm-brand-52">52</span></span>
          </div>
          <div className="fm-mode-select">
            <button className="fm-mode-trigger" onClick={() => setModeMenuOpen((v) => !v)} type="button">
              {MODES[mode].label}
              <span className="fm-mode-arrow">&#x25BE;</span>
            </button>
            {modeMenuOpen && (
              <>
                <div className="fm-mode-backdrop" onClick={() => setModeMenuOpen(false)} />
                <div className="fm-mode-dropdown">
                  {ALL_MODES.map((m) => {
                    const locked = !unlockedModes.includes(m);
                    return (
                      <button
                        key={m}
                        className={`fm-mode-option ${m === mode ? "is-on" : ""} ${locked ? "is-locked" : ""}`}
                        disabled={locked}
                        onClick={() => { setMode(m); startReady(m); setModeMenuOpen(false); }}
                        type="button"
                      >
                        {locked ? "🔒 " : ""}{MODES[m].label}
                        <span className="fm-mode-meta">{MODES[m].cards} cards</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="fm-timer" aria-live="polite">
          {phase === "playing" ? (
            <span>{fmtTime(elapsed)}</span>
          ) : phase !== "ready" ? (
            <span>{fmtTime(endMs)}</span>
          ) : null}
        </div>

        <div className="fm-top-right">
          {newBalance != null && (
            <span className="fm-hb-header">{fmtHB(newBalance)} HB</span>
          )}
          <a href="/leaderboard" className="fm-dash-link" title="Leaderboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M21 5h-4v3a4 4 0 0 0 4-3z"/><path d="M3 5h4v3a4 4 0 0 1-4-3z"/>
            </svg>
          </a>
          <button onClick={handleSignOut} className="fm-signout-btn" title="Sign out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="fm-signout-label">Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Main game area ── */}
      <main className={`fm-main is-${phase}`}>
        {/* Progress bar */}
        {(() => {
          const nextMode = mode + 1;
          const modeCount = modeCounts[mode] ?? 0;
          const rank = ranks[mode];
          const needsUnlock = nextMode <= 9 && !unlockedModes.includes(nextMode);

          if (needsUnlock) {
            const pct = Math.min((modeCount / UNLOCK_THRESHOLD) * 100, 100);
            return (
              <div className="fm-progress">
                <div className="fm-progress-track">
                  <div className="fm-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="fm-progress-label">{modeCount}/{UNLOCK_THRESHOLD} to unlock {MODES[nextMode].label}</span>
              </div>
            );
          }

          if (!rank || rank.position == null) {
            const solveCount = rank?.solveCount ?? modeCount;
            const pct = Math.min((solveCount / 10) * 100, 100);
            return (
              <div className="fm-progress">
                <div className="fm-progress-track">
                  <div className="fm-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="fm-progress-label">{solveCount}/10 to qualify</span>
              </div>
            );
          }

          const totalRanked = rank.totalRanked || 1;
          const pct = Math.min(((totalRanked - rank.position + 1) / totalRanked) * 100, 100);
          return (
            <div className="fm-progress">
              <div className="fm-progress-track">
                <div className="fm-progress-fill is-ranked" style={{ width: `${pct}%` }} />
              </div>
              <span className="fm-progress-label">
                {rank.position === 1
                  ? `#1 in ${MODES[mode].label}!`
                  : `#${rank.position} in ${MODES[mode].label}`}
              </span>
            </div>
          );
        })()}

        {/* Cards + target */}
        <div className="fm-play-row">
        <div className={`fm-tiles count-${tileCount}`}>
          {displayTiles.map((tile) => {
            const selIdx = selected.indexOf(tile.id);
            const isSel = selIdx !== -1;
            const isDim = phase === "playing" && selected.length === 2 && !isSel;
            const isFinal = (phase === "won" || phase === "bust") && tiles.length === 1;
            const faceDown = phase === "ready";

            if (tile.kind === "card" && tile.card) {
              const red = isRed(tile.card.suit);
              return (
                <button
                  key={tile.id}
                  className={`fm-card fm-pc ${isSel ? "is-sel" : ""} ${isDim ? "is-dim" : ""} ${faceDown ? "is-back" : ""}`}
                  onClick={() => phase === "playing" && handleTileTap(tile.id)}
                  type="button"
                >
                  {faceDown ? (
                    <span className="fm-pc-back">⚡</span>
                  ) : (
                    <>
                  {isSel && selected.length === 2 && (
                    <span className="fm-badge">{selIdx === 0 ? "①" : "②"}</span>
                  )}
                  <span className={`fm-pc-corner tl ${red ? "red" : ""}`}>
                    <span className="rank">{rankLabel(tile.card.rank)}</span>
                    <span className="suit">{tile.card.suit}</span>
                  </span>
                  <span className={`fm-pc-center ${red ? "red" : ""}`}>{tile.card.suit}</span>
                  <span className={`fm-pc-corner br ${red ? "red" : ""}`}>
                    <span className="rank">{rankLabel(tile.card.rank)}</span>
                    <span className="suit">{tile.card.suit}</span>
                  </span>
                    </>
                  )}
                </button>
              );
            }

            return (
              <button
                key={tile.id}
                className={`fm-card fm-rc ${isSel ? "is-sel" : ""} ${
                  isFinal ? (phase === "won" ? "is-win" : "is-bust") : ""
                }`}
                onClick={() => phase === "playing" && handleTileTap(tile.id)}
                type="button"
              >
                {isSel && selected.length === 2 && (
                  <span className="fm-badge">{selIdx === 0 ? "①" : "②"}</span>
                )}
                <span className="fm-rc-value">{rationalLabel(tile.value)}</span>
                {tile.expr && <span className="fm-rc-expr">{tile.expr}</span>}
              </button>
            );
          })}
        </div>
        <span className="fm-target-chip">Make <strong>{target || "—"}</strong></span>
        </div>

        {/* Live expression preview */}
        {phase === "playing" && (
          <div className="fm-preview">
            {selected.length === 0 && (
              <span className="fm-preview-hint">Tap a card</span>
            )}
            {selected.length === 1 && !pendingOp && (
              <span className="fm-preview-expr">
                <span className="fm-pe-tok">{tileExprFor(aTile)}</span>
                <span className="fm-pe-tok fm-pe-empty">op?</span>
                <span className="fm-pe-tok fm-pe-empty">?</span>
              </span>
            )}
            {selected.length === 1 && pendingOp && (
              <span className="fm-preview-expr is-ready">
                <span className="fm-pe-tok">{tileExprFor(aTile)}</span>
                <span className="fm-pe-tok fm-pe-op">{pendingOp}</span>
                <span className="fm-pe-tok fm-pe-empty">?</span>
              </span>
            )}
          </div>
        )}

        {/* Ready phase */}
        {phase === "ready" && (
          <div className="fm-actions ready">
            <button className="fm-btn fm-btn-primary" onClick={() => dealHand()} type="button">
              Solve
              <span className="fm-btn-key">↵</span>
            </button>
          </div>
        )}

        {/* Playing phase: operators */}
        {phase === "playing" && (
          <div className="fm-actions playing">
            <div className={`fm-ops ${selected.length === 1 ? "is-ready" : ""}`}>
              {(["+", "−", "×", "÷"] as OpSymbol[]).map((op) => (
                <button
                  key={op}
                  className={`fm-op ${pendingOp === op ? "is-on" : ""}`}
                  disabled={selected.length !== 1}
                  onClick={() => handleOp(op)}
                  type="button"
                  aria-label={op}
                >
                  {op}
                </button>
              ))}
            </div>
            <div className="fm-secondary">
              <button
                className="fm-btn fm-btn-ghost"
                onClick={undo}
                disabled={history.length === 0 && selected.length === 0}
                type="button"
              >
                Undo
                <span className="fm-btn-key">U</span>
              </button>
            </div>
          </div>
        )}

        {/* Won result */}
        {phase === "won" && (
          <div className="fm-result won">
            <div className="fm-result-title">
              You got {target}. <span className="fm-result-expr-inline">{tiles[0]?.expr}</span>
            </div>
            <div className="fm-result-time">{fmtTime(endMs)}</div>
            {hbEarned != null && (
              <span className="fm-hb-inline">
                +{fmtHB(hbEarned)} HB
                {speedBonus > 0 && <span className="fm-speed-tag">⚡ PB! +{fmtHB(speedBonus)}</span>}
              </span>
            )}
            {nudge && <span className="fm-nudge">{nudge}</span>}
            {submitting && <span className="fm-preview-hint">Saving...</span>}
            <button className="fm-btn fm-btn-primary" onClick={() => startReady()} type="button">
              Next hand<span className="fm-btn-key">↵</span>
            </button>
          </div>
        )}

        {/* Bust result */}
        {phase === "bust" && (
          <div className="fm-result bust">
            <div className="fm-result-title">
              That&apos;s {rationalLabel(tiles[0]?.value)}, not {target}. <span className="fm-result-expr-inline">{tiles[0]?.expr}</span>
            </div>
            <div className="fm-result-locked">
              <span className="eyebrow">No retry</span>
              <span>This hand is locked.</span>
            </div>
            <button className="fm-btn fm-btn-primary" onClick={() => startReady()} type="button">
              Next hand<span className="fm-btn-key">↵</span>
            </button>
          </div>
        )}
      </main>

      {/* ── Celebration Overlay ── */}
      {celebrations.length > 0 && (() => {
        const cel = celebrations[0];
        const dismiss = () => setCelebrations((prev) => prev.slice(1));
        if (cel.type === "unlock") {
          const prevMode = cel.mode - 1;
          const prevCount = modeCounts[prevMode] ?? 0;
          const qualRemaining = Math.max(10 - prevCount, 0);
          const prevRank = ranks[prevMode];
          const stayDesc = qualRemaining > 0
            ? `${qualRemaining} more solve${qualRemaining > 1 ? "s" : ""} to qualify`
            : prevRank?.position != null
              ? `You're #${prevRank.position} — keep climbing`
              : "Keep solving to rank up";
          return (
            <div className="fm-tut-overlay fm-celebration">
              <div className="fm-tut-card">
                <div className="fm-tut-emoji">🔓</div>
                <h1 className="fm-tut-heading">{MODES[cel.mode].label} unlocked!</h1>
                <p className="fm-tut-body">What&apos;s your next move?</p>
                <div className="fm-cel-choices">
                  <button className="fm-cel-choice" onClick={() => { setMode(cel.mode); startReady(cel.mode); dismiss(); }} type="button">
                    <span className="fm-cel-icon">🚀</span>
                    <span className="fm-cel-choice-title">Go harder</span>
                    <span className="fm-cel-choice-desc">{MODES[cel.mode].cards} cards, target {MODES[cel.mode]?.target ?? "varies"}</span>
                  </button>
                  <button className="fm-cel-choice" onClick={dismiss} type="button">
                    <span className="fm-cel-icon">🏆</span>
                    <span className="fm-cel-choice-title">Own the {MODES[prevMode].label} leaderboard</span>
                    <span className="fm-cel-choice-desc">{stayDesc}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div className="fm-tut-overlay fm-celebration">
            <div className="fm-tut-card">
              <div className="fm-tut-emoji">📊</div>
              <h1 className="fm-tut-heading">You&apos;re on the leaderboard!</h1>
              <p className="fm-tut-body">
                You qualified in {MODES[cel.mode].label} with 10+ solves.
              </p>
              <button className="fm-btn fm-btn-primary" onClick={() => { router.push(`/leaderboard?mode=${cel.mode}&metric=fastest&period=week`); dismiss(); }} type="button">
                See your rank
              </button>
              <button className="fm-btn fm-btn-ghost" onClick={dismiss} type="button">
                Keep playing
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Footer ── */}
      <footer className="fm-foot">
        <span className="caption">
          Tap a card · pick an op · tap another card. Keys: <kbd>1</kbd>–<kbd>{MODES[mode]?.cards}</kbd>,{" "}
          <kbd>+</kbd> <kbd>−</kbd> <kbd>*</kbd> <kbd>/</kbd>, <kbd>U</kbd>ndo, <kbd>Esc</kbd>.
        </span>
      </footer>
    </div>
  );
}
