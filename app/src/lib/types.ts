export interface Rational {
  n: number;
  d: number;
}

export interface Card {
  rank: number;
  suit: string;
}

export interface Mode {
  id: number;
  cards: number;
  target?: number;
  targetRange?: [number, number];
  label: string;
  short: string;
}

export interface Deal {
  cards: Card[];
  target: number;
  mode: number;
  unverified?: boolean;
}

export interface Tile {
  id: string;
  kind: "card" | "res";
  card?: Card;
  value: Rational;
  expr: string;
}

export interface HistoryEntry {
  tiles: Tile[];
  selected: string[];
  expression: string;
  pendingOp?: OpSymbol | null;
}

export type GamePhase = "ready" | "playing" | "won" | "bust";

export type OpSymbol = "+" | "−" | "×" | "÷";

export interface SolvePayload {
  expression: string;
  target: number;
  mode: number;
  timeMs: number;
  cards: Card[];
  offline?: boolean;
}

export interface SolveResult {
  hbEarned: number;
  newBalance: number;
  streakDays: number;
}

export interface RankData {
  position: number | null;
  avgTimeMs: number | null;
  totalRanked: number;
  solveCount: number;
}

export interface ProgressResponse {
  modeCounts: Record<number, number>;
  unlockedModes: number[];
  unlockThreshold: number;
  tutorialSeen: boolean;
  ranks: Record<number, RankData>;
}

export interface ChildProfile {
  id: string;
  name: string;
  tutorialSeen: boolean;
  hbBalance: number;
  totalSolves: number;
  streakDays: number;
  currentMode: number;
  unlockedModes: number[];
}
