// FastMath24 — main game component
// Pairwise-reduction interaction model: tap card → tap op → tap card → merge.

const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": 4,
  "cardStyle": "playing",
  "faceCards": "on",
  "smartDeal": true,
  "showHint": false,
  "showRunningExpr": true
}/*EDITMODE-END*/;

// ── helpers ────────────────────────────────────────────────────────────────
const RED = ['♥', '♦'];
const isRed = (suit) => RED.includes(suit);

function fmtTime(ms) {
  if (ms == null) return '00:00.0';
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = (s - m * 60);
  return `${String(m).padStart(2, '0')}:${sec.toFixed(1).padStart(4, '0')}`;
}

// Build a parenthesized human-readable expression for a result tile
function tileExpr(tile) { return tile.expr || tile.label; }

// ── PlayingCard: top-left + suit center + bottom-right (rotated) ───────────
function PlayingCard({ card, selected, dim, onClick, style, label, badge }) {
  const red = isRed(card.suit);
  return (
    <button
      className={`fm-card fm-pc ${selected ? 'is-sel' : ''} ${dim ? 'is-dim' : ''}`}
      style={style}
      onClick={onClick}
      type="button"
    >
      {badge ? <span className="fm-badge">{badge}</span> : null}
      <span className={`fm-pc-corner tl ${red ? 'red' : ''}`}>
        <span className="rank">{label}</span>
        <span className="suit">{card.suit}</span>
      </span>
      <span className={`fm-pc-center ${red ? 'red' : ''}`}>{card.suit}</span>
      <span className={`fm-pc-corner br ${red ? 'red' : ''}`}>
        <span className="rank">{label}</span>
        <span className="suit">{card.suit}</span>
      </span>
    </button>
  );
}

// ── ResultCard: a merged tile, sky-blue, showing value and how it got there ──
function ResultCard({ value, expr, selected, onClick, isFinal, isTarget, badge }) {
  return (
    <button
      className={`fm-card fm-rc ${selected ? 'is-sel' : ''} ${isFinal ? (isTarget ? 'is-win' : 'is-bust') : ''}`}
      onClick={onClick}
      type="button"
    >
      {badge ? <span className="fm-badge">{badge}</span> : null}
      <span className="fm-rc-value">{FM24.rationalLabel(value)}</span>
      {expr ? <span className="fm-rc-expr">{expr}</span> : null}
    </button>
  );
}

// ── Tile dispatcher ────────────────────────────────────────────────────────
function Tile(props) {
  const { tile, ...rest } = props;
  if (tile.kind === 'card') {
    return <PlayingCard card={tile.card} label={FM24.rankLabel(tile.card.rank)} {...rest} />;
  }
  return <ResultCard value={tile.value} expr={tile.expr} {...rest} />;
}

// ── Op chip ────────────────────────────────────────────────────────────────
function OpButton({ op, selected, disabled, onClick }) {
  return (
    <button
      className={`fm-op ${selected ? 'is-sel' : ''}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
      aria-label={op}
    >
      {op}
    </button>
  );
}

// Mode picker dropdown anchored to the target chip.
function ModePicker({ currentMode, onPick, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    function onClick(e) {
      if (!e.target.closest('.fm-mode-picker') && !e.target.closest('.fm-target')) onClose();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [onClose]);

  return (
    <div className="fm-mode-picker" role="menu">
      <div className="fm-mp-head">
        <span className="eyebrow">Choose a mode</span>
      </div>
      <ul className="fm-mp-list">
        {FM24.MODE_ORDER.map(id => {
          const m = FM24.MODES[id];
          const target = m.target != null ? String(m.target) : `${m.targetRange[0]}–${m.targetRange[1]}`;
          return (
            <li key={id}>
              <button
                className={`fm-mp-item ${id === currentMode ? 'is-on' : ''}`}
                onClick={() => onPick(id)}
                role="menuitemradio"
                aria-checked={id === currentMode}
              >
                <span className="fm-mp-count">{m.cards}</span>
                <span className="fm-mp-meta">
                  <span className="fm-mp-name">{m.label}</span>
                  <span className="fm-mp-sub">{m.cards} cards → {target}</span>
                </span>
                {id === currentMode ? <span className="fm-mp-check">✓</span> : <span className="fm-mp-arrow">→</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Auth
  const [currentUser, setCurrentUser] = useState(() => FM24Store.getCurrentUser());
  const [showLeaderboards, setShowLeaderboards] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSwitchUser, setShowSwitchUser] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [warMode, setWarMode] = useState(false);

  // Subscribe to store changes so user pill / leaderboards refresh
  const [, forceTick] = useState(0);
  useEffect(() => FM24Store.subscribe(() => forceTick(x => x + 1)), []);

  const dealOpts = {
    mode: t.mode || 4,
    maxRank: t.faceCards === 'on' ? 13 : 10,
    onlySolvable: t.smartDeal,
  };

  const [hand, setHand] = useState(() => FM24.deal(dealOpts));
  const [phase, setPhase] = useState('ready'); // 'ready' | 'playing' | 'won' | 'bust'
  const [startTs, setStartTs] = useState(null);
  const [endMs, setEndMs] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  // Tiles in play. Each tile has a stable id; kind === 'card' for originals, 'res' for merges.
  const [tiles, setTiles] = useState([]);
  // Card-card-op flow: collect up to 2 tile ids in tap order, then pick an op.
  const [selected, setSelected] = useState([]); // [] | [aId] | [aId, bId]
  const [history, setHistory] = useState([]);   // for undo
  const [lastSolve, setLastSolve] = useState(null); // most recent saved entry

  // Apply card-style class
  useEffect(() => {
    document.documentElement.dataset.cardStyle = t.cardStyle;
  }, [t.cardStyle]);

  // Re-deal when face-cards / smart-deal / mode change AND we're idle
  const optsKey = `${t.mode}|${t.faceCards}|${t.smartDeal}`;
  const lastOptsKey = useRef(optsKey);
  useEffect(() => {
    if (lastOptsKey.current !== optsKey) {
      lastOptsKey.current = optsKey;
      if (phase === 'ready') {
        setHand(FM24.deal(dealOpts));
      }
    }
  }, [optsKey, phase]);

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || !startTs) return;
    const id = setInterval(() => setElapsed(performance.now() - startTs), 53);
    return () => clearInterval(id);
  }, [phase, startTs]);

  // Keyboard
  useEffect(() => {
    function onKey(e) {
      if (phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startSolving();
        return;
      }
      if (phase === 'won' || phase === 'bust') {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
          e.preventDefault(); nextHand();
        }
        if (e.key === 'u' || e.key === 'U' || e.key === 'Backspace') {
          e.preventDefault(); undo();
        }
        return;
      }
      if (phase !== 'playing') return;
      const key = e.key;
      // Number 1..tiles.length toggles a tile in/out of the selection
      const n = parseInt(key, 10);
      if (!isNaN(n) && n >= 1 && n <= tiles.length) {
        e.preventDefault();
        handleTileTap(tiles[n - 1].id);
        return;
      }
      const opMap = { '+': '+', '-': '−', '*': '×', 'x': '×', 'X': '×', '/': '÷' };
      if (opMap[key]) { e.preventDefault(); handleOpTap(opMap[key]); return; }
      if (key === 'u' || key === 'U' || key === 'Backspace') { e.preventDefault(); undo(); }
      if (key === 's' || key === 'S') { e.preventDefault(); swapOperands(); }
      if (key === 'Escape') { e.preventDefault(); setSelected([]); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, tiles, selected, history]);

  function startSolving() {
    setTiles(hand.cards.map((c, i) => ({ id: `c${i}`, kind: 'card', card: c, value: FM24.R(c.rank), expr: FM24.rankLabel(c.rank) })));
    setSelected([]);
    setHistory([]);
    setEndMs(null);
    setElapsed(0);
    setStartTs(performance.now());
    setPhase('playing');
  }

  function nextHand() {
    const h = FM24.deal(dealOpts);
    setHand(h);
    setTiles([]);
    setSelected([]);
    setHistory([]);
    setStartTs(null);
    setEndMs(null);
    setElapsed(0);
    setLastSolve(null);
    setPhase('ready');
  }

  function reshuffleOnly() {
    const h = FM24.deal(dealOpts);
    setHand(h);
  }

  function handleTileTap(id) {
    if (phase !== 'playing') return;
    const idx = selected.indexOf(id);
    if (idx !== -1) {
      // Tap a selected tile to deselect it
      setSelected(selected.filter(x => x !== id));
      return;
    }
    if (selected.length < 2) {
      setSelected([...selected, id]);
    } else {
      // Replace the second (most-recent) selection
      setSelected([selected[0], id]);
    }
  }

  function swapOperands() {
    if (selected.length === 2) setSelected([selected[1], selected[0]]);
  }

  function handleOpTap(op) {
    if (phase !== 'playing') return;
    if (selected.length !== 2) return;
    const [aId, bId] = selected;
    const a = tiles.find(x => x.id === aId);
    const b = tiles.find(x => x.id === bId);
    if (!a || !b) return;
    const result = FM24.apply(op, a.value, b.value);
    if (!result) {
      // divide by zero — flash
      flashError(op);
      return;
    }
    const aExpr = a.kind === 'card' ? a.expr : `(${a.expr})`;
    const bExpr = b.kind === 'card' ? b.expr : `(${b.expr})`;
    const exprStr = `${aExpr} ${op} ${bExpr}`;
    const aIdx = tiles.findIndex(x => x.id === aId);
    const bIdx = tiles.findIndex(x => x.id === bId);
    const insertAt = Math.min(aIdx, bIdx);
    const newTile = {
      id: `r${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'res',
      value: result,
      expr: exprStr,
    };
    const newTiles = tiles.filter(x => x.id !== aId && x.id !== bId);
    newTiles.splice(insertAt, 0, newTile);

    setHistory(h => [...h, { tiles, selected }]);
    setTiles(newTiles);
    setSelected([]);

    if (newTiles.length === 1) {
      const ms = performance.now() - startTs;
      setEndMs(ms);
      if (FM24.eqTarget(newTiles[0].value, hand.target)) {
        // Record solve
        if (currentUser) {
          const combo = FM24Store.comboFromHand(hand);
          const entry = FM24Store.recordSolve({
            userId: currentUser.id,
            combo,
            timeMs: ms,
            expr: newTiles[0].expr,
          });
          setLastSolve(entry);
        }
        setPhase('won');
      } else {
        setPhase('bust');
      }
    }
  }

  function undo() {
    // Once finished (win or bust), the hand is locked. Move on to next.
    if (phase === 'won' || phase === 'bust') return;
    // If there's a pending selection, clear it first
    if (selected.length > 0) { setSelected([]); return; }
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setTiles(last.tiles);
    setSelected([]);
    setHistory(h => h.slice(0, -1));
  }

  const flashRef = useRef(null);
  function flashError(op) {
    if (flashRef.current) clearTimeout(flashRef.current);
    document.body.dataset.flashOp = op || '';
    document.body.classList.add('fm-flash');
    flashRef.current = setTimeout(() => {
      document.body.classList.remove('fm-flash');
      delete document.body.dataset.flashOp;
    }, 280);
  }

  // ── derived UI bits ──
  const tileById = (id) => tiles.find(x => x.id === id);
  const tileExprFor = (t) => t ? (t.kind === 'card' ? t.expr : `(${t.expr})`) : null;
  const aTile = selected[0] ? tileById(selected[0]) : null;
  const bTile = selected[1] ? tileById(selected[1]) : null;

  // Solution hint
  const hint = t.showHint && phase === 'playing'
    ? FM24.findSolution(hand.cards.map(c => FM24.R(c.rank)), hand.target)
    : null;

  // ── render ──
  // Gate on login
  if (!currentUser) {
    return <LoginScreen onContinue={() => setCurrentUser(FM24Store.getCurrentUser())} />;
  }

  const currentCombo = FM24Store.comboFromHand(hand);
  const modeDef = FM24.MODES[hand.mode] || FM24.MODES[4];

  // War mode takes over the screen entirely
  if (warMode) {
    return <WarMode user={currentUser} onExit={() => setWarMode(false)} />;
  }

  return (
    <div className="fm-stage">
      <header className="fm-top">
        <div className="fm-brand">
          <span className="fm-brand-mark">⚡</span>
          <span className="fm-brand-name">FastMath<span className="fm-brand-24">52</span></span>
        </div>
        <div className="fm-target-wrap">
          <button
            className={`fm-target ${showModePicker ? 'is-open' : ''}`}
            onClick={() => setShowModePicker(v => !v)}
            aria-haspopup="true"
            aria-expanded={showModePicker}
            title="Change mode"
          >
            <span className="eyebrow">Make</span>
            <span className="fm-target-num">{hand.target}</span>
            <span className="fm-target-chev">▾</span>
          </button>
          {showModePicker && (
            <ModePicker
              currentMode={hand.mode}
              onPick={(m) => {
                setShowModePicker(false);
                setTweak('mode', m);
              }}
              onClose={() => setShowModePicker(false)}
            />
          )}
        </div>
        <div className="fm-top-right">
          <div className="fm-timer" aria-live="polite">
            {phase === 'ready' ? (
              <span className="fm-timer-text fm-timer-idle">Ready</span>
            ) : phase === 'playing' ? (
              <span className="fm-timer-text">{fmtTime(elapsed)}</span>
            ) : (
              <span className="fm-timer-text">{fmtTime(endMs)}</span>
            )}
          </div>
          <button
            className="fm-icon-btn fm-icon-btn-duel"
            onClick={() => setWarMode(true)}
            aria-label="Heads-up duel"
            title="Heads-up duel (2P)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 17.5L3 6V3h3l11.5 11.5"/>
              <path d="M13 19l6-6"/>
              <path d="M16 16l4 4"/>
              <path d="M19 21l2-2"/>
              <path d="M9.5 13.5L3 20l1 1 6.5-6.5"/>
              <path d="M14 5l3-3 4 4-3 3"/>
              <path d="M21 1l-1 1"/>
            </svg>
            <span className="fm-icon-btn-label">2P</span>
          </button>
          <button
            className="fm-icon-btn"
            onClick={() => setShowLeaderboards(true)}
            aria-label="Leaderboards"
            title="Leaderboards"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M21 5h-4v3a4 4 0 0 0 4-3z"/><path d="M3 5h4v3a4 4 0 0 1-4-3z"/>
            </svg>
          </button>
          <div className="fm-user-wrap">
            <UserPill user={currentUser} onOpenMenu={() => setShowUserMenu(v => !v)} />
            {showUserMenu && (
              <UserMenu
                user={currentUser}
                onClose={() => setShowUserMenu(false)}
                onSwitch={() => { FM24Store.signOut(); setCurrentUser(null); }}
                onSignOut={() => { FM24Store.signOut(); setCurrentUser(null); }}
              />
            )}
          </div>
        </div>
      </header>

      <main className={`fm-main is-${phase}`}>
        {/* Card row */}
        <div className={`fm-tiles count-${tiles.length || hand.cards.length}`}>
          {(phase === 'ready' ? hand.cards.map((c, i) => ({
            id: `p${i}`, kind: 'card', card: c, value: FM24.R(c.rank), expr: FM24.rankLabel(c.rank),
          })) : tiles).map((tile, idx) => {
            const selIdx = selected.indexOf(tile.id);
            const isSel = selIdx !== -1;
            return (
              <Tile
                key={tile.id}
                tile={tile}
                selected={isSel}
                badge={isSel && selected.length === 2 ? (selIdx === 0 ? '①' : '②') : null}
                dim={phase === 'playing' && selected.length === 2 && !isSel}
                onClick={() => phase === 'playing' ? handleTileTap(tile.id) : null}
                isFinal={phase !== 'playing' && tiles.length === 1}
                isTarget={phase === 'won'}
                label={tile.kind === 'card' ? FM24.rankLabel(tile.card.rank) : null}
              />
            );
          })}
        </div>

        {/* Live expression preview */}
        {t.showRunningExpr && phase === 'playing' && (
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
                <button className="fm-pe-swap" onClick={swapOperands} title="Swap operands (S)" aria-label="Swap operands">⇆</button>
                <span className="fm-pe-tok">{tileExprFor(bTile)}</span>
              </span>
            )}
          </div>
        )}

        {/* Phase-specific action area */}
        {phase === 'ready' && (
          <div className="fm-actions ready">
            <button className="fm-btn fm-btn-primary" onClick={startSolving}>
              Solve
              <span className="fm-btn-key">↵</span>
            </button>
            <button className="fm-btn fm-btn-ghost" onClick={reshuffleOnly} title="Deal new cards">
              Re-deal
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <div className="fm-actions playing">
            <div className={`fm-ops ${selected.length === 2 ? 'is-ready' : ''}`}>
              {['+', '−', '×', '÷'].map(op => (
                <OpButton
                  key={op}
                  op={op}
                  selected={false}
                  disabled={selected.length !== 2}
                  onClick={() => handleOpTap(op)}
                />
              ))}
            </div>
            <div className="fm-secondary">
              <button className="fm-btn fm-btn-ghost" onClick={undo} disabled={history.length === 0 && selected.length === 0}>
                Undo
                <span className="fm-btn-key">U</span>
              </button>
              <button className="fm-btn fm-btn-ghost" onClick={() => {
                setTiles(hand.cards.map((c, i) => ({ id: `c${i}`, kind: 'card', card: c, value: FM24.R(c.rank), expr: FM24.rankLabel(c.rank) })));
                setSelected([]);
                setHistory([]);
              }} disabled={history.length === 0}>
                Restart hand
              </button>
            </div>
          </div>
        )}

        {(phase === 'won' || phase === 'bust') && (
          <div className={`fm-result ${phase}`}>
            <div className="fm-result-title">
              {phase === 'won' ? `You got ${hand.target}.` : `That's ${FM24.rationalLabel(tiles[0]?.value)}, not ${hand.target}.`}
            </div>
            {phase === 'won' && (
              <div className="fm-result-time">{fmtTime(endMs)}</div>
            )}
            <div className="fm-result-expr">{tiles[0]?.expr}</div>
            {phase === 'bust' && (
              <div className="fm-result-locked">
                <span className="eyebrow">No retry</span>
                <span>This hand is locked. Deal a new one.</span>
              </div>
            )}
            <div className="fm-result-actions">
              <button className="fm-btn fm-btn-primary" onClick={nextHand}>
                Next hand
                <span className="fm-btn-key">↵</span>
              </button>
            </div>
            {phase === 'won' && currentUser && (
              <>
                <QualifyProgress user={currentUser} mode={hand.mode} />
                <WinLeaderboard
                  user={currentUser}
                  combo={currentCombo}
                  currentSolve={lastSolve}
                />
              </>
            )}
          </div>
        )}

        {hint && (
          <div className="fm-hint">
            <span className="eyebrow">One solution</span>
            <span className="fm-hint-body">
              {hint.map((step, i) => (
                <span key={i}>{FM24.rationalLabel(step.a)} {step.op} {FM24.rationalLabel(step.b)} = {FM24.rationalLabel(step.result)}{i < hint.length - 1 ? ' · ' : ''}</span>
              ))}
            </span>
          </div>
        )}
      </main>

      <footer className="fm-foot">
        <span className="caption">
          Tap two cards · then an operation. Keys: <kbd>1</kbd>–<kbd>4</kbd>, <kbd>+</kbd> <kbd>−</kbd> <kbd>*</kbd> <kbd>/</kbd>, <kbd>S</kbd>wap, <kbd>U</kbd>ndo, <kbd>Esc</kbd>.
        </span>
      </footer>

      <TweaksPanel>
        <TweakSection label="Cards" />
        <TweakRadio
          label="Style"
          value={t.cardStyle}
          options={['playing', 'minimal']}
          onChange={(v) => setTweak('cardStyle', v)}
        />
        <TweakRadio
          label="Face cards"
          value={t.faceCards}
          options={['on', 'off']}
          onChange={(v) => setTweak('faceCards', v)}
        />
        <TweakToggle
          label="Smart deal (solvable only)"
          value={t.smartDeal}
          onChange={(v) => setTweak('smartDeal', v)}
        />
        <TweakSection label="Display" />
        <TweakToggle
          label="Live expression"
          value={t.showRunningExpr}
          onChange={(v) => setTweak('showRunningExpr', v)}
        />
        <TweakToggle
          label="Show solution hint"
          value={t.showHint}
          onChange={(v) => setTweak('showHint', v)}
        />
      </TweaksPanel>

      {showLeaderboards && (
        <LeaderboardsModal
          user={currentUser}
          currentCombo={currentCombo}
          onClose={() => setShowLeaderboards(false)}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
