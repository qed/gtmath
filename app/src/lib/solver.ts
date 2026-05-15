import type { Rational, Card, Mode, Deal, OpSymbol } from "./types";

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

export function R(n: number, d: number = 1): Rational | null {
  if (d === 0) return null;
  if (n === 0) return { n: 0, d: 1 };
  const sign = d < 0 ? -1 : 1;
  n = sign * n;
  d = sign * d;
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export const add = (a: Rational, b: Rational): Rational | null =>
  R(a.n * b.d + b.n * a.d, a.d * b.d);

export const sub = (a: Rational, b: Rational): Rational | null =>
  R(a.n * b.d - b.n * a.d, a.d * b.d);

export const mul = (a: Rational, b: Rational): Rational | null =>
  R(a.n * b.n, a.d * b.d);

export const div = (a: Rational, b: Rational): Rational | null =>
  b.n === 0 ? null : R(a.n * b.d, a.d * b.n);

export const eq = (a: Rational | null, b: Rational | null): boolean =>
  a !== null && b !== null && a.n * b.d === b.n * a.d;

export const isInt = (x: Rational | null): boolean =>
  x !== null && x.d === 1;

export function eqTarget(x: Rational | null, target: number | Rational): boolean {
  if (!x) return false;
  const t = typeof target === "number" ? R(target)! : target;
  return x.n * t.d === t.n * x.d;
}

export const eq24 = (x: Rational | null): boolean => eqTarget(x, 24);

export const keyR = (r: Rational): string => `${r.n}/${r.d}`;

const OPS: Record<OpSymbol, (a: Rational, b: Rational) => Rational | null> = {
  "+": add,
  "−": sub,
  "×": mul,
  "÷": div,
};

export function apply(op: OpSymbol, a: Rational, b: Rational): Rational | null {
  return OPS[op](a, b);
}

export const MODES: Record<number, Mode> = {
  2: { id: 2, cards: 2, target: 6, label: "Quick", short: "2 → 6" },
  3: { id: 3, cards: 3, target: 12, label: "Speed", short: "3 → 12" },
  4: { id: 4, cards: 4, target: 24, label: "Classic", short: "4 → 24" },
  5: { id: 5, cards: 5, target: 72, label: "Combo", short: "5 → 72" },
  6: { id: 6, cards: 6, target: 144, label: "Expert", short: "6 → 144" },
  7: { id: 7, cards: 7, targetRange: [300, 500], label: "Power", short: "7 → 300–500" },
  8: { id: 8, cards: 8, targetRange: [501, 999], label: "Master", short: "8 → 501–999" },
  9: { id: 9, cards: 9, targetRange: [1000, 9999], label: "Wild", short: "9 → 4 digits" },
};

export const MODE_ORDER = [2, 3, 4, 5, 6, 7, 8, 9];

export const PHASE1_MODES = [2, 3, 4, 5];

export function solvable(
  nums: Rational[],
  target: number | Rational,
  budgetMs: number = 1200
): boolean {
  const t = typeof target === "number" ? R(target)! : target;
  const start = performance.now();
  const cache = new Map<string, boolean>();

  function key(arr: Rational[]): string {
    return arr.map(keyR).sort().join(",");
  }

  function rec(arr: Rational[]): boolean | null {
    if (performance.now() - start > budgetMs) return null;
    if (arr.length === 1) return eqTarget(arr[0], t);
    const k = key(arr);
    if (cache.has(k)) return cache.get(k)!;
    let found = false;
    outer: for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        const a = arr[i],
          b = arr[j];
        const rest: Rational[] = [];
        for (let kk = 0; kk < arr.length; kk++)
          if (kk !== i && kk !== j) rest.push(arr[kk]);
        if (i < j) {
          const aa = add(a, b);
          if (aa) {
            const r = rec([...rest, aa]);
            if (r === null) return null;
            if (r) { found = true; break outer; }
          }
          const mm = mul(a, b);
          if (mm) {
            const r = rec([...rest, mm]);
            if (r === null) return null;
            if (r) { found = true; break outer; }
          }
        }
        const ss = sub(a, b);
        if (ss) {
          const r = rec([...rest, ss]);
          if (r === null) return null;
          if (r) { found = true; break outer; }
        }
        const dd = div(a, b);
        if (dd) {
          const r = rec([...rest, dd]);
          if (r === null) return null;
          if (r) { found = true; break outer; }
        }
      }
    }
    cache.set(k, found);
    return found;
  }

  const r = rec(nums);
  return r === null ? false : r;
}

export interface SolutionStep {
  a: Rational;
  b: Rational;
  op: string;
  result: Rational;
}

export function findSolution(
  nums: Rational[],
  target: number | Rational,
  budgetMs: number = 1500
): SolutionStep[] {
  const t = typeof target === "number" ? R(target)! : target;
  const start = performance.now();
  const path: SolutionStep[] = [];

  function rec(arr: Rational[]): boolean | null {
    if (performance.now() - start > budgetMs) return null;
    if (arr.length === 1) return eqTarget(arr[0], t);
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        for (const op of ["+", "−", "×", "÷"] as OpSymbol[]) {
          const c = apply(op, arr[i], arr[j]);
          if (!c) continue;
          const next: Rational[] = [];
          for (let kk = 0; kk < arr.length; kk++)
            if (kk !== i && kk !== j) next.push(arr[kk]);
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

export function achievableValues(
  nums: Rational[],
  budgetMs: number = 1500
): { values: Set<string>; timedOut: boolean } {
  const start = performance.now();
  const cache = new Map<string, Set<string>>();
  let timedOut = false;

  function key(arr: Rational[]): string {
    return arr.map(keyR).sort().join(",");
  }

  function rec(arr: Rational[]): Set<string> {
    if (timedOut) return new Set();
    if (performance.now() - start > budgetMs) {
      timedOut = true;
      return new Set();
    }
    if (arr.length === 1) return new Set([keyR(arr[0])]);
    const k = key(arr);
    if (cache.has(k)) return cache.get(k)!;
    const out = new Set<string>();
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        const a = arr[i],
          b = arr[j];
        const rest: Rational[] = [];
        for (let kk = 0; kk < arr.length; kk++)
          if (kk !== i && kk !== j) rest.push(arr[kk]);
        if (i < j) {
          const aa = add(a, b);
          if (aa) for (const v of rec([...rest, aa])) out.add(v);
          const mm = mul(a, b);
          if (mm) for (const v of rec([...rest, mm])) out.add(v);
        }
        const ss = sub(a, b);
        if (ss) for (const v of rec([...rest, ss])) out.add(v);
        const dd = div(a, b);
        if (dd) for (const v of rec([...rest, dd])) out.add(v);
      }
    }
    cache.set(k, out);
    return out;
  }

  return { values: rec(nums), timedOut };
}

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export const SUITS = ["♠", "♥", "♦", "♣"];

function randomCards(count: number, maxRank: number): Card[] {
  const cards: Card[] = [];
  const usedSuits: Record<number, string[]> = {};
  for (let i = 0; i < count; i++) {
    const rank = randInt(1, maxRank);
    const taken = usedSuits[rank] || [];
    const avail = SUITS.filter((s) => !taken.includes(s));
    const suit = avail.length
      ? avail[Math.floor(Math.random() * avail.length)]
      : SUITS[Math.floor(Math.random() * 4)];
    usedSuits[rank] = [...taken, suit];
    cards.push({ rank, suit });
  }
  return cards;
}

export function deal(opts: {
  mode?: number;
  maxRank?: number;
  onlySolvable?: boolean;
} = {}): Deal {
  const { mode = 4, maxRank = 13, onlySolvable = true } = opts;
  const def = MODES[mode];
  if (!def) throw new Error("Unknown mode: " + mode);
  const count = def.cards;
  const hasFixedTarget = def.target != null;

  let tries = 0;
  while (tries++ < 4000) {
    const cards = randomCards(count, maxRank);
    const nums = cards.map((c) => R(c.rank)!);

    if (hasFixedTarget) {
      if (!onlySolvable || solvable(nums, def.target!)) {
        return { cards, target: def.target!, mode };
      }
    } else {
      if (!onlySolvable) {
        const t = randInt(def.targetRange![0], def.targetRange![1]);
        return { cards, target: t, mode };
      }
      const { values, timedOut } = achievableValues(nums, 600);
      if (timedOut) {
        const t = randInt(def.targetRange![0], def.targetRange![1]);
        return { cards, target: t, mode, unverified: true };
      }
      const cands: number[] = [];
      for (const v of values) {
        const [n, d] = v.split("/").map((s) => parseInt(s, 10));
        if (d === 1 && n >= def.targetRange![0] && n <= def.targetRange![1])
          cands.push(n);
      }
      if (cands.length > 0) {
        const t = cands[Math.floor(Math.random() * cands.length)];
        return { cards, target: t, mode };
      }
    }
  }

  return {
    cards: [
      { rank: 3, suit: "♠" },
      { rank: 3, suit: "♥" },
      { rank: 8, suit: "♦" },
      { rank: 8, suit: "♣" },
    ],
    target: 24,
    mode: 4,
  };
}

export function rankLabel(rank: number): string {
  return ({ 1: "A", 11: "J", 12: "Q", 13: "K" } as Record<number, string>)[rank] || String(rank);
}

export function rationalLabel(r: Rational | null): string {
  if (!r) return "—";
  if (r.d === 1) return String(r.n);
  return `${r.n}/${r.d}`;
}

export function toNumber(r: Rational | null): number {
  return r ? r.n / r.d : NaN;
}

export function comboKey(mode: number, target: number, cards: Card[]): string {
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b).join(",");
  return `${mode}-${target}-${ranks}`;
}
