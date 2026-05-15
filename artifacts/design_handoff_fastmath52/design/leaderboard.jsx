// FastMath24 — Leaderboard UI components

const { useState, useEffect, useMemo } = React;

function rankLabel_(r) { return ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[r] || String(r); }

// Tiny visual representation of a combo: 4 little rank tiles.
function MiniCards({ ranks, size = 'sm', highlight = false }) {
  return (
    <span className={`fm-mini ${size === 'lg' ? 'lg' : ''} ${highlight ? 'hi' : ''}`}>
      {ranks.map((r, i) => (
        <span key={i} className="fm-mini-card">{rankLabel_(r)}</span>
      ))}
    </span>
  );
}

function fmtTime_(ms) {
  if (ms == null) return '—';
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = (s - m * 60);
  if (m > 0) return `${m}:${sec.toFixed(1).padStart(4, '0')}`;
  return `${sec.toFixed(1)}s`;
}

function medalFor(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

// Progress toward qualifying for the Fastest-10 leaderboard.
function QualifyProgress({ user, mode, compact = false }) {
  const stats = FM24Store.getUserStats(user.id, { mode });
  const modeLabel = FM24.MODES[mode]?.label || '';
  const count = Math.min(stats.distinctCombos, 99);
  const need = Math.max(0, 10 - count);
  const qualified = count >= 10;
  const pips = Array.from({ length: 10 }).map((_, i) => (
    <span key={i} className={`fm-qp-pip ${i < count ? 'is-on' : ''} ${qualified ? 'is-done' : ''}`} />
  ));

  return (
    <div className={`fm-qp ${qualified ? 'is-qualified' : ''} ${compact ? 'is-compact' : ''}`}>
      <div className="fm-qp-pips" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(count, 10)}>
        {pips}
      </div>
      <div className="fm-qp-text">
        {qualified ? (
          <>
            <span className="fm-qp-check">✓</span>
            <span><strong>Qualified.</strong> {modeLabel} fastest-10 avg <strong>{fmtTime_(stats.fastest10Avg)}</strong></span>
          </>
        ) : need === 1 ? (
          <span><strong>1 more</strong> {modeLabel} hand to qualify for the fastest-10 board</span>
        ) : (
          <span><strong>{need} more</strong> {modeLabel} hands to qualify · <span className="fm-qp-count">{count}/10</span></span>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({ rank, name, time, expr, isYou, isJustSet }) {
  const medal = medalFor(rank);
  return (
    <li className={`fm-lb-row ${isYou ? 'is-you' : ''} ${isJustSet ? 'is-flash' : ''}`}>
      <span className="fm-lb-rank">{medal || `#${rank}`}</span>
      <span className="fm-lb-name">
        <Avatar name={name} size={22} />
        <span className="fm-lb-name-text">{name}{isYou ? <span className="fm-lb-you"> · you</span> : null}</span>
      </span>
      <span className="fm-lb-time">{fmtTime_(time)}</span>
      {expr ? <span className="fm-lb-expr">{expr}</span> : null}
    </li>
  );
}

// Compact leaderboard shown after a win.
function WinLeaderboard({ user, combo, currentSolve }) {
  const { board, rank } = FM24Store.getUserRankForCombo(user.id, combo);
  const top = board.slice(0, 5);
  const youInTop = rank != null && rank <= 5;
  return (
    <div className="fm-winboard">
      <div className="fm-winboard-head">
        <span className="eyebrow">Top times · this hand</span>
        {rank ? (
          <span className="fm-winboard-rank">
            {rank === 1 ? "You're #1!" : `Your rank: #${rank} of ${board.length}`}
          </span>
        ) : null}
      </div>
      <ol className="fm-lb-list">
        {top.map((s, i) => (
          <LeaderboardRow
            key={s.userId + s.when}
            rank={i + 1}
            name={(FM24Store.getUser(s.userId) || {}).name || '?'}
            time={s.timeMs}
            isYou={s.userId === user.id}
            isJustSet={currentSolve && s.when === currentSolve.when}
          />
        ))}
        {!youInTop && rank != null && (
          <>
            <li className="fm-lb-gap">···</li>
            <LeaderboardRow
              rank={rank}
              name={user.name}
              time={board[rank - 1].timeMs}
              isYou={true}
              isJustSet={currentSolve && board[rank - 1].when === currentSolve.when}
            />
          </>
        )}
      </ol>
    </div>
  );
}

// Full leaderboard browser modal.
function LeaderboardsModal({ user, currentCombo, onClose }) {
  const parsedCurrent = currentCombo ? FM24Store.parseCombo(currentCombo) : null;
  const [tab, setTab] = useState('players'); // 'players' | 'hands'
  const [view, setView] = useState('list'); // 'list' | 'combo'
  const [openCombo, setOpenCombo] = useState(null);
  const [handsFilter, setHandsFilter] = useState('all'); // 'all' | 'yours'
  const [modeFilter, setModeFilter] = useState(parsedCurrent ? parsedCurrent.mode : 'all'); // 'all' | mode id

  const allCombos = useMemo(() => FM24Store.getAllCombos({ userId: user.id }), []);
  const yourCombos = allCombos.filter(c => c.userBest);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') {
      if (view === 'combo') { setView('list'); setOpenCombo(null); }
      else onClose();
    }}
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, onClose]);

  // Hands list
  const baseList = handsFilter === 'yours' ? yourCombos : allCombos;
  const handsList = modeFilter === 'all' ? baseList : baseList.filter(c => c.mode === modeFilter);

  // Modes that have any entries in the current scope
  const allModesPresent = useMemo(() => {
    const s = new Set();
    for (const c of allCombos) s.add(c.mode);
    return Array.from(s).sort((a, b) => a - b);
  }, [allCombos]);

  function openCombosCombo(combo) {
    setOpenCombo(combo);
    setView('combo');
  }

  return (
    <div className="fm-modal" onClick={(e) => e.target.classList.contains('fm-modal') && onClose()}>
      <div className="fm-modal-card">
        <header className="fm-modal-head">
          {view === 'combo' ? (
            <button className="fm-modal-back" onClick={() => { setView('list'); setOpenCombo(null); }}>
              ← Back
            </button>
          ) : (
            <h2 className="fm-modal-title">Leaderboards</h2>
          )}
          <button className="fm-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {view === 'list' && (
          <>
            <div className="fm-tabs">
              <button
                className={`fm-tab ${tab === 'players' ? 'is-on' : ''}`}
                onClick={() => setTab('players')}
              >Players</button>
              <button
                className={`fm-tab ${tab === 'hands' ? 'is-on' : ''}`}
                onClick={() => setTab('hands')}
              >Hands <span className="fm-tab-count">{allCombos.length}</span></button>
            </div>

            {allModesPresent.length >= 1 && (
              <div className="fm-mode-filter">
                <button
                  className={`fm-mode-chip ${modeFilter === 'all' ? 'is-on' : ''}`}
                  onClick={() => setModeFilter('all')}
                >All modes</button>
                {allModesPresent.map(mId => {
                  const m = FM24.MODES[mId];
                  return (
                    <button
                      key={mId}
                      className={`fm-mode-chip ${modeFilter === mId ? 'is-on' : ''}`}
                      onClick={() => setModeFilter(mId)}
                    >{m.label} <span className="fm-mode-chip-sub">{m.cards}×</span></button>
                  );
                })}
              </div>
            )}

            {tab === 'players' && (
              <PlayersView user={user} mode={modeFilter === 'all' ? null : modeFilter} />
            )}

            {tab === 'hands' && (
              <>
                <div className="fm-subtabs">
                  <button
                    className={`fm-subtab ${handsFilter === 'all' ? 'is-on' : ''}`}
                    onClick={() => setHandsFilter('all')}
                  >All <span className="fm-tab-count">{allCombos.length}</span></button>
                  <button
                    className={`fm-subtab ${handsFilter === 'yours' ? 'is-on' : ''}`}
                    onClick={() => setHandsFilter('yours')}
                  >Yours <span className="fm-tab-count">{yourCombos.length}</span></button>
                </div>
                <div className="fm-modal-body">
                  {handsList.length === 0 ? (
                    <div className="fm-empty">
                      <div className="fm-empty-mark">📭</div>
                      <div className="fm-empty-title">No solves yet</div>
                      <div className="fm-empty-sub">Solve a hand to start the board.</div>
                    </div>
                  ) : (
                    <ul className="fm-combo-list">
                      {handsList.map(c => {
                        const bestUser = FM24Store.getUser(c.bestUserId);
                        const m = FM24.MODES[c.mode];
                        return (
                          <li key={c.combo}>
                            <button className={`fm-combo-row ${c.combo === currentCombo ? 'is-current' : ''}`} onClick={() => openCombosCombo(c.combo)}>
                              <MiniCards ranks={c.ranks} size="sm" />
                              <span className="fm-combo-meta">
                                <span className="fm-combo-best">
                                  <span className="fm-combo-best-time">{fmtTime_(c.bestTime)}</span>
                                  <span className="fm-combo-best-who">{bestUser ? bestUser.name : '—'}</span>
                                  <span className="fm-combo-mode-badge">→ {c.target}</span>
                                </span>
                                <span className="fm-combo-stats">
                                  {c.userBest ? (
                                    <span className="fm-combo-mine">your best {fmtTime_(c.userBest.timeMs)}</span>
                                  ) : (
                                    <span className="fm-combo-mine fm-combo-mine-empty">not yet solved by you</span>
                                  )}
                                  <span className="fm-combo-count">· {c.totalSolves} solve{c.totalSolves === 1 ? '' : 's'}</span>
                                  {m && <span className="fm-combo-mode-name">· {m.label}</span>}
                                </span>
                              </span>
                              <span className="fm-combo-arrow">→</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {view === 'combo' && openCombo && (
          <ComboDetail user={user} combo={openCombo} />
        )}
      </div>
    </div>
  );
}

// Players leaderboard: two boards (Most Solved, Fastest 10 Avg).
function PlayersView({ user, mode }) {
  const rows = useMemo(() => FM24Store.getPlayersLeaderboard({ mode }), [mode]);
  const bySolved = rows.filter(r => r.distinctCombos > 0).sort((a, b) => {
    if (b.distinctCombos !== a.distinctCombos) return b.distinctCombos - a.distinctCombos;
    return (a.fastest10Avg || Infinity) - (b.fastest10Avg || Infinity);
  });
  const eligibleAvg = rows.filter(r => r.fastest10Count >= 10).sort((a, b) => a.fastest10Avg - b.fastest10Avg);
  const partial = rows.filter(r => r.fastest10Count > 0 && r.fastest10Count < 10)
    .sort((a, b) => a.fastest10Avg - b.fastest10Avg);

  const modeLabel = mode ? FM24.MODES[mode].label : 'All modes';

  return (
    <div className="fm-modal-body">
      <section className="fm-pv-section">
        <header className="fm-pv-head">
          <h3 className="fm-pv-title">Most solved</h3>
          <span className="fm-pv-sub">{modeLabel} · distinct hands, first try</span>
        </header>
        {bySolved.length === 0 ? (
          <div className="fm-empty fm-empty-compact">
            <div className="fm-empty-title">No solves yet</div>
            <div className="fm-empty-sub">Solve a hand to land on the board.</div>
          </div>
        ) : (
          <ol className="fm-pv-list">
            {bySolved.map((r, i) => (
              <li key={r.user.id} className={`fm-pv-row ${r.user.id === user.id ? 'is-you' : ''}`}>
                <span className="fm-pv-rank">{medalFor(i + 1) || `#${i + 1}`}</span>
                <span className="fm-pv-name">
                  <Avatar name={r.user.name} size={22} />
                  <span className="fm-pv-name-text">{r.user.name}{r.user.id === user.id ? <span className="fm-lb-you"> · you</span> : null}</span>
                </span>
                <span className="fm-pv-metric">
                  <span className="fm-pv-num">{r.distinctCombos}</span>
                  <span className="fm-pv-unit">{r.distinctCombos === 1 ? 'hand' : 'hands'}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="fm-pv-section">
        <header className="fm-pv-head">
          <h3 className="fm-pv-title">Fastest 10 — avg</h3>
          <span className="fm-pv-sub">{modeLabel} · need 10 hands to qualify</span>
        </header>
        {mode && <QualifyProgress user={user} mode={mode} compact />}
        {eligibleAvg.length === 0 && partial.length === 0 ? (
          <div className="fm-empty fm-empty-compact">
            <div className="fm-empty-title">No qualifiers yet</div>
            <div className="fm-empty-sub">Solve 10 different hands to qualify.</div>
          </div>
        ) : (
          <>
            {eligibleAvg.length > 0 && (
              <ol className="fm-pv-list">
                {eligibleAvg.map((r, i) => (
                  <li key={r.user.id} className={`fm-pv-row ${r.user.id === user.id ? 'is-you' : ''}`}>
                    <span className="fm-pv-rank">{medalFor(i + 1) || `#${i + 1}`}</span>
                    <span className="fm-pv-name">
                      <Avatar name={r.user.name} size={22} />
                      <span className="fm-pv-name-text">{r.user.name}{r.user.id === user.id ? <span className="fm-lb-you"> · you</span> : null}</span>
                    </span>
                    <span className="fm-pv-metric">
                      <span className="fm-pv-num">{fmtTime_(r.fastest10Avg)}</span>
                      <span className="fm-pv-unit">avg</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {partial.length > 0 && (
              <>
                <div className="fm-pv-divider">
                  <span>Working toward 10</span>
                </div>
                <ol className="fm-pv-list fm-pv-list-muted">
                  {partial.map((r) => (
                    <li key={r.user.id} className={`fm-pv-row fm-pv-row-muted ${r.user.id === user.id ? 'is-you' : ''}`}>
                      <span className="fm-pv-rank">—</span>
                      <span className="fm-pv-name">
                        <Avatar name={r.user.name} size={22} />
                        <span className="fm-pv-name-text">{r.user.name}{r.user.id === user.id ? <span className="fm-lb-you"> · you</span> : null}</span>
                      </span>
                      <span className="fm-pv-metric">
                        <span className="fm-pv-num">{fmtTime_(r.fastest10Avg)}</span>
                        <span className="fm-pv-unit">{r.fastest10Count}/10</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ComboDetail({ user, combo }) {
  const parsed = FM24Store.parseCombo(combo);
  const board = FM24Store.getLeaderboardForCombo(combo);
  const mode = FM24.MODES[parsed.mode];
  return (
    <div className="fm-modal-body">
      <div className="fm-combo-detail-head">
        <MiniCards ranks={parsed.ranks} size="lg" />
        <div className="fm-combo-detail-meta">
          <span className="eyebrow">{mode ? mode.label : 'Hand'} · make {parsed.target}</span>
          <span className="fm-combo-detail-title">Top times</span>
        </div>
      </div>
      {board.length === 0 ? (
        <div className="fm-empty">
          <div className="fm-empty-title">No solves yet.</div>
          <div className="fm-empty-sub">Be the first.</div>
        </div>
      ) : (
        <ol className="fm-lb-list fm-lb-list-full">
          {board.map((s, i) => (
            <LeaderboardRow
              key={s.userId + s.when}
              rank={i + 1}
              name={(FM24Store.getUser(s.userId) || {}).name || '?'}
              time={s.timeMs}
              expr={s.expr}
              isYou={s.userId === user.id}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

Object.assign(window, { MiniCards, LeaderboardRow, WinLeaderboard, LeaderboardsModal, PlayersView, QualifyProgress });
