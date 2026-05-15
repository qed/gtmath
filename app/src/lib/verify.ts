import { R, add, sub, mul, div, eq, MODES } from "./solver";
import type { Rational, Card, OpSymbol } from "./types";

interface VerifyResult {
  valid: boolean;
  error?: string;
}

const OP_MAP: Record<string, (a: Rational, b: Rational) => Rational | null> = {
  "+": add,
  "−": sub,
  "×": mul,
  "÷": div,
  "-": sub,
  "*": mul,
  "/": div,
};

interface ParsedNode {
  type: "num" | "op";
  value?: number;
  op?: string;
  left?: ParsedNode;
  right?: ParsedNode;
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " ") {
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push(ch);
      i++;
      continue;
    }
    if ("+-−×÷*/".includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let num = "";
      while (i < expr.length && expr[i] >= "0" && expr[i] <= "9") {
        num += expr[i];
        i++;
      }
      tokens.push(num);
      continue;
    }
    i++;
  }
  return tokens;
}

function parseExpr(tokens: string[], pos: number): [ParsedNode, number] {
  let [left, p] = parseTerm(tokens, pos);
  while (p < tokens.length && (tokens[p] === "+" || tokens[p] === "-" || tokens[p] === "−")) {
    const op = tokens[p];
    p++;
    const [right, np] = parseTerm(tokens, p);
    left = { type: "op", op, left, right };
    p = np;
  }
  return [left, p];
}

function parseTerm(tokens: string[], pos: number): [ParsedNode, number] {
  let [left, p] = parsePrimary(tokens, pos);
  while (
    p < tokens.length &&
    (tokens[p] === "*" || tokens[p] === "/" || tokens[p] === "×" || tokens[p] === "÷")
  ) {
    const op = tokens[p];
    p++;
    const [right, np] = parsePrimary(tokens, p);
    left = { type: "op", op, left, right };
    p = np;
  }
  return [left, p];
}

function parsePrimary(tokens: string[], pos: number): [ParsedNode, number] {
  if (pos >= tokens.length) throw new Error("unexpected end of expression");
  if (tokens[pos] === "(") {
    const [node, p] = parseExpr(tokens, pos + 1);
    if (tokens[p] !== ")") throw new Error("missing closing paren");
    return [node, p + 1];
  }
  const val = parseInt(tokens[pos], 10);
  if (isNaN(val)) throw new Error(`unexpected token: ${tokens[pos]}`);
  return [{ type: "num", value: val }, pos + 1];
}

function evaluate(node: ParsedNode): Rational | null {
  if (node.type === "num") return R(node.value!);
  const left = evaluate(node.left!);
  const right = evaluate(node.right!);
  if (!left || !right) return null;
  const fn = OP_MAP[node.op!];
  if (!fn) return null;
  return fn(left, right);
}

function extractNumbers(node: ParsedNode): number[] {
  if (node.type === "num") return [node.value!];
  return [...extractNumbers(node.left!), ...extractNumbers(node.right!)];
}

export function verify(
  expression: string,
  target: number,
  mode: number,
  timeMs: number,
  cards: Card[]
): VerifyResult {
  const modeDef = MODES[mode];
  if (!modeDef) return { valid: false, error: `unknown mode: ${mode}` };

  if (modeDef.target != null && modeDef.target !== target) {
    return { valid: false, error: `target ${target} does not match mode ${mode} (expected ${modeDef.target})` };
  }

  if (modeDef.targetRange) {
    if (target < modeDef.targetRange[0] || target > modeDef.targetRange[1]) {
      return { valid: false, error: `target ${target} out of range [${modeDef.targetRange[0]}, ${modeDef.targetRange[1]}] for mode ${mode}` };
    }
  }

  if (cards.length !== modeDef.cards) {
    return { valid: false, error: `expected ${modeDef.cards} cards for mode ${mode}, got ${cards.length}` };
  }

  if (timeMs < 200 || timeMs > 600000) {
    return { valid: false, error: `timeMs out of bounds: ${timeMs}` };
  }

  let ast: ParsedNode;
  try {
    const tokens = tokenize(expression);
    const [node, pos] = parseExpr(tokens, 0);
    if (pos < tokens.length) {
      return { valid: false, error: "unexpected tokens after expression" };
    }
    ast = node;
  } catch (e: unknown) {
    return { valid: false, error: `parse error: ${e instanceof Error ? e.message : e}` };
  }

  const exprNums = extractNumbers(ast).sort((a, b) => a - b);
  const cardRanks = cards.map((c) => c.rank).sort((a, b) => a - b);
  if (exprNums.length !== cardRanks.length) {
    return { valid: false, error: "expression uses different number of values than cards dealt" };
  }
  for (let i = 0; i < exprNums.length; i++) {
    if (exprNums[i] !== cardRanks[i]) {
      return { valid: false, error: "expression values do not match dealt cards" };
    }
  }

  const result = evaluate(ast);
  if (!result) {
    return { valid: false, error: "expression evaluation failed (division by zero)" };
  }

  const targetR = R(target);
  if (!targetR || !eq(result, targetR)) {
    return { valid: false, error: `expression evaluates to ${result.n}/${result.d}, not ${target}` };
  }

  return { valid: true };
}
