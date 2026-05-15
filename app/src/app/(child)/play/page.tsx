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
  PHASE1_MODES,
  comboKey,
} from "@/lib/solver";
import type { Rational, Card, Tile, HistoryEntry, GamePhase, OpSymbol, Deal } from "@/lib/types";

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

export default function PlayPage() {
  const [mode, setMode] = useState(4);
  const [phase, setPhase] = useState<GamePhase>("ready");
  const [hand, setHand] = useState<Deal | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expression, setExpression] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [hbEarned, setHbEarned] = useState<number | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [flashOp, setFlashOp] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const target = hand?.target ?? 0;

  useEffect(() => {
    if (phase === "playing") {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime]);

  function dealHand() {
    const h = deal({ mode, onlySolvable: true });
    setHand(h);
    const t = h.cards.map(cardToTile);
    setTiles(t);
    setSelected([]);
    setHistory([]);
    setExpression("");
    setStartTime(Date.now());
    setElapsed(0);
    setHbEarned(null);
    setNewBalance(null);
    setPhase("playing");
  }

  const handleTileTap = useCallback(
    (id: string) => {
      if (phase !== "playing") return;
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((s) => s !== id);
        if (prev.length >= 2) return [prev[1], id];
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
        setFlashOp(op);
        setTimeout(() => setFlashOp(null), 400);
        return;
      }

      setHistory((prev) => [
        ...prev,
        { tiles: [...tiles], selected: [...selected], expression },
      ]);

      const needsParensA = a.kind === "res" && (op === "×" || op === "÷");
      const needsParensB = b.kind === "res";
      const exprA = needsParensA ? `(${a.expr})` : a.expr;
      const exprB = needsParensB ? `(${b.expr})` : b.expr;
      const newExpr = `${exprA} ${op} ${exprB}`;

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
        if (eqTarget(newTiles[0].value, target)) {
          setPhase("won");
          submitSolve(newExpr);
        } else {
          setPhase("bust");
        }
      }
    },
    [phase, selected, tiles, expression, target]
  );

  async function submitSolve(expr: string) {
    if (!hand) return;
    setSubmitting(true);
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
      }
    } catch {
      // offline -- will queue later
    }
    setSubmitting(false);
  }

  const undo = useCallback(() => {
    if (phase !== "playing" || history.length === 0) return;
    const last = history[history.length - 1];
    setTiles(last.tiles);
    setSelected(last.selected);
    setExpression(last.expression);
    setHistory((prev) => prev.slice(0, -1));
  }, [phase, history]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (phase === "ready" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        dealHand();
        return;
      }
      if (phase === "won" || phase === "bust") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dealHand();
        }
        return;
      }
      if (phase !== "playing") return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= tiles.length) {
        handleTileTap(tiles[num - 1].id);
        return;
      }
      if (e.key === "+" ) handleOp("+");
      if (e.key === "-") handleOp("−");
      if (e.key === "*") handleOp("×");
      if (e.key === "/") handleOp("÷");
      if (e.key === "s" || e.key === "S") swapOperands();
      if (e.key === "u" || e.key === "U" || e.key === "Backspace") undo();
      if (e.key === "Escape") setSelected([]);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, tiles, handleTileTap, handleOp, swapOperands, undo]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${s}.${tenths}s`;
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-between px-[var(--s-5)] h-14 border-b border-line"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <div className="flex items-center gap-[var(--s-3)]">
          <span className="font-bold text-lg">GTMath</span>
          <span className="text-ink-4 text-sm">
            {MODES[mode]?.label} ({MODES[mode]?.short})
          </span>
        </div>
        <div className="flex items-center gap-[var(--s-4)]">
          {phase === "playing" && (
            <span className="text-ink-3 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
              {formatTime(elapsed)}
            </span>
          )}
          <a href="/dashboard" className="text-ink-4 text-sm hover:text-ink-2">
            Dashboard
          </a>
        </div>
      </header>

      {/* Mode picker */}
      <div className="flex justify-center gap-[var(--s-2)] py-[var(--s-3)] border-b border-line-2">
        {PHASE1_MODES.map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setPhase("ready");
              setHand(null);
            }}
            className={`px-[var(--s-3)] py-[var(--s-1)] text-sm font-semibold transition-colors cursor-pointer ${
              m === mode
                ? "bg-alpha-blue text-white"
                : "bg-paper-2 text-ink-3 hover:text-ink"
            }`}
            style={{
              borderRadius: "var(--r-pill)",
              fontFamily: "var(--font-display)",
            }}
          >
            {MODES[m].label}
          </button>
        ))}
      </div>

      {/* Game area */}
      <main className="flex-1 flex flex-col items-center justify-center p-[var(--s-5)] gap-[var(--s-5)]">
        {/* Target */}
        <div className="text-center">
          <div
            className="text-ink-4 text-xs uppercase tracking-widest mb-[var(--s-1)]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Target
          </div>
          <div
            className="text-5xl font-bold tabular-nums"
            style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
          >
            {target || "—"}
          </div>
        </div>

        {phase === "ready" && (
          <button
            onClick={dealHand}
            className="px-[var(--s-7)] h-14 bg-alpha-blue text-white font-bold text-lg
                       hover:bg-alpha-blue-600 active:bg-alpha-blue-700 transition-colors cursor-pointer"
            style={{
              borderRadius: "var(--r-pill)",
              fontFamily: "var(--font-display)",
            }}
          >
            Deal
          </button>
        )}

        {(phase === "playing" || phase === "won" || phase === "bust") && (
          <>
            {/* Card tiles */}
            <div className="flex flex-wrap justify-center gap-[var(--s-3)]">
              {tiles.map((tile) => {
                const isSelected = selected.includes(tile.id);
                const selIndex = selected.indexOf(tile.id);
                return (
                  <button
                    key={tile.id}
                    onClick={() => handleTileTap(tile.id)}
                    disabled={phase !== "playing"}
                    className={`relative flex flex-col items-center justify-center
                      w-20 h-28 transition-all cursor-pointer
                      ${
                        isSelected
                          ? "ring-3 ring-alpha-blue scale-105"
                          : "hover:scale-102"
                      }
                      ${phase !== "playing" ? "opacity-70" : ""}
                    `}
                    style={{
                      borderRadius: tile.kind === "card" ? "var(--r-2xl)" : "var(--r-lg)",
                      background:
                        tile.kind === "card" ? "var(--paper)" : "var(--alpha-sky-soft)",
                      boxShadow: isSelected ? "var(--shadow-blue)" : "var(--shadow-sm)",
                      border: `2px solid ${isSelected ? "var(--alpha-blue)" : "var(--line)"}`,
                    }}
                  >
                    {selIndex >= 0 && (
                      <span
                        className="absolute -top-2 -right-2 w-5 h-5 bg-alpha-blue text-white
                                   text-xs font-bold rounded-full flex items-center justify-center"
                      >
                        {selIndex + 1}
                      </span>
                    )}
                    {tile.kind === "card" && tile.card && (
                      <>
                        <span className="text-xs text-ink-4">{tile.card.suit}</span>
                        <span
                          className="text-2xl font-bold"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {rankLabel(tile.card.rank)}
                        </span>
                      </>
                    )}
                    {tile.kind === "res" && (
                      <span
                        className="text-xl font-bold text-alpha-blue"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {rationalLabel(tile.value)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Operators */}
            {phase === "playing" && (
              <div className="flex items-center gap-[var(--s-2)]">
                {(
                  ["+", "−", "×", "÷"] as OpSymbol[]
                ).map((op) => (
                  <button
                    key={op}
                    onClick={() => handleOp(op)}
                    disabled={selected.length !== 2}
                    className={`w-14 h-14 text-xl font-bold
                      transition-all cursor-pointer
                      ${
                        selected.length === 2
                          ? "bg-alpha-blue text-white hover:bg-alpha-blue-600"
                          : "bg-paper-2 text-ink-4"
                      }
                      ${flashOp === op ? "animate-pulse bg-danger text-white" : ""}
                    `}
                    style={{
                      borderRadius: "var(--r-md)",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {op}
                  </button>
                ))}

                <button
                  onClick={swapOperands}
                  disabled={selected.length !== 2}
                  className="w-14 h-14 text-lg bg-paper-2 text-ink-3 hover:text-ink
                             disabled:opacity-30 transition-all cursor-pointer"
                  style={{ borderRadius: "var(--r-md)" }}
                  title="Swap operands"
                >
                  ⇆
                </button>

                <button
                  onClick={undo}
                  disabled={history.length === 0}
                  className="w-14 h-14 text-lg bg-paper-2 text-ink-3 hover:text-ink
                             disabled:opacity-30 transition-all cursor-pointer"
                  style={{ borderRadius: "var(--r-md)" }}
                  title="Undo"
                >
                  ↩
                </button>
              </div>
            )}

            {/* Expression preview */}
            {expression && phase === "playing" && (
              <div
                className="text-sm text-ink-3 px-[var(--s-4)] py-[var(--s-2)] bg-paper-2 max-w-full truncate"
                style={{
                  borderRadius: "var(--r-sm)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {expression}
              </div>
            )}
          </>
        )}

        {/* Won */}
        {phase === "won" && (
          <div className="text-center">
            <div
              className="text-3xl font-bold text-success mb-[var(--s-2)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Solved!
            </div>
            <div className="text-ink-3 mb-[var(--s-2)]">
              {formatTime(elapsed)} · {expression}
            </div>
            {hbEarned != null && (
              <div className="text-alpha-blue font-semibold">
                +{hbEarned} HB (balance: {newBalance} HB)
              </div>
            )}
            {submitting && (
              <div className="text-ink-4 text-sm mt-[var(--s-1)]">
                Saving...
              </div>
            )}
            <button
              onClick={dealHand}
              className="mt-[var(--s-5)] px-[var(--s-7)] h-12 bg-alpha-blue text-white font-bold
                         hover:bg-alpha-blue-600 transition-colors cursor-pointer"
              style={{
                borderRadius: "var(--r-pill)",
                fontFamily: "var(--font-display)",
              }}
            >
              Next hand
            </button>
          </div>
        )}

        {/* Bust */}
        {phase === "bust" && (
          <div className="text-center">
            <div
              className="text-3xl font-bold text-danger mb-[var(--s-2)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Bust
            </div>
            <div className="text-ink-3 mb-[var(--s-2)]">
              {rationalLabel(tiles[0]?.value)} ≠ {target}
            </div>
            <button
              onClick={dealHand}
              className="mt-[var(--s-5)] px-[var(--s-7)] h-12 bg-alpha-blue text-white font-bold
                         hover:bg-alpha-blue-600 transition-colors cursor-pointer"
              style={{
                borderRadius: "var(--r-pill)",
                fontFamily: "var(--font-display)",
              }}
            >
              Next hand
            </button>
          </div>
        )}
      </main>

      {/* Keyboard hints */}
      <footer className="hidden md:flex justify-center gap-[var(--s-5)] py-[var(--s-3)] text-xs text-ink-4 border-t border-line-2">
        <span>1-{MODES[mode]?.cards} select</span>
        <span>+ - * / operate</span>
        <span>S swap</span>
        <span>U undo</span>
        <span>Enter deal/next</span>
      </footer>
    </div>
  );
}
