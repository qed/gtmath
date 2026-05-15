// FastMath52 — Heads-up Duel (War) mode
// Two players, split-screen (top half rotated 180° for the facing player).
// Each starts with a 12-card deck (24 unique cards from a shuffled standard deck).
// Each round: contribute top 2 from each → 4-card hand → race to make 24.
// Winner takes all 4 cards to the bottom of their deck. Game ends when someone has 0.

const { useState: _wUseState, useEffect: _wUseEffect, useRef: _wUseRef } = React;
// Aliased to dodge double-declaration across script tags.
const wUseState = _wUseState, wUseEffect = _wUseEffect, wUseRef = _wUseRef;

const WAR_TARGET = 24;

// ── Helpers ────────────────────────────────────────────────────────────────
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildFreshDecks() {
  const deck = [];
  for (let r = 1; r <= 13; r++) for (const s of FM24.SUITS) deck.push({ rank: r, suit: s });
  shuffle(deck);
  return [deck.slice(0, 12), deck.slice(12, 24)];
}

function blankPlayerState() {
  return { tiles: [], selected: [], history: [], phase: 'ready', endMs: null };
}

function pickRoundCards(decks) {
  // Take top 2 from each. If unsolvable, rotate P1's deck until it is.
  let d1 = decks[0], d2 = decks[1];
  let tries = 0;
  while (tries++ < 40) {
    const hand = [...d1.slice(0, 2), ...d2.slice(0, 2)];
    if (FM24.solvable(hand.map(c => FM24.R(c.rank)), WAR_TARGET)) {
      return { hand, decks: [d1, d2] };
    }
    // rotate d1 top → bottom
    d1 = [...d1.slice(1), d1[0]];
    if (tries === 20) {
      // start rotating d2 too
      d2 = [...d2.slice(1), d2[0]];
    }
  }
  // Last resort: shuffle decks
  return { hand: [...d1.slice(0, 2), ...d2.slice(0, 2)], decks: [shuffle([...d1]), shuffle([...d2])] };
}

function makeStartingTiles(hand) {
  return hand.map((c, i) => ({
    id: `c${i}`,
    kind: 'card',
    card: c,
    value: FM24.R(c.rank),
    expr: FM24.rankLabel(c.rank),
  }));
}

// ── Mini playing card + result tile (compact for the half-screen panel) ───
function WarTile({ tile, badge, selected, dim, locked, onClick }) {
  if (tile.kind === 'card') {
    const red = ['♥', '♦'].includes(tile.card.suit);
    const label = FM24.rankLabel(tile.card.rank);
    return (
      <button
        type="button"
        className={`war-tile war-pc ${selected ? 'is-sel' : ''} ${dim ? 'is-dim' : ''} ${red ? 'red' : ''}`}
        onClick={locked ? null : onClick}
        disabled={locked}
      >
        {badge ? <span className="war-badge">{badge}</span> : null}
        <span className="war-pc-tl">
          <span className="war-rank">{label}</span>
          <span className="war-suit">{tile.card.suit}</span>
        </span>
        <span className="war-pc-center">{tile.card.suit}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`war-tile war-rc ${selected ? 'is-sel' : ''} ${dim ? 'is-dim' : ''}`}
      onClick={locked ? null : onClick}
      disabled={locked}
    >
      {badge ? <span className="war-badge">{badge}</span> : null}
      <span className="war-rc-value">{FM24.rationalLabel(tile.value)}</span>
    </button>
  );
}

function WarOpButton({ op, disabled, onClick, ready }) {
  return (
    <button
      type="button"
      className={`war-op ${ready ? 'is-ready' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={op}
    >
      {op}
    </button>
  );
}

function fmtTime(ms) {
  if (ms == null) return '0.0';
  return (ms / 1000).toFixed(1);
}

// ── Per-player solving panel ──────────────────────────────────────────────
function WarPanel({
  player, deckSize, wins, state, phase, isRotated,
  onTap, onOp, onReady, ready, locked, elapsedMs, won, lost, push, isWinner,
}) {
  const previewExpr = (() => {
    if (state.selected.length === 0) return null;
    const a = state.tiles.find(x => x.id === state.selected[0]);
    if (!a) return null;
    const aExpr = a.kind === 'card' ? a.expr : `(${a.expr})`;
    if (state.selected.length === 1) return `${aExpr} ?  ?`;
    const b = state.tiles.find(x => x.id === state.selected[1]);
    const bExpr = b.kind === 'card' ? b.expr : `(${b.expr})`;
    return `${aExpr} ? ${bExpr}`;
  })();

  return (
    <section className={`war-panel ${isRotated ? 'is-rot' : ''} ${won ? 'is-won' : ''} ${lost ? 'is-lost' : ''}`}>
      <header className="war-panel-head">
        <div className="war-name">
          <span className="war-name-text">{player.name}</span>
          <span className="war-wins">{wins} won</span>
        </div>
        <div className="war-stats">
          <span className="war-deck">
            <span className="war-deck-stack" aria-hidden="true"></span>
            <span className="war-deck-num">{deckSize}</span>
          </span>
          <span className="war-time" aria-live="polite">{fmtTime(elapsedMs)}s</span>
        </div>
      </header>

      <div className="war-tiles">
        {state.tiles.map((tile) => {
          const selIdx = state.selected.indexOf(tile.id);
          const isSel = selIdx !== -1;
          return (
            <WarTile
              key={tile.id}
              tile={tile}
              selected={isSel}
              badge={isSel && state.selected.length === 2 ? (selIdx === 0 ? '①' : '②') : null}
              dim={state.selected.length === 2 && !isSel}
              locked={locked}
              onClick={() => onTap(tile.id)}
            />
          );
        })}
      </div>

      <div className="war-preview">
        {previewExpr ? (
          <span className="war-preview-text">{previewExpr}</span>
        ) : (
          <span className="war-preview-hint">Tap two cards</span>
        )}
      </div>

      <div className={`war-ops ${state.selected.length === 2 ? 'is-ready' : ''}`}>
        {['+', '−', '×', '÷'].map(op => (
          <WarOpButton
            key={op}
            op={op}
            disabled={locked || state.selected.length !== 2}
            ready={state.selected.length === 2 && !locked}
            onClick={() => onOp(op)}
          />
        ))}
      </div>

      {/* Pre-round overlay: Ready prompt */}
      {phase === 'pre-round' && (
        <div className="war-overlay">
          {ready ? (
            <div className="war-ready-state">Waiting for opponent…</div>
          ) : (
            <button className="war-ready-btn" onClick={onReady}>
              Ready
            </button>
          )}
        </div>
      )}

      {/* Round-over overlay */}
      {phase === 'round-over' && (
        <div className="war-overlay">
          {isWinner && <div className="war-result-big">You win the round!<br /><span>+4 cards</span></div>}
          {!isWinner && !push && <div className="war-result-big war-result-lost">You lose this round<br /><span>−2 cards</span></div>}
          {push && <div className="war-result-big war-result-push">Push.<br /><span>Decks unchanged</span></div>}
        </div>
      )}
    </section>
  );
}

// ── Setup screen ──────────────────────────────────────────────────────────
function WarSetup({ user, onStart, onExit }) {
  const [p2Name, setP2Name] = wUseState('Player 2');
  const inputRef = wUseRef(null);
  wUseEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
  function submit(e) {
    e?.preventDefault();
    const trimmed = (p2Name || '').trim() || 'Player 2';
    onStart({ p2Name: trimmed });
  }
  return (
    <div className="war-setup">
      <div className="war-setup-card">
        <span className="eyebrow">Heads-up</span>
        <h2 className="war-setup-title">Duel for the deck.</h2>
        <p className="war-setup-sub">
          Each player starts with 12 cards. Every round you each play your top 2.
          First to make 24 takes all four cards. Game ends when someone has zero.
        </p>
        <form className="war-setup-form" onSubmit={submit}>
          <div className="war-setup-row">
            <span className="war-setup-label">Player 1</span>
            <span className="war-setup-you">{user.name}</span>
          </div>
          <div className="war-setup-row">
            <label className="war-setup-label" htmlFor="war-p2">Player 2</label>
            <input
              id="war-p2"
              ref={inputRef}
              className="fm-input war-setup-input"
              type="text"
              value={p2Name}
              onChange={(e) => setP2Name(e.target.value)}
              placeholder="Name"
              maxLength={24}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="war-setup-actions">
            <button type="button" className="fm-btn fm-btn-ghost" onClick={onExit}>
              Cancel
            </button>
            <button type="submit" className="fm-btn fm-btn-primary">
              Deal cards
              <span className="fm-btn-key">↵</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main War mode ─────────────────────────────────────────────────────────
function WarMode({ user, onExit }) {
  const [setupDone, setSetupDone] = wUseState(false);
  const [names, setNames] = wUseState([user.name, 'Player 2']);
  const [decks, setDecks] = wUseState([[], []]);
  const [wins, setWins] = wUseState([0, 0]);
  const [hand, setHand] = wUseState([]);
  const [phase, setPhase] = wUseState('pre-round'); // 'pre-round' | 'racing' | 'round-over' | 'match-over'
  const [readyState, setReadyState] = wUseState([false, false]);
  const [playerStates, setPlayerStates] = wUseState([blankPlayerState(), blankPlayerState()]);
  const [roundStartTs, setRoundStartTs] = wUseState(null);
  const [elapsed, setElapsed] = wUseState([0, 0]);
  const [roundWinner, setRoundWinner] = wUseState(null); // 0 | 1 | 'push' | null
  const [matchWinner, setMatchWinner] = wUseState(null); // 0 | 1 | null

  // Start match
  function startMatch({ p2Name }) {
    const [d1, d2] = buildFreshDecks();
    setNames([user.name, p2Name]);
    setDecks([d1, d2]);
    setWins([0, 0]);
    setMatchWinner(null);
    setSetupDone(true);
    dealRound([d1, d2]);
  }

  function dealRound(currentDecks) {
    const { hand, decks: nextDecks } = pickRoundCards(currentDecks);
    setDecks(nextDecks);
    setHand(hand);
    const tiles = makeStartingTiles(hand);
    setPlayerStates([
      { ...blankPlayerState(), tiles, phase: 'ready' },
      { ...blankPlayerState(), tiles, phase: 'ready' },
    ]);
    setReadyState([false, false]);
    setRoundStartTs(null);
    setElapsed([0, 0]);
    setRoundWinner(null);
    setPhase('pre-round');
  }

  // Timer
  wUseEffect(() => {
    if (phase !== 'racing' || !roundStartTs) return;
    const id = setInterval(() => {
      setElapsed(prev => {
        const now = performance.now();
        return [
          playerStates[0].phase === 'playing' ? now - roundStartTs : prev[0],
          playerStates[1].phase === 'playing' ? now - roundStartTs : prev[1],
        ];
      });
    }, 53);
    return () => clearInterval(id);
  }, [phase, roundStartTs, playerStates[0].phase, playerStates[1].phase]);

  function setReady(pi) {
    setReadyState(prev => {
      const next = [...prev]; next[pi] = true;
      if (next[0] && next[1]) {
        // Both ready — start racing
        setPlayerStates(ps => [
          { ...ps[0], phase: 'playing' },
          { ...ps[1], phase: 'playing' },
        ]);
        setRoundStartTs(performance.now());
        setPhase('racing');
      }
      return next;
    });
  }

  function handleTileTap(pi, id) {
    if (phase !== 'racing') return;
    setPlayerStates(ps => {
      const me = ps[pi];
      if (me.phase !== 'playing') return ps;
      const idx = me.selected.indexOf(id);
      let nextSel;
      if (idx !== -1) {
        nextSel = me.selected.filter(x => x !== id);
      } else if (me.selected.length < 2) {
        nextSel = [...me.selected, id];
      } else {
        nextSel = [me.selected[0], id];
      }
      const nextMe = { ...me, selected: nextSel };
      return pi === 0 ? [nextMe, ps[1]] : [ps[0], nextMe];
    });
  }

  function handleOpTap(pi, op) {
    if (phase !== 'racing') return;
    setPlayerStates(ps => {
      const me = ps[pi];
      if (me.phase !== 'playing') return ps;
      if (me.selected.length !== 2) return ps;
      const [aId, bId] = me.selected;
      const a = me.tiles.find(x => x.id === aId);
      const b = me.tiles.find(x => x.id === bId);
      if (!a || !b) return ps;
      const result = FM24.apply(op, a.value, b.value);
      if (!result) return ps; // divide by zero — silent
      const aExpr = a.kind === 'card' ? a.expr : `(${a.expr})`;
      const bExpr = b.kind === 'card' ? b.expr : `(${b.expr})`;
      const exprStr = `${aExpr} ${op} ${bExpr}`;
      const aIdx = me.tiles.findIndex(x => x.id === aId);
      const bIdx = me.tiles.findIndex(x => x.id === bId);
      const insertAt = Math.min(aIdx, bIdx);
      const newTile = {
        id: `r${pi}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'res',
        value: result,
        expr: exprStr,
      };
      const newTiles = me.tiles.filter(x => x.id !== aId && x.id !== bId);
      newTiles.splice(insertAt, 0, newTile);
      let nextPhase = me.phase;
      let nextEnd = me.endMs;
      if (newTiles.length === 1) {
        nextEnd = performance.now() - roundStartTs;
        nextPhase = FM24.eqTarget(newTiles[0].value, WAR_TARGET) ? 'won' : 'bust';
      }
      const nextMe = {
        ...me,
        tiles: newTiles,
        selected: [],
        history: [...me.history, { tiles: me.tiles, selected: me.selected }],
        phase: nextPhase,
        endMs: nextEnd,
      };
      return pi === 0 ? [nextMe, ps[1]] : [ps[0], nextMe];
    });
  }

  // Watch for round resolution
  wUseEffect(() => {
    if (phase !== 'racing') return;
    const p0 = playerStates[0].phase, p1 = playerStates[1].phase;
    if (p0 === 'won' || p1 === 'won') {
      // someone won
      const winner = p0 === 'won' && p1 !== 'won' ? 0
        : p1 === 'won' && p0 !== 'won' ? 1
        : (playerStates[0].endMs <= playerStates[1].endMs ? 0 : 1);
      resolveRound(winner);
      return;
    }
    if (p0 === 'bust' && p1 === 'bust') {
      resolveRound('push');
    }
  }, [phase, playerStates]);

  function resolveRound(outcome) {
    setRoundWinner(outcome);
    setPhase('round-over');
    // Update decks + wins
    let [d0, d1] = decks;
    const top0 = d0.slice(0, 2), rest0 = d0.slice(2);
    const top1 = d1.slice(0, 2), rest1 = d1.slice(2);
    const wonCards = [...top0, ...top1];
    shuffle(wonCards);
    if (outcome === 0) {
      d0 = [...rest0, ...wonCards];
      d1 = rest1;
      setWins(w => [w[0] + 1, w[1]]);
    } else if (outcome === 1) {
      d1 = [...rest1, ...wonCards];
      d0 = rest0;
      setWins(w => [w[0], w[1] + 1]);
    } // push: decks unchanged (top stays)
    setDecks([d0, d1]);

    // Check for match end
    if (outcome === 0 && d1.length < 2) {
      setMatchWinner(0);
      setTimeout(() => setPhase('match-over'), 1600);
    } else if (outcome === 1 && d0.length < 2) {
      setMatchWinner(1);
      setTimeout(() => setPhase('match-over'), 1600);
    }
  }

  function nextRound() {
    if (matchWinner != null) return;
    dealRound(decks);
  }

  function rematch() {
    const [d1, d2] = buildFreshDecks();
    setDecks([d1, d2]);
    setWins([0, 0]);
    setMatchWinner(null);
    dealRound([d1, d2]);
  }

  // Render
  if (!setupDone) {
    return <WarSetup user={user} onStart={startMatch} onExit={onExit} />;
  }

  if (phase === 'match-over') {
    const winnerName = names[matchWinner];
    return (
      <div className="war-matchover">
        <div className="war-matchover-card">
          <span className="eyebrow">Match over</span>
          <h2 className="war-matchover-title">{winnerName} takes the deck.</h2>
          <div className="war-matchover-score">
            <div><strong>{names[0]}</strong>: {wins[0]} rounds</div>
            <div><strong>{names[1]}</strong>: {wins[1]} rounds</div>
          </div>
          <div className="war-matchover-actions">
            <button className="fm-btn fm-btn-ghost" onClick={onExit}>Exit duel</button>
            <button className="fm-btn fm-btn-primary" onClick={rematch}>Rematch</button>
          </div>
        </div>
      </div>
    );
  }

  const roundLocked = phase !== 'racing';
  const p0lost = roundWinner === 1;
  const p1lost = roundWinner === 0;
  const isPush = roundWinner === 'push';

  return (
    <div className="war-stage">
      <button className="war-exit" onClick={onExit} title="Exit duel" aria-label="Exit duel">✕</button>
      <WarPanel
        player={{ name: names[0] }}
        deckSize={decks[0].length}
        wins={wins[0]}
        state={playerStates[0]}
        phase={phase}
        isRotated={true}
        onTap={(id) => handleTileTap(0, id)}
        onOp={(op) => handleOpTap(0, op)}
        onReady={() => setReady(0)}
        ready={readyState[0]}
        locked={roundLocked || playerStates[0].phase !== 'playing'}
        elapsedMs={elapsed[0]}
        won={roundWinner === 0}
        lost={p0lost}
        push={isPush}
        isWinner={roundWinner === 0}
      />

      <div className={`war-center is-${phase}`}>
        <div className="war-center-row war-center-top">
          <span className="war-center-eyebrow">Round</span>
          <span className="war-center-score">{wins[0]} <span>—</span> {wins[1]}</span>
        </div>
        <div className="war-center-target">Make {WAR_TARGET}</div>
        {phase === 'round-over' && (
          <button className="fm-btn fm-btn-primary war-center-next" onClick={nextRound}>
            Next round
          </button>
        )}
        {phase === 'pre-round' && (
          <div className="war-center-hint">Both players: tap Ready</div>
        )}
      </div>

      <WarPanel
        player={{ name: names[1] }}
        deckSize={decks[1].length}
        wins={wins[1]}
        state={playerStates[1]}
        phase={phase}
        isRotated={false}
        onTap={(id) => handleTileTap(1, id)}
        onOp={(op) => handleOpTap(1, op)}
        onReady={() => setReady(1)}
        ready={readyState[1]}
        locked={roundLocked || playerStates[1].phase !== 'playing'}
        elapsedMs={elapsed[1]}
        won={roundWinner === 1}
        lost={p1lost}
        push={isPush}
        isWinner={roundWinner === 1}
      />
    </div>
  );
}

Object.assign(window, { WarMode });
