// Простые объяснения — так, чтобы суть понял и тот, кто ещё не дошёл до этой темы в школе.
// Подача как у хороших роликов «от руки»:
//  - сначала картинка и смысл, потом запись;
//  - один кадр — одна мысль, не больше 20 слов;
//  - на экране рождается ровно то, о чём сейчас говорим; красным — только это;
//  - короткая жизненная рамка «зачем» перед правилом;
//  - в конце итог с галочкой.
// Кадры собираются из настоящего решения (Plan), поэтому работают на любом примере.

import type { Line, Plan, Rng, TechniqueId } from "./types.ts";
import { int, nonRound } from "./util.ts";

/** Что нарисовано в кадре. */
export type Scene =
  /** Запись примера токенами: ["98", "+", "47"]. */
  | { kind: "expr"; tokens: string[] }
  /** Числовая прямая: старт и прыжки (+ вправо, − влево). */
  | { kind: "line"; from: number; jumps: number[] }
  /** Кубики: десятки — палочки по 10, единицы — отдельные кубики. */
  | { kind: "blocks"; numbers: number[] }
  /** Итог с галочкой. */
  | { kind: "done"; tokens: string[] };

export type Beat = {
  say: string;
  show: Scene;
  /** Индексы токенов (expr/done) или чисел (blocks), которые подсвечены красным. */
  focus?: number[];
};

export const MAX_WORDS = 20;

// ─── Ступень 0: основы, без которых приёмы непонятны ──────────────────────

export type FoundationId = "ten" | "friends10" | "line";

export const FOUNDATIONS: Record<FoundationId, { title: string; beats: Beat[] }> = {
  ten: {
    title: "Что такое десяток",
    beats: [
      { say: "Десять кубиков складываем в одну палочку. Это десяток.", show: { kind: "blocks", numbers: [10] } },
      { say: "47 — это 4 палочки и 7 кубиков.", show: { kind: "blocks", numbers: [47] } },
      { say: "Палочки — десятки, кубики — единицы. Считать палочками быстрее.", show: { kind: "blocks", numbers: [47] }, focus: [0] },
      { say: "Десять палочек — это сотня, большой квадрат.", show: { kind: "blocks", numbers: [100] } },
    ],
  },
  friends10: {
    title: "Друзья десятка",
    beats: [
      { say: "Семь кубиков. Сколько не хватает до палочки?", show: { kind: "blocks", numbers: [7] } },
      { say: "Трёх. 7 и 3 — друзья: вместе десяток.", show: { kind: "expr", tokens: ["7", "+", "3", "=", "10"] }, focus: [2] },
      { say: "Друзья: 1 и 9, 2 и 8, 3 и 7, 4 и 6, 5 и 5.", show: { kind: "expr", tokens: ["1+9", "2+8", "3+7", "4+6", "5+5"] } },
      { say: "Тот же фокус с большими: 37 + 3 = 40.", show: { kind: "line", from: 37, jumps: [3] } },
    ],
  },
  line: {
    title: "Числовая прямая",
    beats: [
      { say: "Все числа стоят на дорожке по порядку.", show: { kind: "line", from: 40, jumps: [] } },
      { say: "Прибавить — шагнуть вправо.", show: { kind: "line", from: 40, jumps: [10] } },
      { say: "Отнять — шагнуть влево.", show: { kind: "line", from: 50, jumps: [-20] } },
      { say: "Большой шаг до круглого числа сделать легче всего.", show: { kind: "line", from: 47, jumps: [3, 20] } },
    ],
  },
};

/** Какие основы нужны приёму. Пока основа не пройдена — показываем её перед приёмом. */
export const NEEDS: Record<TechniqueId, FoundationId[]> = {
  pairs: ["friends10"],
  bridge: ["friends10", "line"],
  place: ["ten"],
  nearUp: ["ten", "line"],
  doubles: ["ten"],
  nearDown: ["line"],
  change: ["line", "friends10"],
  column: ["ten"],
  signs: ["line"],
};

/** Задание на основу: одно число в ответ. */
export function foundationTask(id: FoundationId, rng: Rng): { prompt: string; expect: number } {
  if (id === "ten") {
    const n = nonRound(rng, 11, 99);
    return { prompt: `${n} = ☐ десятков и ${n % 10} единиц`, expect: Math.floor(n / 10) };
  }
  if (id === "friends10") {
    const u = int(rng, 1, 9);
    const big = rng() < 0.5;
    const t = big ? int(rng, 1, 8) * 10 : 0;
    return { prompt: `${t + u} + ☐ = ${t + 10}`, expect: 10 - u };
  }
  const from = int(rng, 2, 8) * 10;
  const by = int(rng, 1, 3) * 10;
  return rng() < 0.5
    ? { prompt: `От ${from} шаг вправо на ${by}: ☐`, expect: from + by }
    : { prompt: `От ${from} шаг влево на ${Math.min(by, from - 10)}: ☐`, expect: from - Math.min(by, from - 10) };
}

// ─── Жизненная рамка «зачем» ───────────────────────────────────────────────

export const HOOK: Record<TechniqueId, string> = {
  pairs: "Монеты по 37 и 63 рубля — вместе ровно сотня. Круглое считать легко.",
  bridge: "Не хватает трёх до полного десятка — сначала доложи их, потом остальное.",
  place: "Сначала крупные купюры, потом мелочь — так деньги и считают.",
  nearUp: "Цена 98 рублей — это почти 100. Отдал сотню, вернули 2.",
  doubles: "Две одинаковые кучки посчитать легко. А если одна чуть больше?",
  nearDown: "Отдать 98 — это отдать сотню и получить 2 сдачи.",
  change: "Кассир не вычитает, а добавляет: «47… 50… 83 — ваша сдача 36».",
  column: "Длинный чек проще считать, когда сначала крупное, потом мелочь.",
  signs: "Сначала все приходы, потом все расходы, в конце одно вычитание.",
};

// ─── Кадры приёма по конкретному примеру ───────────────────────────────────

export const tokens = (lines: Line[]) =>
  lines.flatMap((l, i) => (i === 0 ? [`${l.n}`] : [l.sign === 1 ? "+" : "−", `${l.n}`]));

/** Индекс токена числа из строки i. */
const tok = (i: number) => (i === 0 ? 0 : i * 2);

function focusLines(id: TechniqueId, lines: Line[], plan: Plan): number[] {
  switch (id) {
    case "pairs": {
      const [a, b] = [plan.ops[0].a, plan.ops[0].b];
      const i = lines.findIndex((l) => l.n === a);
      const j = lines.findIndex((l, k) => k !== i && l.n === b);
      return [i, j];
    }
    case "bridge":
      return [0];
    case "nearUp":
    case "place":
    case "doubles":
      return (plan.split ?? []).map((s) => s.line);
    case "nearDown":
      return [1];
    case "signs":
      return lines.flatMap((l, i) => (l.sign === -1 ? [i] : []));
    default:
      return lines.map((_, i) => i);
  }
}

const LOOK: Record<TechniqueId, string> = {
  pairs: "Ищем пару, которая вместе даёт круглое.",
  bridge: "Первое число чуть не дотягивает до круглого.",
  place: "Второе число разберём на части.",
  nearUp: "Это число почти круглое.",
  doubles: "Числа почти одинаковые — почти двойняшки.",
  nearDown: "Отнимаем почти круглое число.",
  change: "Не будем вычитать. Пойдём от меньшего вверх, как кассир.",
  column: "Много чисел. Сначала только палочки-десятки.",
  signs: "Соберём все минусы вместе.",
};

export function story(id: TechniqueId, lines: Line[], plan: Plan): Beat[] {
  const t = tokens(lines);
  const beats: Beat[] = [
    { say: HOOK[id], show: { kind: "expr", tokens: t } },
    { say: LOOK[id], show: { kind: "expr", tokens: t }, focus: focusLines(id, lines, plan).map(tok) },
  ];

  if (plan.rewrite) beats.push({ say: `Превращаем: ${plan.rewrite}.`, show: { kind: "expr", tokens: plan.rewrite.split(" ") } });
  if (id === "column" || id === "doubles" || id === "place")
    beats.push({ say: "Посмотрим на кубики.", show: { kind: "blocks", numbers: lines.map((l) => l.n) } });

  if (plan.mode === "up") {
    plan.ops.forEach((o, k) =>
      beats.push({
        say: `${k === 0 ? "Шаг до круглого" : "Дальше до цели"}: ${o.a} + ${o.b} = ${o.r}.`,
        show: { kind: "line", from: plan.ops[0].a, jumps: plan.ops.slice(0, k + 1).map((x) => x.b) },
        focus: [k],
      }),
    );
    const js = plan.ops.map((o) => o.b);
    beats.push({
      say: `Ответ — сколько прошли: ${js.join(" + ")} = ${plan.answer}.`,
      show: { kind: "done", tokens: [...t, "=", `${plan.answer}`, "✓"] },
    });
    return beats;
  }

  if (id === "column") {
    const tens = lines.map((l) => Math.floor(l.n / 10));
    const units = lines.map((l) => l.n % 10);
    const T = tens.reduce((s, x) => s + x, 0);
    const U = units.reduce((s, x) => s + x, 0);
    beats.push(
      { say: `Палочки: ${tens.join("+")} = ${T}. Это ${T * 10}.`, show: { kind: "blocks", numbers: tens.map((x) => x * 10) } },
      { say: `Кубики: ${units.join("+")} = ${U}.`, show: { kind: "blocks", numbers: units } },
      { say: `Соединяем: ${T * 10} + ${U} = ${plan.answer}.`, show: { kind: "line", from: T * 10, jumps: [U] } },
      { say: `Готово: ${plan.answer}.`, show: { kind: "done", tokens: [...t, "=", `${plan.answer}`, "✓"] } },
    );
    return beats;
  }

  for (const o of plan.ops) {
    const expr = o.neg ? `${o.a} + ${o.b} = ${o.r} — столько отнимем` : `${o.a} ${o.op} ${o.b} = ${o.r}`;
    beats.push({
      say: o.why ? `${cap(o.why)}: ${expr}.` : `${expr}.`,
      show: o.neg ? { kind: "expr", tokens: [`${o.a}`, "+", `${o.b}`, "=", `${o.r}`] } : { kind: "line", from: o.a, jumps: [o.op === "+" ? o.b : -o.b] },
    });
  }
  beats.push({ say: `Готово: ${plan.answer}.`, show: { kind: "done", tokens: [...t, "=", `${plan.answer}`, "✓"] } });
  return beats;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length;
