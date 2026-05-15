// FastMath24 — rational arithmetic, generalized solver, smart deal for all modes.
// All values are reduced fractions {n,d} to avoid float drift.

(function (global) {
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a || 1;
  }
  function R(n, d) {
    if (d === undefined) d = 1;
    if (d === 0) return null;
    if (n === 0) return { n: 0, d: 1 };
    const sign = (d < 0) ? -1 : 1;
    n = sign * n; d = sign * d;
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  const add = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => R(a.n * b.n, a.d * b.d);
  const div = (a, b) => (b.n === 0 ? null : R(a.n * b.d, a.d * b.n));

  const eq = (a, b) => a && b && a.n * b.d === b.n * a.d;
  const isInt = (x) => x && x.d === 1;
  function eqTarget(x, target) {
    if (!x) return false;
    const t = (typeof target === 'number') ? R(target) : target;
    return x.n * t.d === t.n * x.d;
  }
  const eq24 = (x) => eqTarget(x, 24);
  const keyR = (r) => `${r.n}/${r.d}`;

  const OPS = { '+': add, '−': sub, '×': mul, '÷': div };
  function apply(op, a, b) { return OPS[op](a, b); }

  // ── Modes ──────────────────────────────────────────────────────────────
  // Each mode has cards (count) and either a fixed target or targetRange [lo, hi]
  // (inclusive). For range modes, the dealt target is a randomly-chosen
  // achievable integer in range.
  const MODES = {
    2: { id: 2, cards: 2, target: 6,    label: 'Quick',   short: '2 → 6' },
    3: { id: 3, cards: 3, target: 12,   label: 'Speed',   short: '3 → 12' },
    4: { id: 4, cards: 4, target: 24,   label: 'Classic', short: '4 → 24' },
    5: { id: 5, cards: 5, target: 72,   label: 'Combo',   short: '5 → 72' },
    6: { id: 6, cards: 6, target: 144,  label: 'Expert',  short: '6 → 144' },
    7: { id: 7, cards: 7, targetRange: [300, 500],   label: 'Power',  short: '7 → 300–500' },
    8: { id: 8, cards: 8, targetRange: [501, 999],   label: 'Master', short: '8 → 501–999' },
    9: { id: 9, cards: 9, targetRange: [1000, 9999], label: 'Wild',   short: '9 → 4 digits' },
  };
  const MODE_ORDER = [2, 3, 4, 5, 6, 7, 8, 9];

  // ── Solver: does some pairwise reduction reach `target`? ───────────────
  // Memoized per-multiset for speed at higher N.
  function solvable(nums, target, budgetMs = 1200) {
    const t = (typeof target === 'number') ? R(target) : target;
    const start = performance.now();
    const cache = new Map();
    function key(arr) {
      return arr.map(keyR).sort().join(',');
    }
    function rec(arr) {
      if (performance.now() - start > budgetMs) return null; // out of budget
      if (arr.length === 1) return eqTarget(arr[0], t);
      const k = key(arr);
      if (cache.has(k)) return cache.get(k);
      let found = false;
      outer: for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr.length; j++) {
          if (i === j) continue;
          const a = arr[i], b = arr[j];
          const rest = [];
          for (let kk = 0; kk < arr.length; kk++) if (kk !== i && kk !== j) rest.push(arr[kk]);
          // + and × are commutative; only try once
          if (i < j) {
            const aa = add(a, b); if (aa) { const r = rec([...rest, aa]); if (r === null) return null; if (r) { found = true; break outer; } }
            const mm = mul(a, b); if (mm) { const r = rec([...rest, mm]); if (r === null) return null; if (r) { found = true; break outer; } }
          }
          const ss = sub(a, b); if (ss) { const r = rec([...rest, ss]); if (r === null) return null; if (r) { found = true; break outer; } }
          const dd = div(a, b); if (dd) { const r = rec([...rest, dd]); if (r === null) return null; if (r) { found = true; break outer; } }
        }
      }
      cache.set(k, found);
      return found;
    }
    const r = rec(nums);
    return r === null ? false : r; // treat timeout as "unknown / no"
  }

  // Find ONE reduction path that reaches target. For hint/debug.
  function findSolution(nums, target, budgetMs = 1500) {
    const t = (typeof target === 'number') ? R(target) : target;
    const start = performance.now();
    const path = [];
    function rec(arr) {
      if (performance.now() - start > budgetMs) return null;
      if (arr.length === 1) return eqTarget(arr[0], t);
      for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr.length; j++) {
          if (i === j) continue;
          for (const op of ['+', '−', '×', '÷']) {
            const c = apply(op, arr[i], arr[j]);
            if (!c) continue;
            const next = [];
            for (let kk = 0; kk < arr.length; kk++) if (kk !== i && kk !== j) next.push(arr[kk]);
            next.push(c);
            path.push({ a: arr[i], b: arr[j], op, result: c });
            const r = rec(next);
            if (r === null) return null;
            if (r) return true;
            path.pop();
          }
        }
      }
      return false;
    }
    const ok = rec(nums);
    return ok ? path : [];
  }

  // All distinct values reachable by full pairwise reduction.
  // Memoized; used for variable-target dealing.
  function achievableValues(nums, budgetMs = 1500) {
    const start = performance.now();
    const cache = new Map();
    let timedOut = false;
    function key(arr) { return arr.map(keyR).sort().join(','); }
    function rec(arr) {
      if (timedOut) return new Set();
      if (performance.now() - start > budgetMs) { timedOut = true; return new Set(); }
      if (arr.length === 1) return new Set([keyR(arr[0])]);
      const k = key(arr);
      if (cache.has(k)) return cache.get(k);
      const out = new Set();
      for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr.length; j++) {
          if (i === j) continue;
          const a = arr[i], b = arr[j];
          const rest = [];
          for (let kk = 0; kk < arr.length; kk++) if (kk !== i && kk !== j) rest.push(arr[kk]);
          if (i < j) {
            const aa = add(a, b); if (aa) for (const v of rec([...rest, aa])) out.add(v);
            const mm = mul(a, b); if (mm) for (const v of rec([...rest, mm])) out.add(v);
          }
          const ss = sub(a, b); if (ss) for (const v of rec([...rest, ss])) out.add(v);
          const dd = div(a, b); if (dd) for (const v of rec([...rest, dd])) out.add(v);
        }
      }
      cache.set(k, out);
      return out;
    }
    return { values: rec(nums), timedOut };
  }

  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  const SUITS = ['♠', '♥', '♦', '♣'];

  function randomCards(count, maxRank) {
    const cards = [];
    const usedSuits = {};
    for (let i = 0; i < count; i++) {
      const rank = randInt(1, maxRank);
      const taken = usedSuits[rank] || [];
      const avail = SUITS.filter(s => !taken.includes(s));
      const suit = avail.length ? avail[Math.floor(Math.random() * avail.length)] : SUITS[Math.floor(Math.random() * 4)];
      usedSuits[rank] = [...taken, suit];
      cards.push({ rank, suit });
    }
    return cards;
  }

  // Generalized deal. Returns { cards, target, mode }.
  function deal({ mode = 4, maxRank = 13, onlySolvable = true } = {}) {
    const def = MODES[mode];
    if (!def) throw new Error('Unknown mode: ' + mode);
    const count = def.cards;
    const hasFixedTarget = def.target != null;

    let tries = 0;
    while (tries++ < 4000) {
      const cards = randomCards(count, maxRank);
      const nums = cards.map(c => R(c.rank));

      if (hasFixedTarget) {
        if (!onlySolvable || solvable(nums, def.target)) {
          return { cards, target: def.target, mode };
        }
      } else {
        // range mode: pick achievable integer in range
        if (!onlySolvable) {
          const t = randInt(def.targetRange[0], def.targetRange[1]);
          return { cards, target: t, mode };
        }
        const { values, timedOut } = achievableValues(nums, 600);
        if (timedOut) {
          // fallback: pick random target; we couldn't verify
          const t = randInt(def.targetRange[0], def.targetRange[1]);
          return { cards, target: t, mode, unverified: true };
        }
        const cands = [];
        for (const v of values) {
          const [n, d] = v.split('/').map(s => parseInt(s, 10));
          if (d === 1 && n >= def.targetRange[0] && n <= def.targetRange[1]) cands.push(n);
        }
        if (cands.length > 0) {
          const t = cands[Math.floor(Math.random() * cands.length)];
          return { cards, target: t, mode };
        }
        // else: try again with a different hand
      }
    }
    // fallback: known-solvable Classic
    return {
      cards: [{ rank: 3, suit: '♠' }, { rank: 3, suit: '♥' }, { rank: 8, suit: '♦' }, { rank: 8, suit: '♣' }],
      target: 24, mode: 4,
    };
  }

  function rankLabel(rank) {
    return ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[rank] || String(rank);
  }
  function rationalLabel(r) {
    if (!r) return '—';
    if (r.d === 1) return String(r.n);
    return `${r.n}/${r.d}`;
  }
  function toNumber(r) { return r ? r.n / r.d : NaN; }

  global.FM24 = {
    R, add, sub, mul, div, apply, eq, eqTarget, eq24, isInt,
    MODES, MODE_ORDER,
    solvable, findSolution, achievableValues,
    deal, rankLabel, rationalLabel, toNumber,
    SUITS,
  };
})(window);
