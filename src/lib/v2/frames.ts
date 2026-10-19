// Кадры разбора для табло: из story() движка — что стоит на табло, что обведено, какая картинка под ним.
// Табло показывает «кучку» чисел и как она тает по шагам: 87+98 → 87+100−2 → 187−2 → 185.

import type { Line, Plan, TechniqueId } from "../engine/types.ts";
import { FOUNDATIONS, story, tokens, type Beat, type FoundationId } from "../engine/story.ts";
import { nearRound } from "../engine/util.ts";
import { findNumber, type Range } from "./cells.ts";

export type Pic =
  | { kind: "none" }
  /** Картинка раньше записи: от n до круглого R всего |R − n|. */
  | { kind: "near"; n: number; R: number }
  /** Прыжки по прямой: пройдено done, сейчас cur (−1 — нет). */
  | { kind: "jumps"; from: number; jumps: number[]; done: number; cur: number }
  | { kind: "blocks"; numbers: number[]; focus?: number[] };

export type Frame = { say: string; board: string; lit: Range[]; pic: Pic };

const MINUS = "−";

/** Строка токенов без пробелов и диапазоны каждого токена. */
function joined(ts: string[]) {
  const ranges: Range[] = [];
  let s = "";
  for (const t of ts) {
    ranges.push([s.length, s.length + t.length]);
    s += t;
  }
  return { s, ranges };
}

// ─── «Кучка»: знаковые слагаемые ───

type Term = { v: number; mark?: boolean };

function fmt(terms: Term[]) {
  let s = "";
  const ranges: Range[] = [];
  terms.forEach((t, i) => {
    if (t.v < 0) s += MINUS;
    else if (i > 0) s += "+";
    ranges.push([s.length, s.length + String(Math.abs(t.v)).length]);
    s += Math.abs(t.v);
  });
  return { s, ranges };
}

function startTerms(lines: Line[], plan: Plan): Term[] {
  return lines.flatMap((l, i) => {
    const sp = plan.split?.find((x) => x.line === i);
    return sp ? sp.parts.map((p) => ({ v: l.sign * p, mark: true })) : [{ v: l.sign * l.n }];
  });
}

/** Одно действие над кучкой; null — если кучка не сходится с действием (тогда показываем само действие). */
function applyOp(terms: Term[], o: Plan["ops"][number]): { terms: Term[]; at: number } | null {
  const sa = o.neg ? -o.a : o.a;
  const sb = o.neg ? -o.b : o.op === "+" ? o.b : -o.b;
  const ia = terms.findIndex((t) => t.v === sa);
  const ib = terms.findIndex((t, k) => k !== ia && t.v === sb);
  if (ia < 0 || ib < 0) return null;
  const r = o.neg ? -o.r : o.r;
  const next = terms.flatMap((t, k) => (k === ia ? [{ v: r }] : k === ib ? [] : [t]));
  return { terms: next, at: next.findIndex((t) => t.v === r) };
}

const contiguous = (plan: Plan) => plan.ops.every((o, k) => !o.neg && (k === 0 || o.a === plan.ops[k - 1].r));

function jumpsPic(plan: Plan, done: number, cur: number): Pic {
  return { kind: "jumps", from: plan.ops[0].a, jumps: plan.ops.map((o) => (o.op === "+" ? o.b : -o.b)), done, cur };
}

function introPic(id: TechniqueId, lines: Line[], plan: Plan): Pic {
  if (id === "nearUp" || id === "nearDown") {
    const i = plan.split?.[0]?.line ?? 1;
    const nr = nearRound(lines[i].n);
    if (nr) return { kind: "near", n: lines[i].n, R: nr.R };
  }
  if (id === "bridge") return { kind: "near", n: plan.ops[0].a, R: plan.ops[0].r };
  if (id === "place" || id === "doubles" || id === "column") return { kind: "blocks", numbers: lines.map((l) => l.n) };
  return contiguous(plan) ? jumpsPic(plan, 0, -1) : { kind: "none" };
}

export function frames(id: TechniqueId, lines: Line[], plan: Plan): Frame[] {
  const beats = story(id, lines, plan);
  const expr = joined(tokens(lines));
  const done = joined([...tokens(lines), "=", String(plan.answer)]);
  const doneFrame = (say: string): Frame => ({
    say,
    board: done.s,
    lit: [done.ranges.at(-1)!],
    pic: contiguous(plan) ? jumpsPic(plan, plan.ops.length, -1) : { kind: "none" },
  });
  const intro = introPic(id, lines, plan);
  const out: Frame[] = [];
  let k = 0;
  const next = () => beats[k++];

  // зацепка и «смотрим»: запись примера, обведено то, на что смотреть
  const hook = next();
  const look = next();
  const focus = (look.focus ?? []).map((t) => expr.ranges[t]).filter(Boolean);
  out.push({ say: hook.say, board: expr.s, lit: focus, pic: intro }, { say: look.say, board: expr.s, lit: focus, pic: intro });

  let terms = startTerms(lines, plan);
  if (plan.rewrite) {
    const b = next();
    const f = fmt(terms);
    const marked = terms.flatMap((t, i) => (t.mark ? [f.ranges[i]] : []));
    out.push({ say: b.say, board: f.s, lit: groupRuns(marked, f.s), pic: contiguous(plan) ? jumpsPic(plan, 0, -1) : intro });
  }
  if (id === "column" || id === "doubles" || id === "place") {
    const b = next();
    out.push({ say: b.say, board: expr.s, lit: [], pic: { kind: "blocks", numbers: lines.map((l) => l.n) } });
  }

  if (plan.mode === "up") {
    plan.ops.forEach((o, i) => {
      const b = next();
      const s = `${o.a}+${o.b}=${o.r}`;
      out.push({ say: b.say, board: s, lit: [findNumber(s, o.b, String(o.a).length)!], pic: jumpsPic(plan, i, i) });
    });
    out.push(doneFrame(next().say));
    return out;
  }

  if (id === "column") {
    const tens = lines.map((l) => Math.floor(l.n / 10));
    const units = lines.map((l) => l.n % 10);
    const T = tens.reduce((s, x) => s + x, 0);
    const U = units.reduce((s, x) => s + x, 0);
    const sum = (xs: number[], r: number) => {
      const s = `${xs.join("+")}=${r}`;
      return { s, lit: [[s.length - String(r).length, s.length] as Range] };
    };
    const t1 = sum(tens, T);
    const t2 = sum(units, U);
    const t3 = sum([T * 10, U], plan.answer);
    out.push(
      { say: next().say, board: t1.s, lit: t1.lit, pic: { kind: "blocks", numbers: tens.map((x) => x * 10) } },
      { say: next().say, board: t2.s, lit: t2.lit, pic: { kind: "blocks", numbers: units } },
      { say: next().say, board: t3.s, lit: t3.lit, pic: { kind: "jumps", from: T * 10, jumps: [U], done: 0, cur: 0 } },
    );
    out.push(doneFrame(next().say));
    return out;
  }

  plan.ops.forEach((o, i) => {
    const b: Beat = next();
    const step = applyOp(terms, o);
    let board: string;
    let lit: Range[];
    if (step) {
      terms = step.terms;
      const f = fmt(terms);
      board = f.s;
      lit = [f.ranges[step.at]];
    } else {
      board = `${o.a}${o.op}${o.b}=${o.r}`;
      lit = [[board.length - String(o.r).length, board.length]];
    }
    const pic: Pic = contiguous(plan)
      ? jumpsPic(plan, i, i)
      : b.show.kind === "line"
        ? { kind: "jumps", from: b.show.from, jumps: b.show.jumps, done: 0, cur: 0 }
        : { kind: "none" };
    out.push({ say: b.say, board, lit, pic });
  });
  out.push(doneFrame(next().say));
  return out;
}

/** Соседние диапазоны, между которыми только знак, — одна рамка: «100−2». */
function groupRuns(rs: Range[], s: string): Range[] {
  const out: Range[] = [];
  for (const r of rs) {
    const last = out.at(-1);
    if (last && r[0] - last[1] <= 1 && /^[+−]?$/.test(s.slice(last[1], r[0]))) last[1] = r[1];
    else out.push([...r] as Range);
  }
  return out;
}

// ─── Основы: те же кадры, без примера ───

export function foundationFrames(fid: FoundationId): Frame[] {
  return FOUNDATIONS[fid].beats.map((b) => {
    const sh = b.show;
    if (sh.kind === "blocks") {
      const s = sh.numbers.join("+");
      return { say: b.say, board: s, lit: [], pic: { kind: "blocks", numbers: sh.numbers, focus: b.focus } };
    }
    if (sh.kind === "line") {
      if (!sh.jumps.length) return { say: b.say, board: String(sh.from), lit: [], pic: { kind: "jumps", from: sh.from, jumps: [], done: 0, cur: -1 } };
      const end = sh.from + sh.jumps.reduce((s, x) => s + x, 0);
      const s = `${sh.from}${sh.jumps.map((j) => (j > 0 ? `+${j}` : `${MINUS}${-j}`)).join("")}=${end}`;
      return {
        say: b.say,
        board: s,
        lit: [[s.length - String(end).length, s.length]],
        pic: { kind: "jumps", from: sh.from, jumps: sh.jumps, done: sh.jumps.length - 1, cur: sh.jumps.length - 1 },
      };
    }
    const j = joined(sh.tokens);
    // длинный перечень («1+9 2+8 …») на табло не помещается — там остаётся только «10»
    if (j.s.length > 12) return { say: b.say, board: "10", lit: [], pic: { kind: "none" } };
    return { say: b.say, board: j.s, lit: (b.focus ?? []).map((t) => j.ranges[t]).filter(Boolean), pic: { kind: "none" } };
  });
}

/** Сколько флажков нужно, чтобы все кадры встали без сдвигов. */
export const boardWidth = (fs: Frame[]) => Math.max(...fs.map((f) => [...f.board].length));
