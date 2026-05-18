"use client";

import { useState, useCallback, useEffect } from "react";
import { R, apply, eqTarget, rankLabel, rationalLabel } from "@/lib/solver";
import type { Card, Tile, OpSymbol } from "@/lib/types";

const HANDS: { cards: Card[]; target: number; guide: "full" | "semi" | "free" }[] = [
  { cards: [{ rank: 3, suit: "♠" }, { rank: 3, suit: "♥" }], target: 6, guide: "full" },
  { cards: [{ rank: 2, suit: "♦" }, { rank: 3, suit: "♣" }], target: 6, guide: "semi" },
  { cards: [{ rank: 9, suit: "♠" }, { rank: 3, suit: "♥" }], target: 6, guide: "free" },
];

const CELEBRATE = ["Nice work!", "Great thinking!", "You're a natural!"];

const RED_SUITS = ["♥", "♦"];
const isRed = (s: string) => RED_SUITS.includes(s);

let tid = 0;
function mkId() {
  return `tut${tid++}`;
}

function makeTiles(cards: Card[]): Tile[] {
  return cards.map((c) => ({
    id: mkId(),
    kind: "card" as const,
    card: c,
    value: R(c.rank)!,
    expr: String(c.rank),
  }));
}

type Step = "welcome" | "playing" | "correct" | "wrong" | "done";

interface Props {
  onComplete: () => void;
}

export default function Tutorial({ onComplete }: Props) {
  const [handIdx, setHandIdx] = useState(-1);
  const [step, setStep] = useState<Step>("welcome");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingOp, setPendingOp] = useState<OpSymbol | null>(null);

  const hand = handIdx >= 0 ? HANDS[handIdx] : null;
  const target = hand?.target ?? 6;
  const guide = hand?.guide ?? "full";

  function startHand(idx: number) {
    setHandIdx(idx);
    setTiles(makeTiles(HANDS[idx].cards));
    setSelected([]);
    setPendingOp(null);
    setStep("playing");
  }

  const executeOp = useCallback(
    (op: string, firstId: string, secondId: string, currentTiles: Tile[]) => {
      const a = currentTiles.find((t) => t.id === firstId)!;
      const b = currentTiles.find((t) => t.id === secondId)!;
      const result = apply(op as OpSymbol, a.value, b.value);

      if (!result) return;

      const aExpr = a.kind === "card" ? a.expr : `(${a.expr})`;
      const bExpr = b.kind === "card" ? b.expr : `(${b.expr})`;
      const newTile: Tile = {
        id: mkId(),
        kind: "res",
        value: result,
        expr: `${aExpr} ${op} ${bExpr}`,
      };

      setTiles([newTile]);
      setSelected([]);
      setPendingOp(null);

      if (eqTarget(result, target)) {
        setStep("correct");
      } else {
        setStep("wrong");
      }
    },
    [target],
  );

  const handleTileTap = useCallback(
    (id: string) => {
      if (step !== "playing") return;

      if (selected.length === 1 && selected[0] === id) {
        // Tap same tile → deselect, clear pendingOp
        setSelected([]);
        setPendingOp(null);
        return;
      }

      if (selected.length === 1 && pendingOp) {
        // Have first card + op → execute with this second card
        executeOp(pendingOp, selected[0], id, tiles);
        return;
      }

      if (selected.length === 1 && !pendingOp) {
        // Have first card but no op → replace selection
        setSelected([id]);
        return;
      }

      // No selection → select this tile
      setSelected([id]);
      setPendingOp(null);
    },
    [step, selected, pendingOp, tiles, executeOp],
  );

  const handleOp = useCallback(
    (op: OpSymbol) => {
      if (step !== "playing" || selected.length !== 1) return;
      // Set (or replace) the pending operator
      setPendingOp(op);
    },
    [step, selected],
  );

  function retry() {
    if (!hand) return;
    setTiles(makeTiles(hand.cards));
    setSelected([]);
    setPendingOp(null);
    setStep("playing");
  }

  function advance() {
    const next = handIdx + 1;
    if (next >= HANDS.length) {
      setStep("done");
    } else {
      startHand(next);
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (step === "welcome" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        startHand(0);
        return;
      }
      if (step === "correct" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        advance();
        return;
      }
      if (step === "wrong" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        retry();
        return;
      }
      if (step === "done" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onComplete();
        return;
      }
      if (step !== "playing") return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= tiles.length) {
        e.preventDefault();
        handleTileTap(tiles[num - 1].id);
        return;
      }
      const opMap: Record<string, OpSymbol> = {
        "+": "+",
        "-": "−",
        "*": "×",
        x: "×",
        X: "×",
        "/": "÷",
      };
      if (opMap[e.key]) {
        e.preventDefault();
        handleOp(opMap[e.key]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSelected([]);
        setPendingOp(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, tiles, handleTileTap, handleOp, onComplete, handIdx]);

  // Highlight states for guided hand (full guide)
  const highlightCard0 = guide === "full" && step === "playing" && selected.length === 0 && !pendingOp;
  const highlightOp = guide === "full" && step === "playing" && selected.length === 1 && !pendingOp;
  const highlightCard1 = guide === "full" && step === "playing" && selected.length === 1 && !!pendingOp;

  let instruction = "";
  if (step === "playing") {
    if (guide === "full") {
      if (selected.length === 0) instruction = "Tap a card";
      else if (selected.length === 1 && !pendingOp) instruction = "Pick an operation";
      else if (selected.length === 1 && pendingOp) instruction = "Tap the second card";
    } else if (guide === "semi") {
      instruction = "Tap a card, pick an op, tap the second card";
    } else {
      instruction = `Your turn — make ${target}!`;
    }
  }

  // Preview tile expression helper
  const selectedTile = selected[0] ? tiles.find((t) => t.id === selected[0]) : undefined;
  const selectedExpr = selectedTile
    ? selectedTile.kind === "card"
      ? selectedTile.expr
      : `(${selectedTile.expr})`
    : null;

  if (step === "welcome") {
    return (
      <div className="fm-tut-overlay">
        <div className="fm-tut-card">
          <div className="fm-brand-mark-lg">⚡</div>
          <h1 className="fm-tut-heading">How to Play</h1>
          <p className="fm-tut-body">
            Tap a card, pick an operation, then tap a second card to combine.
            Make the target number to win!
          </p>
          <button
            className="fm-btn fm-btn-primary"
            onClick={() => startHand(0)}
            type="button"
          >
            Let&apos;s go!
          </button>
          <button className="fm-tut-skip" onClick={onComplete} type="button">
            I already know how to play
          </button>
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="fm-tut-overlay">
        <div className="fm-tut-card">
          <div className="fm-tut-emoji">{"🎉"}</div>
          <h1 className="fm-tut-heading">You&apos;re ready!</h1>
          <p className="fm-tut-body">
            Now play for real and earn Home Bucks for every solve.
          </p>
          <button
            className="fm-btn fm-btn-primary"
            onClick={onComplete}
            type="button"
          >
            Start playing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fm-stage">
      <header className="fm-top">
        <div className="fm-brand">
          <span className="fm-brand-mark">{"⚡"}</span>
          <span>Tutorial</span>
        </div>
        <div className="fm-top-right">
          <span className="fm-tut-step-badge">
            {handIdx + 1} / {HANDS.length}
          </span>
        </div>
      </header>

      <main className="fm-main is-playing">
        {instruction && step === "playing" && (
          <div className="fm-tut-banner" key={instruction}>
            {instruction}
          </div>
        )}

        <div className="fm-target-banner">
          Make <strong>{target}</strong>
        </div>

        <div className="fm-tiles count-2">
          {tiles.map((tile, i) => {
            const isSel = selected.includes(tile.id);
            const isDim = step === "playing" && selected.length === 1 && pendingOp && !isSel;
            const pulse =
              (highlightCard0 && i === 0) || (highlightCard1 && !isSel);
            const isFinal =
              tiles.length === 1 && (step === "correct" || step === "wrong");

            if (tile.kind === "card" && tile.card) {
              const red = isRed(tile.card.suit);
              return (
                <button
                  key={tile.id}
                  className={`fm-card fm-pc ${isSel ? "is-sel" : ""} ${isDim ? "is-dim" : ""} ${pulse ? "fm-tut-pulse" : ""}`}
                  onClick={() => handleTileTap(tile.id)}
                  type="button"
                >
                  <span className={`fm-pc-corner tl ${red ? "red" : ""}`}>
                    <span className="rank">{rankLabel(tile.card.rank)}</span>
                    <span className="suit">{tile.card.suit}</span>
                  </span>
                  <span className={`fm-pc-center ${red ? "red" : ""}`}>
                    {tile.card.suit}
                  </span>
                  <span className={`fm-pc-corner br ${red ? "red" : ""}`}>
                    <span className="rank">{rankLabel(tile.card.rank)}</span>
                    <span className="suit">{tile.card.suit}</span>
                  </span>
                </button>
              );
            }

            return (
              <button
                key={tile.id}
                className={`fm-card fm-rc ${isFinal ? (step === "correct" ? "is-win" : "is-bust") : ""}`}
                type="button"
              >
                <span className="fm-rc-value">{rationalLabel(tile.value)}</span>
                {tile.expr && <span className="fm-rc-expr">{tile.expr}</span>}
              </button>
            );
          })}
        </div>

        {step === "playing" && selected.length > 0 && (
          <div className="fm-preview">
            {selected.length === 1 && !pendingOp && (
              <span className="fm-preview-expr">
                <span className="fm-pe-tok">{selectedExpr}</span>
                <span className="fm-pe-tok fm-pe-empty">?</span>
                <span className="fm-pe-tok fm-pe-empty">?</span>
              </span>
            )}
            {selected.length === 1 && pendingOp && (
              <span className="fm-preview-expr is-ready">
                <span className="fm-pe-tok">{selectedExpr}</span>
                <span className="fm-pe-tok">{pendingOp}</span>
                <span className="fm-pe-tok fm-pe-empty">?</span>
              </span>
            )}
          </div>
        )}

        {step === "playing" && (
          <div className="fm-actions playing">
            <div
              className={`fm-ops ${selected.length === 1 ? "is-ready" : ""}`}
            >
              {(["+", "−", "×", "÷"] as OpSymbol[]).map(
                (op) => (
                  <button
                    key={op}
                    className={`fm-op ${highlightOp && op === "+" ? "fm-tut-pulse" : ""} ${pendingOp === op ? "is-active" : ""}`}
                    disabled={selected.length !== 1}
                    onClick={() => handleOp(op)}
                    type="button"
                  >
                    {op}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {step === "correct" && (
          <div className="fm-tut-feedback is-correct">
            <span className="fm-tut-feedback-text">{CELEBRATE[handIdx]}</span>
            <button
              className="fm-btn fm-btn-primary"
              onClick={advance}
              type="button"
            >
              {handIdx < HANDS.length - 1 ? "Next" : "Start playing!"}
            </button>
          </div>
        )}

        {step === "wrong" && (
          <div className="fm-tut-feedback is-wrong">
            <span className="fm-tut-feedback-text">
              That made {rationalLabel(tiles[0]?.value)}, not {target}. Try
              again!
            </span>
            <button
              className="fm-btn fm-btn-primary"
              onClick={retry}
              type="button"
            >
              Retry
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
