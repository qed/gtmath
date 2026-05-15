// FastMath24 — localStorage data store for users + per-combination leaderboards.
// All scores are keyed by a canonical "combo" string: ranks sorted asc, joined by commas.
// e.g. {3♠, 8♣, 3♥, 8♦} → "3,3,8,8". Suits are decorative; the leaderboard is by rank multiset.

(function (global) {
  const KEY = 'fm24:v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // Shape check
      if (!parsed.users || !parsed.solves) return defaultState();
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }
  function defaultState() {
    return { users: {}, currentUserId: null, solves: [] };
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  let state = load();
  const subs = new Set();
  function notify() { subs.forEach(fn => { try { fn(); } catch (e) {} }); }
  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  // ── Combos ─────────────────────────────────────────────────────────────
  // Canonical key: "<mode>-<target>-<sortedRanksCSV>"
  // Different modes / targets are separate leaderboards even with the same ranks.
  function comboFromHand({ cards, mode, target }) {
    const ranks = cards.map(c => c.rank).slice().sort((a, b) => a - b).join(',');
    return `${mode}-${target}-${ranks}`;
  }
  // Back-compat helper for old code paths
  function comboFromCards(cards) {
    return cards.map(c => c.rank).slice().sort((a, b) => a - b).join(',');
  }
  function parseCombo(combo) {
    // "4-24-3,3,8,8" → { mode: 4, target: 24, ranks: [3,3,8,8] }
    // Tolerate legacy "3,3,8,8" → defaults to classic.
    const parts = combo.split('-');
    if (parts.length === 1) {
      return { mode: 4, target: 24, ranks: parts[0].split(',').map(Number) };
    }
    return {
      mode: parseInt(parts[0], 10),
      target: parseInt(parts[1], 10),
      ranks: parts[2].split(',').map(Number),
    };
  }
  function comboToRanks(combo) {
    return parseCombo(combo).ranks;
  }

  // ── Users ──────────────────────────────────────────────────────────────
  function getUsers() {
    return Object.values(state.users).sort((a, b) => a.createdAt - b.createdAt);
  }
  function getUser(id) { return state.users[id] || null; }
  function getCurrentUser() {
    if (!state.currentUserId) return null;
    return state.users[state.currentUserId] || null;
  }
  function setCurrentUser(id) {
    if (id && !state.users[id]) return;
    state.currentUserId = id;
    save(state); notify();
  }
  function createUser(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    // Re-use existing if name matches (case-insensitive)
    const existing = Object.values(state.users).find(u => u.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      state.currentUserId = existing.id;
      save(state); notify();
      return existing;
    }
    const id = 'u_' + Math.random().toString(36).slice(2, 9);
    state.users[id] = { id, name: trimmed, createdAt: Date.now() };
    state.currentUserId = id;
    save(state); notify();
    return state.users[id];
  }
  function renameUser(id, name) {
    if (!state.users[id]) return;
    state.users[id].name = (name || '').trim() || state.users[id].name;
    save(state); notify();
  }
  function deleteUser(id) {
    if (!state.users[id]) return;
    delete state.users[id];
    state.solves = state.solves.filter(s => s.userId !== id);
    if (state.currentUserId === id) state.currentUserId = null;
    save(state); notify();
  }
  function signOut() {
    state.currentUserId = null;
    save(state); notify();
  }

  // ── Solves ─────────────────────────────────────────────────────────────
  function recordSolve({ userId, combo, timeMs, expr }) {
    if (!userId || !state.users[userId]) return null;
    const entry = { userId, combo, timeMs: Math.round(timeMs), expr, when: Date.now() };
    state.solves.push(entry);
    save(state); notify();
    return entry;
  }

  // Best solve per user for a given combo, sorted ascending by time.
  function getLeaderboardForCombo(combo) {
    const byUser = {};
    for (const s of state.solves) {
      if (s.combo !== combo) continue;
      if (!byUser[s.userId] || s.timeMs < byUser[s.userId].timeMs) {
        byUser[s.userId] = s;
      }
    }
    return Object.values(byUser).sort((a, b) => a.timeMs - b.timeMs);
  }

  // User's best solve for this combo (or null).
  function getUserBestForCombo(userId, combo) {
    let best = null;
    for (const s of state.solves) {
      if (s.userId !== userId || s.combo !== combo) continue;
      if (!best || s.timeMs < best.timeMs) best = s;
    }
    return best;
  }

  // Find the user's rank in this combo's leaderboard (1-based), and total entries.
  function getUserRankForCombo(userId, combo) {
    const board = getLeaderboardForCombo(combo);
    const idx = board.findIndex(s => s.userId === userId);
    return { rank: idx === -1 ? null : idx + 1, total: board.length, board };
  }

  // List of all combos with any solves, with summary stats.
  function getAllCombos({ userId, mode } = {}) {
    const summary = {};
    for (const s of state.solves) {
      const parsed = parseCombo(s.combo);
      if (mode != null && parsed.mode !== mode) continue;
      const e = summary[s.combo] || (summary[s.combo] = {
        combo: s.combo,
        mode: parsed.mode,
        target: parsed.target,
        ranks: parsed.ranks,
        bestTime: Infinity, bestUserId: null,
        userBest: null, totalSolves: 0, uniqueUsers: new Set(),
      });
      e.totalSolves++;
      e.uniqueUsers.add(s.userId);
      if (s.timeMs < e.bestTime) { e.bestTime = s.timeMs; e.bestUserId = s.userId; }
      if (userId && s.userId === userId && (!e.userBest || s.timeMs < e.userBest.timeMs)) e.userBest = s;
    }
    return Object.values(summary)
      .map(e => ({ ...e, uniqueUsers: e.uniqueUsers.size }))
      .sort((a, b) => a.totalSolves !== b.totalSolves ? b.totalSolves - a.totalSolves : a.combo.localeCompare(b.combo));
  }

  // Aggregate stats for a user, optionally filtered by mode.
  function getUserStats(userId, { mode } = {}) {
    const mine = state.solves.filter(s => {
      if (s.userId !== userId) return false;
      if (mode != null) {
        const p = parseCombo(s.combo);
        if (p.mode !== mode) return false;
      }
      return true;
    });
    if (mine.length === 0) return { solves: 0, distinctCombos: 0, fastest: null, fastest10Avg: null, fastest10Count: 0, bests: [] };
    const byCombo = {};
    for (const s of mine) {
      if (!byCombo[s.combo] || s.timeMs < byCombo[s.combo].timeMs) byCombo[s.combo] = s;
    }
    const bests = Object.values(byCombo).sort((a, b) => a.timeMs - b.timeMs);
    const top10 = bests.slice(0, 10);
    const avg = top10.length > 0 ? top10.reduce((s, e) => s + e.timeMs, 0) / top10.length : null;
    return {
      solves: mine.length,
      distinctCombos: bests.length,
      fastest: bests[0],
      fastest10Avg: avg,
      fastest10Count: top10.length,
      bests,
    };
  }

  // One row per user, with metrics for the given mode filter.
  function getPlayersLeaderboard({ mode } = {}) {
    return Object.values(state.users).map(u => ({
      user: u,
      ...getUserStats(u.id, { mode }),
    }));
  }

  // Dev / debug
  function _wipe() { state = defaultState(); save(state); notify(); }
  function _dump() { return JSON.parse(JSON.stringify(state)); }

  global.FM24Store = {
    subscribe,
    comboFromHand, comboFromCards, comboToRanks, parseCombo,
    getUsers, getUser, getCurrentUser, setCurrentUser, createUser, renameUser, deleteUser, signOut,
    recordSolve,
    getLeaderboardForCombo, getUserBestForCombo, getUserRankForCombo,
    getAllCombos, getUserStats, getPlayersLeaderboard,
    _wipe, _dump,
  };
})(window);
