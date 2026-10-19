import type { Line, Op, Rng, Sign } from "./types.ts";

/** Детерминированный генератор (mulberry32) — для тестов и повторяемых примеров. */
export function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Целое в [lo, hi] включительно. */
export const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

export function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Двузначное (или трёхзначное) с ненулевыми единицами. */
export function nonRound(rng: Rng, lo: number, hi: number): number {
  for (;;) {
    const n = int(rng, lo, hi);
    if (n % 10 !== 0) return n;
  }
}

export const plus = (...ns: number[]): Line[] => ns.map((n) => ({ n, sign: 1 as Sign }));
export const L = (n: number, sign: Sign = 1): Line => ({ n, sign });

export const total = (lines: Line[]) => lines.reduce((s, l) => s + l.sign * l.n, 0);

export const allPlus = (lines: Line[]) => lines.every((l) => l.sign === 1);

export const roundUp = (n: number, u: number) => Math.ceil(n / u) * u;

/** Ненулевые разряды: 456 → [400, 50, 6], 305 → [300, 5]. */
export function places(n: number): number[] {
  const out: number[] = [];
  for (let u = 1000; u >= 1; u /= 10) {
    const d = Math.floor((n % (u * 10)) / u) * u;
    if (d) out.push(d);
  }
  return out;
}

/** Сколько ненулевых разрядов. */
export const digitsUsed = (n: number) => places(n).length;

export const add = (a: number, b: number, why?: string): Op => ({ a, op: "+", b, r: a + b, why });
export const sub = (a: number, b: number, why?: string): Op => ({ a, op: "−", b, r: a - b, why });

/** Сложить список по очереди: [a, b, c] → a+b, (a+b)+c. */
export function chain(ns: number[]): Op[] {
  const ops: Op[] = [];
  let acc = ns[0];
  for (const n of ns.slice(1)) {
    ops.push(add(acc, n));
    acc += n;
  }
  return ops;
}

/**
 * «Почти круглое»: 98 → {R:100, d:−2}, 102 → {R:100, d:2}, 49 → {R:50, d:−1}.
 * Для двузначных — расстояние 1–2 до десятка, для трёхзначных — 1–3 до сотни.
 * d < 0: число ниже круглого (округляем вверх и потом возвращаем).
 */
export function nearRound(n: number): { R: number; d: number } | null {
  const U = n >= 100 ? 100 : 10;
  const max = U === 100 ? 3 : 2;
  const R = Math.round(n / U) * U;
  const d = n - R;
  if (R <= 0 || d === 0 || Math.abs(d) > max) return null;
  return { R, d };
}

export const fmtLines = (lines: Line[]) =>
  lines.map((l, i) => (i === 0 ? `${l.n}` : `${l.sign === 1 ? "+" : "−"} ${l.n}`)).join(" ");
