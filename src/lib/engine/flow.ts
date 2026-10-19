// «Поток»: числа показываются по одному, ребёнок держит сумму в голове.
// Лестница меняет один параметр за раз: количество чисел, разрядность, время показа, минусы.

import type { Rng } from "./types.ts";
import { int } from "./util.ts";

export type Branch = "tens" | "hundreds";
export type FlowStep = { count: number; digits: 1 | 2 | 3; showMs: number; minus: 0 | 2 | "any" };
export type Age = "9-11" | "12-15";

export const LADDER: Record<Branch, FlowStep[]> = {
  tens: [
    { count: 3, digits: 1, showMs: 3000, minus: 0 },
    { count: 3, digits: 2, showMs: 3000, minus: 0 },
    { count: 4, digits: 2, showMs: 3000, minus: 0 },
    { count: 5, digits: 2, showMs: 3000, minus: 0 },
    { count: 6, digits: 2, showMs: 3000, minus: 0 },
    { count: 6, digits: 2, showMs: 2000, minus: 0 },
    { count: 8, digits: 2, showMs: 2000, minus: 0 },
    { count: 8, digits: 2, showMs: 2000, minus: 2 },
    { count: 10, digits: 2, showMs: 2000, minus: 2 },
    { count: 10, digits: 2, showMs: 2000, minus: "any" },
    { count: 10, digits: 2, showMs: 1500, minus: "any" },
  ],
  hundreds: [
    { count: 3, digits: 3, showMs: 3500, minus: 0 },
    { count: 4, digits: 3, showMs: 3500, minus: 0 },
    { count: 5, digits: 3, showMs: 3500, minus: 0 },
    { count: 6, digits: 3, showMs: 3500, minus: 0 },
    { count: 8, digits: 3, showMs: 3500, minus: 0 },
  ],
};

/** Ветка «Сотни» открывается, когда в «Десятках» пройдена ступень 7. */
export const HUNDREDS_UNLOCK = 7;

/** Добавка ко времени показа в режиме «помедленнее». */
export const SLOWER_MS = 500;

export const showMs = (s: FlowStep, slower: boolean) => s.showMs + (slower ? SLOWER_MS : 0);

/** Класс задачи для рекордов: «8×2зн@2000−». Рекорд сравниваем только внутри класса. */
export const classOf = (s: FlowStep) => `${s.count}×${s.digits}зн@${s.showMs}${s.minus ? "−" : ""}`;

/**
 * Числа для задачи. Первое — с плюсом, текущая сумма никогда не уходит в минус.
 * Доля переходов через десяток растёт с номером ступени.
 */
export function flowNumbers(branch: Branch, step: number, rng: Rng): number[] {
  const s = LADDER[branch][step - 1];
  const lo = s.digits === 1 ? 2 : s.digits === 2 ? 11 : 101;
  const hi = s.digits === 1 ? 9 : s.digits === 2 ? 99 : 999;
  const carryShare = Math.min(0.85, 0.35 + step * 0.05);
  const maxMinus = s.minus === "any" ? Math.floor(s.count / 3) : s.minus;
  const minusAt = new Set<number>();
  while (minusAt.size < maxMinus) minusAt.add(int(rng, 2, s.count - 1));

  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < s.count; i++) {
    // минус только если есть что отнимать двузначным (трёхзначным) числом
    const neg = minusAt.has(i) && sum >= lo;
    const top = neg ? Math.min(hi, sum) : hi;
    let n = int(rng, lo, top);
    for (let tries = 0; tries < 50; tries++) {
      const carry = neg ? n % 10 > sum % 10 : (sum % 10) + (n % 10) >= 10;
      if (i === 0 || s.digits === 1 || carry === rng() < carryShare) break;
      n = int(rng, lo, top);
    }
    out.push(neg ? -n : n);
    sum += neg ? -n : n;
  }
  return out;
}

/** Промежуточные суммы: [12, 47, 31, …] — для разбора «где сбился». */
export const runningSums = (ns: number[]) => ns.reduce<number[]>((acc, n) => [...acc, (acc.at(-1) ?? 0) + n], []);

/** После какого числа (индекс) спросить «сколько сейчас?». Только для 5+ чисел. */
export const checkpointAt = (count: number) => (count >= 5 ? Math.floor(count / 2) - 1 : null);

/** Каждая 3-я задача сессии с контрольной точкой. */
export const hasCheckpoint = (taskNo: number, count: number) => taskNo % 3 === 0 && checkpointAt(count) !== null;

/** Где ребёнок сбился: первая промежуточная сумма, на которой ответ контрольной точки разошёлся. */
export function firstSlip(ns: number[], at: number, said: number) {
  const sums = runningSums(ns);
  return said === sums[at] ? null : { index: at, expected: sums[at], said, diff: said - sums[at] };
}

export type Session = {
  branch: Branch;
  step: number; // 1-based
  startStep: number;
  upStreak: number;
  tasks: number; // сколько задач уже решено в сессии
};

export const startSession = (branch: Branch, step: number): Session => ({
  branch,
  step,
  startStep: step,
  upStreak: 0,
  tasks: 0,
});

/**
 * Правило лестницы:
 * - верных подряд 2 (для 9–11 лет — 3) — ступень вверх;
 * - ошибка — вниз на 1, но первые 3 задачи сессии не понижают;
 * - за сессию не выше стартовой + 2; не ниже 1 и не выше последней.
 */
export function nextStep(s: Session, ok: boolean, age: Age): Session {
  const need = age === "9-11" ? 3 : 2;
  const top = LADDER[s.branch].length;
  const tasks = s.tasks + 1;
  if (ok) {
    const streak = s.upStreak + 1;
    if (streak >= need && s.step < Math.min(top, s.startStep + 2)) return { ...s, step: s.step + 1, upStreak: 0, tasks };
    return { ...s, upStreak: streak, tasks };
  }
  const step = tasks <= 3 ? s.step : Math.max(1, s.step - 1);
  return { ...s, step, upStreak: 0, tasks };
}

/** Рекорд по классу: лучшая (самая высокая) верно решённая ступень этого класса. */
export function recordBest(best: Record<string, number>, branch: Branch, step: number, ok: boolean) {
  if (!ok) return best;
  const key = `${branch}:${classOf(LADDER[branch][step - 1])}`;
  return (best[key] ?? 0) >= step ? best : { ...best, [key]: step };
}
