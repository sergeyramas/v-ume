import type { Line, Plan } from "./types.ts";
import { total } from "./util.ts";

const isNat = (n: number) => Number.isInteger(n) && n >= 0;

/**
 * Проверяет, что решение честное. Пустой массив — всё в порядке.
 * - каждое действие посчитано верно, числа целые и не отрицательные (нет «ухода в минус»);
 * - «pool»: части строк в сумме дают строку, каждая часть и каждый промежуточный
 *   результат использован ровно один раз и со своим знаком, в конце остаётся ответ;
 * - «up»: прыжки идут от вычитаемого к уменьшаемому, ответ — сумма прыжков;
 * - ответ равен сумме строк.
 */
export function checkPlan(lines: Line[], plan: Plan): string[] {
  const errs: string[] = [];
  const want = total(lines);
  if (plan.answer !== want) errs.push(`ответ ${plan.answer}, а сумма строк ${want}`);

  plan.ops.forEach((o, i) => {
    if (![o.a, o.b, o.r].every(isNat)) errs.push(`шаг ${i + 1}: не целое или отрицательное`);
    const r = o.op === "+" ? o.a + o.b : o.a - o.b;
    if (r !== o.r) errs.push(`шаг ${i + 1}: ${o.a} ${o.op} ${o.b} ≠ ${o.r}`);
    if (o.neg && o.op !== "+") errs.push(`шаг ${i + 1}: в группе минусов только сложение`);
  });
  if (errs.length) return errs;

  if (plan.mode === "up") {
    if (lines.length !== 2 || lines[0].sign !== 1 || lines[1].sign !== -1)
      return ["«up» только для a − b"];
    const [a, b] = [lines[0].n, lines[1].n];
    let at = b;
    for (const [i, o] of plan.ops.entries()) {
      if (o.op !== "+" || o.a !== at) errs.push(`прыжок ${i + 1} начинается не с ${at}`);
      at = o.r;
    }
    if (at !== a) errs.push(`прыжки закончились на ${at}, а не на ${a}`);
    const jumps = plan.ops.reduce((s, o) => s + o.b, 0);
    if (jumps !== plan.answer) errs.push(`сумма прыжков ${jumps} ≠ ответ ${plan.answer}`);
    return errs;
  }

  // pool: мультимножество знаковых чисел
  const pool: number[] = [];
  const splitByLine = new Map<number, number[]>();
  for (const s of plan.split ?? []) {
    if (splitByLine.has(s.line)) errs.push(`строка ${s.line + 1} разбита дважды`);
    splitByLine.set(s.line, s.parts);
  }
  lines.forEach((l, i) => {
    const parts = splitByLine.get(i) ?? [l.n];
    const sum = parts.reduce((s, p) => s + p, 0);
    if (sum !== l.n) errs.push(`части строки ${i + 1} дают ${sum}, а не ${l.n}`);
    if (parts.some((p) => p === 0 || !Number.isInteger(p))) errs.push(`строка ${i + 1}: пустая часть`);
    for (const p of parts) pool.push(l.sign * p);
  });
  for (const i of splitByLine.keys())
    if (i < 0 || i >= lines.length) errs.push(`разбита несуществующая строка ${i + 1}`);
  if (errs.length) return errs;

  const take = (v: number, step: number) => {
    const k = pool.indexOf(v);
    if (k < 0) {
      errs.push(`шаг ${step}: числа ${v} нет среди частей и прошлых результатов`);
      return false;
    }
    pool.splice(k, 1);
    return true;
  };

  plan.ops.forEach((o, i) => {
    const step = i + 1;
    if (o.neg) {
      if (take(-o.a, step) && take(-o.b, step)) pool.push(-o.r);
    } else if (take(o.a, step) && take(o.op === "+" ? o.b : -o.b, step)) {
      pool.push(o.r);
    }
  });
  if (errs.length) return errs;
  if (pool.length !== 1 || pool[0] !== plan.answer)
    errs.push(`в конце осталось [${pool.join(", ")}], а должен остаться только ответ`);
  return errs;
}
