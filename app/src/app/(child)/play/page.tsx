"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  R,
  apply,
  eqTarget,
  deal,
  rankLabel,
  rationalLabel,
  MODES,
} from "@/lib/solver";
import type { Rational, Card, Tile, HistoryEntry, GamePhase, OpSymbol, Deal, RankData, ProgressResponse } from "@/lib/types";
import { useRouter } from "next/navigation";
import Tutorial from "./tutorial";
import "./game.css";

const MODE_NAMES: Record<number, string> = {
  2: "Quick", 3: "Speed", 4: "Classic", 5: "Combo",
  6: "Expert", 7: "Power", 8: "Master", 9: "Wild",
};

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevUnlockedRef = useRef<number[]>([2]);
  const prevModeCountsRef = useRef<Record<number, number>>({});
  const prevRanksRef = useRef<Record<number, RankData>>({});
  const router = useRouter();

  const target = hand?.target ?? 0;

  const fetchProgress = useCallback(async (): Promise<ProgressResponse | null> => {
    try {
      const res = await fetch("/api/progress", { cache: "no-store" });
      if (res.ok) {
        const data: ProgressResponse = await res.json();
        setUnlockedModes(data.unlockedModes);
        setModeCounts(data.modeCounts);
        setTutorialSeen(data.tutorialSeen ?? true);
        setRanks(data.ranks ?? {});
        setMode((prev) => data.unlockedModes.includes(prev) ? prev : Math.max(...data.unlockedModes));
        return data;
      }
    } catch {
      // offline — keep current state
    }
    return null;
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
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((s) => s !== id);
        if (prev.length >= 2) return [prev[0], id];
        return [...prev, id];
      });
    },
    [phase]
  );

  const swapOperands = useCallback(() => {
    setSelected((prev) => (prev.length === 2 ? [prev[1], prev[0]] : prev));
  }, []);

  const handleOp = useCallback(
    (op: OpSymbol) => {
      if (phase !== "playing" || selected.length !== 2) return;

      const aIdx = tiles.findIndex((t) => t.id === selected[0]);
      const bIdx = tiles.findIndex((t) => t.id === selected[1]);
      if (aIdx === -1 || bIdx === -1) return;

      const a = tiles[aIdx];
      const b = tiles[bIdx];
      const result = apply(op, a.value, b.value);

      if (!result) {
        setFlashError(true);
        setTimeout(() => setFlashError(false), 280);
        return;
      }

      setHistory((prev) => [
        ...prev,
        { tiles: [...tiles], selected: [...selected], expression },
      ]);

      const aExpr = a.kind === "card" ? a.expr : `(${a.expr})`;
      const bExpr = b.kind === "card" ? b.expr : `(${b.expr})`;
      const newExpr = `${aExpr} ${op} ${bExpr}`;

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
    [phase, selected, tiles, expression, target, startTime]
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
      if (res.ok) {
        const data = await res.json();
        setHbEarned(data.hbEarned);
        setNewBalance(data.newBalance);
        setSpeedBonus(data.speedBonus ?? 0);

        prevUnlockedRef.current = [...unlockedModes];
        prevModeCountsRef.current = { ...modeCounts };
        prevRanksRef.current = { ...ranks };

        const progress = await fetchProgress();
        if (progress) {
          const newCelebrations: Array<{ type: "unlock" | "qualify"; mode: number }> = [];
          for (const m of progress.unlockedModes) {
            if (!prevUnlockedRef.current.includes(m)) {
              newCelebrations.push({ type: "unlock", mode: m });
            }
          }
          for (const m of progress.unlockedModes) {
            const prevCount = prevModeCountsRef.current[m] ?? 0;
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
          const prevRank = prevRanksRef.current[curMode];
          const newRank = progress.ranks?.[curMode];
          if (prevRank?.position != null && newRank?.position != null && newRank.position < prevRank.position) {
            setNudge(`You moved up to #${newRank.position} in ${MODE_NAMES[curMode]}!`);
          } else {
            const nextM = curMode + 1;
            const remaining = UNLOCK_THRESHOLD - (progress.modeCounts[curMode] ?? 0);
            if (nextM <= 9 && !progress.unlockedModes.includes(nextM) && remaining <= 2 && remaining > 0) {
              setNudge(`${remaining} more to unlock ${MODE_NAMES[nextM]}!`);
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
    if (selected.length > 0) {
      setSelected([]);
      return;
    }
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setTiles(last.tiles);
    setSelected([]);
    setHistory((prev) => prev.slice(0, -1));
  }, [phase, history, selected]);

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
      if (e.key === "s" || e.key === "S") { e.preventDefault(); swapOperands(); }
      if (e.key === "u" || e.key === "U" || e.key === "Backspace") { e.preventDefault(); undo(); }
      if (e.key === "Escape") { e.preventDefault(); setSelected([]); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, tiles, handleTileTap, handleOp, swapOperands, undo, celebrations]);

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
  const bTile = selected[1] ? tileById(selected[1]) : undefined;

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
        <div className="fm-brand">
          <span className="fm-brand-mark">⚡</span>
          <span>GTMath<span className="fm-brand-52">52</span></span>
        </div>

        <div>
          <span className="fm-target">
            <span className="eyebrow">Make</span>
            <span className="fm-target-num">{target || "—"}</span>
          </span>
        </div>

        <div className="fm-top-right">
          <div className="fm-timer" aria-live="polite">
            {phase === "ready" ? (
              <span className="fm-timer-idle">Ready</span>
            ) : phase === "playing" ? (
              <span>{fmtTime(elapsed)}</span>
            ) : (
              <span>{fmtTime(endMs)}</span>
            )}
          </div>
          <a href="/leaderboard" className="fm-dash-link" title="Leaderboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M21 5h-4v3a4 4 0 0 0 4-3z"/><path d="M3 5h4v3a4 4 0 0 1-4-3z"/>
            </svg>
          </a>
          <a href="/dashboard" className="fm-dash-link" title="Dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </a>
        </div>
      </header>

      {/* ── Main game area ── */}
      <main className={`fm-main is-${phase}`}>
        {/* Mode pills */}
        <div className="fm-mode-pills">
          {ALL_MODES.map((m) => {
            const locked = !unlockedModes.includes(m);
            const classicRank = ranks[4];
            const showBonus = m === 5 && !locked && !bonusDismissed
              && classicRank?.position != null && classicRank.position <= 3;
            return (
              <button
                key={m}
                onClick={() => {
                  if (locked) return;
                  if (showBonus) setBonusDismissed(true);
                  setMode(m);
                  startReady(m);
                }}
                className={`fm-mode-pill ${m === mode ? "is-on" : ""} ${locked ? "is-locked" : ""} ${showBonus ? "has-bonus" : ""}`}
                disabled={locked}
                title={locked ? `Solve ${UNLOCK_THRESHOLD} in ${MODES[m - 1]?.label} to unlock` : MODES[m].short}
              >
                {locked ? "🔒 " : ""}{MODES[m].label}
                {showBonus && <span className="fm-bonus-badge">⭐</span>}
              </button>
            );
          })}
        </div>

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
                <div className="fm-progress-label">{modeCount}/{UNLOCK_THRESHOLD} to unlock {MODE_NAMES[nextMode]}</div>
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
                <div className="fm-progress-label">{solveCount}/10 to qualify for the leaderboard</div>
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
              <div className="fm-progress-label">
                {rank.position === 1
                  ? `You're #1 in ${MODE_NAMES[mode]} this week!`
                  : `#${rank.position} in ${MODE_NAMES[mode]} this week`}
              </div>
            </div>
          );
        })()}

        {/* Card tiles */}
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

        {/* Live expression preview */}
        {phase === "playing" && (
          <div className="fm-preview">
            {selected.length === 0 && (
              <span className="fm-preview-hint">Tap two cards</span>
            )}
            {selected.length === 1 && (
              <span className="fm-preview-expr">
                <span className="fm-pe-tok">{tileExprFor(aTile)}</span>
                <span className="fm-pe-tok fm-pe-empty">?</span>
                <span className="fm-pe-tok fm-pe-empty">?</span>
              </span>
            )}
            {selected.length === 2 && (
              <span className="fm-preview-expr is-ready">
                <span className="fm-pe-tok">{tileExprFor(aTile)}</span>
                <button className="fm-pe-swap" onClick={swapOperands} title="Swap operands (S)" aria-label="Swap operands" type="button">
                  ⇆
                </button>
                <span className="fm-pe-tok">{tileExprFor(bTile)}</span>
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
            <div className={`fm-ops ${selected.length === 2 ? "is-ready" : ""}`}>
              {(["+", "−", "×", "÷"] as OpSymbol[]).map((op) => (
                <button
                  key={op}
                  className="fm-op"
                  disabled={selected.length !== 2}
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
            <div className="fm-result-title">You got {target}.</div>
            <div className="fm-result-time">{fmtTime(endMs)}</div>
            <div className="fm-result-expr">{tiles[0]?.expr}</div>
            {hbEarned != null && (
              <div className="fm-hb-earned">
                +{fmtHB(hbEarned)} HB
                {speedBonus > 0 && <span className="fm-speed-tag">⚡ New PB! +{fmtHB(speedBonus)} HB</span>}
                {newBalance != null && <span> · Balance: {fmtHB(newBalance)} HB</span>}
              </div>
            )}
            {nudge && (
              <div className="fm-nudge">{nudge}</div>
            )}
            {submitting && (
              <span className="fm-preview-hint">Saving...</span>
            )}
            <div className="fm-result-actions">
              <button className="fm-btn fm-btn-primary" onClick={() => startReady()} type="button">
                Next hand
                <span className="fm-btn-key">↵</span>
              </button>
            </div>
          </div>
        )}

        {/* Bust result */}
        {phase === "bust" && (
          <div className="fm-result bust">
            <div className="fm-result-title">
              That&apos;s {rationalLabel(tiles[0]?.value)}, not {target}.
            </div>
            <div className="fm-result-expr">{tiles[0]?.expr}</div>
            <div className="fm-result-locked">
              <span className="eyebrow">No retry</span>
              <span>This hand is locked. Deal a new one.</span>
            </div>
            <div className="fm-result-actions">
              <button className="fm-btn fm-btn-primary" onClick={() => startReady()} type="button">
                Next hand
                <span className="fm-btn-key">↵</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Celebration Overlay ── */}
      {celebrations.length > 0 && (() => {
        const cel = celebrations[0];
        const dismiss = () => setCelebrations((prev) => prev.slice(1));
        if (cel.type === "unlock") {
          return (
            <div className="fm-tut-overlay fm-celebration">
              <div className="fm-tut-card">
                <div className="fm-tut-emoji">🔓</div>
                <h1 className="fm-tut-heading">You unlocked {MODE_NAMES[cel.mode]}!</h1>
                <p className="fm-tut-body">
                  {MODES[cel.mode]?.cards} cards, target {MODES[cel.mode]?.target ?? "varies"}. Ready to level up?
                </p>
                <button className="fm-btn fm-btn-primary" onClick={() => { setMode(cel.mode); startReady(cel.mode); dismiss(); }} type="button">
                  Try {MODE_NAMES[cel.mode]}
                </button>
                <button className="fm-btn fm-btn-ghost" onClick={dismiss} type="button">
                  Keep playing
                </button>
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
                You qualified in {MODE_NAMES[cel.mode]} with 10+ solves.
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
