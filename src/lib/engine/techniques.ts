import type { Blank, Line, Op, Technique } from "./types.ts";
import {
  L,
  add,
  allPlus,
  chain,
  digitsUsed,
  int,
  nearRound,
  nonRound,
  places,
  plus,
  roundUp,
  shuffle,
  sub,
  total,
} from "./util.ts";

const two = (lines: Line[]) => lines.length === 2;
const minusSign = (d: number) => (d < 0 ? "−" : "+");

// ─── 1. Друзья числа и пары ────────────────────────────────────────────────

/** Пары с круглой суммой: сначала до 100/1000, потом до десятка. Каждая строка — не больше чем в одной паре. */
function friendPairs(lines: Line[]): Array<[number, number]> {
  const used = new Set<number>();
  const out: Array<[number, number]> = [];
  for (const mod of [1000, 100, 10]) {
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        if (used.has(i) || used.has(j)) continue;
        const [a, b] = [lines[i].n, lines[j].n];
        if (a % 10 === 0 || b % 10 === 0) continue;
        if ((a + b) % mod !== 0) continue;
        if (mod === 10 && (a + b) % 100 === 0) continue; // уже взяли бы на mod 100
        used.add(i);
        used.add(j);
        out.push([i, j]);
      }
    }
  }
  return out;
}

const pairs: Technique = {
  id: "pairs",
  title: "Друзья числа и пары",
  level: 1,
  sign: "В списке есть два числа, которые вместе дают круглое: 37 и 63, 28 и 42.",
  idea: "Сначала сложи «друзей» — получится круглое, к нему добавлять легко.",
  mistake: "Сложить пару, а одно из оставшихся чисел забыть. Отмечай, что уже сложил.",
  why: {
    q: "Почему сначала складываем 37 и 63, а не по порядку?",
    options: [
      "Они дают 100, а к круглому прибавлять проще",
      "Так требует порядок действий",
      "Потому что они самые большие",
    ],
    correct: 0,
  },
  fits: (lines) => lines.length >= 3 && allPlus(lines) && friendPairs(lines).length > 0,
  solve(lines) {
    if (!pairs.fits(lines)) return null;
    const ps = friendPairs(lines);
    const inPair = new Set(ps.flat());
    const ops: Op[] = ps.map(([i, j]) => add(lines[i].n, lines[j].n, "друзья — круглое"));
    const rest = [
      ...ps.map(([i, j]) => lines[i].n + lines[j].n),
      ...lines.filter((_, k) => !inPair.has(k)).map((l) => l.n),
    ];
    ops.push(...chain(rest));
    return { ops, answer: total(lines) };
  },
  blanks(lines) {
    return friendPairs(lines).map(([i, j]) => ({
      prompt: `${lines[i].n} + ☐ = ${lines[i].n + lines[j].n}`,
      expect: lines[j].n,
    }));
  },
  draft(tier, rng) {
    let a: number, b: number;
    if (tier === 1) {
      a = nonRound(rng, 11, 79);
      b = int(rng, 1, 7) * 10 + (10 - (a % 10));
    } else if (tier === 2) {
      a = nonRound(rng, 11, 89);
      b = 100 - a;
    } else {
      a = nonRound(rng, 101, 899);
      b = 1000 - a;
    }
    const lo = tier === 3 ? 101 : 11;
    const hi = tier === 3 ? 899 : 89;
    const others = Array.from({ length: tier === 1 ? 1 : int(rng, 1, 2) }, () => nonRound(rng, lo, hi));
    return plus(...shuffle(rng, [a, b, ...others]));
  },
  examples: [plus(37, 48, 63), plus(26, 51, 34, 19)],
};

// ─── 2. Мост через круглое ─────────────────────────────────────────────────

/** Куда «мостим»: до сотни, если она близко и второе число её перекрывает, иначе до десятка. */
function bridgeTarget(a: number, b: number): number | null {
  if (a % 10 === 0) return null;
  const to100 = roundUp(a, 100) - a;
  if (b >= 10 && to100 <= 40 && to100 < b) return roundUp(a, 100);
  const to10 = roundUp(a, 10) - a;
  return to10 < b ? roundUp(a, 10) : null;
}

const bridge: Technique = {
  id: "bridge",
  title: "Мост через круглое",
  level: 1,
  sign: "Первое число чуть не дотягивает до круглого, а второе больше этой нехватки: 47 + 8, 87 + 45.",
  idea: "Добери первое число до круглого, а остаток прибавь потом: 47 + 8 = 47 + 3 + 5.",
  mistake: "Добрать до круглого и забыть, сколько осталось прибавить. Остаток = второе число минус добор.",
  why: {
    q: "Зачем разбивать 8 на 3 и 5?",
    options: [
      "3 доводит 47 до 50, а к 50 прибавить 5 легко",
      "Потому что 3 + 5 = 8 — так красивее",
      "Так меньше цифр",
    ],
    correct: 0,
  },
  fits: (lines) => two(lines) && allPlus(lines) && bridgeTarget(lines[0].n, lines[1].n) !== null,
  solve(lines) {
    if (!bridge.fits(lines)) return null;
    const [a, b] = [lines[0].n, lines[1].n];
    const R = bridgeTarget(a, b)!;
    const need = R - a;
    return {
      split: [{ line: 1, parts: [need, b - need] }],
      rewrite: `${b} → ${need} + ${b - need}`,
      ops: [add(a, need, `добрали до ${R}`), add(R, b - need, "прибавили остаток")],
      answer: a + b,
    };
  },
  blanks(lines, plan) {
    const [a, b] = [lines[0].n, lines[1].n];
    const need = plan.ops[0].b;
    return [
      { prompt: `${a} + ☐ = ${a + need}`, expect: need },
      { prompt: `${b} − ${need} = ☐`, expect: b - need },
    ];
  },
  draft(tier, rng) {
    if (tier === 1) {
      const a = int(rng, 1, 8) * 10 + int(rng, 5, 9);
      return plus(a, int(rng, 10 - (a % 10) + 1, 9));
    }
    if (tier === 2) {
      const a = nonRound(rng, 61, 97);
      return plus(a, int(rng, 100 - a + 1, 99));
    }
    const a = int(rng, 1, 8) * 100 + nonRound(rng, 61, 97);
    return plus(a, int(rng, roundUp(a, 100) - a + 1, 99));
  },
  examples: [plus(47, 8), plus(87, 45)],
};

// ─── 3. По частям (разрядами, для трёхзначных — слева направо) ─────────────

const place: Technique = {
  id: "place",
  title: "По частям: сотни, десятки, единицы",
  level: 1,
  sign: "Второе число некруглое: 47 + 38, 456 + 378.",
  idea: "Разбей второе число на разряды и прибавляй по одному: сначала десятки, потом единицы.",
  mistake: "Прибавить десятки и забыть единицы — или прибавить их дважды.",
  why: {
    q: "Почему 38 удобно прибавлять как 30, а потом 8?",
    options: [
      "Круглое прибавить в уме легко, а потом остаются только единицы",
      "Потому что 30 больше 8",
      "Так ответ получится круглым",
    ],
    correct: 0,
  },
  fits: (lines) => two(lines) && allPlus(lines) && digitsUsed(lines[1].n) >= 2,
  solve(lines) {
    if (!place.fits(lines)) return null;
    const [a, b] = [lines[0].n, lines[1].n];
    if (a >= 100 && b >= 100) {
      // слева направо: сотни с сотнями, десятки с десятками, единицы с единицами
      const pa = places(a);
      const pb = places(b);
      const ops: Op[] = [];
      const sums: number[] = [];
      for (const u of [1000, 100, 10, 1]) {
        const x = pa.find((p) => p >= u && p < u * 10);
        const y = pb.find((p) => p >= u && p < u * 10);
        if (x && y) {
          ops.push(add(x, y));
          sums.push(x + y);
        } else if (x || y) sums.push((x || y)!);
      }
      ops.push(...chain(sums));
      return {
        split: [
          { line: 0, parts: pa },
          { line: 1, parts: pb },
        ],
        rewrite: `${a} → ${pa.join(" + ")}; ${b} → ${pb.join(" + ")}`,
        ops,
        answer: a + b,
      };
    }
    const pb = places(b);
    return {
      split: [{ line: 1, parts: pb }],
      rewrite: `${b} → ${pb.join(" + ")}`,
      ops: chain([a, ...pb]),
      answer: a + b,
    };
  },
  blanks(lines, plan) {
    const o = plan.ops[0];
    return [{ prompt: `${o.a} + ${o.b} = ☐`, expect: o.r }];
  },
  draft(tier, rng) {
    if (tier === 1) return plus(nonRound(rng, 11, 59), nonRound(rng, 11, 39));
    if (tier === 2) return plus(nonRound(rng, 41, 89), nonRound(rng, 21, 89));
    return plus(nonRound(rng, 101, 599), nonRound(rng, 101, 399));
  },
  examples: [plus(47, 38), plus(456, 378)],
};

// ─── 4. Почти круглое (сложение) ───────────────────────────────────────────

/** Какое из двух слагаемых округлять: ближе к сотне важнее, потом меньшее расстояние. */
function nearIndex(lines: Line[]): number | null {
  const cands = [0, 1]
    .map((i) => ({ i, nr: nearRound(lines[i].n) }))
    .filter((c) => c.nr && lines[1 - c.i].n % 10 !== 0);
  if (!cands.length) return null;
  cands.sort((x, y) => y.nr!.R - x.nr!.R || Math.abs(x.nr!.d) - Math.abs(y.nr!.d));
  return cands[0].i;
}

const nearUp: Technique = {
  id: "nearUp",
  title: "Почти круглое: прибавляем",
  level: 1,
  sign: "Одно из чисел почти круглое: 98, 199, 49 (чуть меньше) или 102, 301 (чуть больше).",
  idea: "Прибавь круглое, а потом поправь: 98 = 100 − 2, значит + 100 и − 2.",
  mistake: "Прибавить 100 и забыть вернуть 2 — или вернуть не в ту сторону.",
  why: {
    q: "Почему после «+ 100» мы отнимаем 2?",
    options: [
      "Прибавили на 2 больше, чем нужно",
      "Так всегда делают с последней цифрой",
      "Чтобы ответ стал круглым",
    ],
    correct: 0,
  },
  fits: (lines) => two(lines) && allPlus(lines) && nearIndex(lines) !== null,
  solve(lines) {
    if (!nearUp.fits(lines)) return null;
    const k = nearIndex(lines)!;
    const n = lines[k].n;
    const other = lines[1 - k].n;
    const { R, d } = nearRound(n)!;
    const s = other + R;
    return {
      split: [{ line: k, parts: [R, d] }],
      rewrite: `${n} → ${R} ${minusSign(d)} ${Math.abs(d)}`,
      ops: [
        add(other, R, `прибавили круглое ${R}`),
        d < 0 ? sub(s, -d, `вернули лишние ${-d}`) : add(s, d, `добавили ещё ${d}`),
      ],
      answer: n + other,
    };
  },
  blanks(lines, plan) {
    const [o1, o2] = plan.ops;
    const k = nearIndex(lines)!;
    const n = lines[k].n;
    return [
      { prompt: `${n} + ${o1.a} = ${o1.b} + ${o1.a} ${o2.op} ☐`, expect: o2.b },
      { prompt: `${o1.a} + ${o1.b} = ☐`, expect: o1.r },
    ];
  },
  draft(tier, rng) {
    if (tier === 1) return shuffle(rng, plus(nonRound(rng, 11, 69), int(rng, 1, 8) * 10 + int(rng, 8, 9)));
    if (tier === 2) return shuffle(rng, plus(nonRound(rng, 11, 89), 100 + int(rng, -3, 3) || 97));
    const near = int(rng, 1, 6) * 100 + int(rng, -3, 3) || 298;
    return plus(nonRound(rng, 101, 699), near);
  },
  examples: [plus(98, 47), plus(256, 302)],
};

// ─── 5. Почти двойняшки ────────────────────────────────────────────────────

const doubles: Technique = {
  id: "doubles",
  title: "Почти двойняшки",
  level: 1,
  sign: "Два двузначных числа почти одинаковые: 38 + 39, 45 + 47.",
  idea: "Удвой меньшее и добавь разницу: 38 + 39 = 38 + 38 + 1.",
  mistake: "Удвоить большее и всё равно прибавить разницу. Удваиваем меньшее.",
  why: {
    q: "Почему 38 + 39 = 76 + 1?",
    options: [
      "39 — это 38 и ещё 1, а 38 + 38 = 76",
      "Потому что 39 больше на 1, значит отнимаем 1",
      "Удвоение всегда даёт ответ без поправки",
    ],
    correct: 0,
  },
  fits(lines) {
    if (!two(lines) || !allPlus(lines)) return false;
    const [a, b] = [lines[0].n, lines[1].n];
    const diff = Math.abs(a - b);
    return a >= 11 && a <= 99 && b >= 11 && b <= 99 && diff >= 1 && diff <= 2;
  },
  solve(lines) {
    if (!doubles.fits(lines)) return null;
    const [a, b] = [lines[0].n, lines[1].n];
    const m = Math.min(a, b);
    const big = a > b ? 0 : 1;
    const d = Math.abs(a - b);
    return {
      split: [{ line: big, parts: [m, d] }],
      rewrite: `${m + d} → ${m} + ${d}`,
      ops: [add(m, m, "удвоили меньшее"), add(2 * m, d, "добавили разницу")],
      answer: a + b,
    };
  },
  blanks(_lines, plan) {
    const [o1, o2] = plan.ops;
    return [{ prompt: `${o1.a} + ${o1.a} = ☐`, expect: o1.r }];
  },
  draft(tier, rng) {
    const m = tier === 1 ? int(rng, 11, 49) : int(rng, 50, 97);
    return shuffle(rng, plus(m, m + int(rng, 1, 2)));
  },
  examples: [plus(38, 39), plus(47, 45)],
};

// ─── 6. Почти круглое (вычитание) ──────────────────────────────────────────

const nearDown: Technique = {
  id: "nearDown",
  title: "Почти круглое: вычитаем",
  level: 2,
  sign: "Вычитаем почти круглое число: − 98, − 49, − 302.",
  idea: "Вычти круглое и поправь: − 98 = − 100 + 2. Отняли лишние 2 — значит 2 вернуть.",
  mistake: "После «− 100» отнять ещё 2 вместо того, чтобы прибавить. Отняли больше — возвращаем.",
  why: {
    q: "145 − 98: почему после «− 100» мы прибавляем 2?",
    options: [
      "Отняли на 2 больше, чем нужно, — возвращаем",
      "Потому что в 98 есть цифра 8",
      "В вычитании поправку всегда отнимают",
    ],
    correct: 0,
  },
  fits(lines) {
    if (!two(lines) || lines[0].sign !== 1 || lines[1].sign !== -1) return false;
    const [a, b] = [lines[0].n, lines[1].n];
    const nr = nearRound(b);
    if (!nr || a <= b) return false;
    return a >= nr.R; // промежуточное a − R не уходит в минус
  },
  solve(lines) {
    if (!nearDown.fits(lines)) return null;
    const [a, b] = [lines[0].n, lines[1].n];
    const { R, d } = nearRound(b)!;
    const s = a - R;
    return {
      split: [{ line: 1, parts: [R, d] }],
      rewrite: `− ${b} → − ${R} ${d < 0 ? "+" : "−"} ${Math.abs(d)}`,
      ops: [
        sub(a, R, `отняли круглое ${R}`),
        d < 0 ? add(s, -d, `вернули лишние ${-d}`) : sub(s, d, `отняли ещё ${d}`),
      ],
      answer: a - b,
    };
  },
  blanks(lines, plan) {
    const [a, b] = [lines[0].n, lines[1].n];
    const [o1, o2] = plan.ops;
    return [
      { prompt: `${a} − ${b} = ${a} − ${o1.b} ${o2.op} ☐`, expect: o2.b },
      { prompt: `${a} − ${o1.b} = ☐`, expect: o1.r },
    ];
  },
  draft(tier, rng) {
    let b: number;
    let a: number;
    if (tier === 1) {
      b = int(rng, 2, 7) * 10 + int(rng, 8, 9);
      a = int(rng, roundUp(b, 10), 99);
    } else if (tier === 2) {
      b = 100 + (int(rng, -3, 3) || 2);
      a = int(rng, b + 1, 300);
    } else {
      b = int(rng, 2, 6) * 100 + (int(rng, -3, 3) || -2);
      a = int(rng, roundUp(b, 100), 999);
    }
    return [L(a), L(b, -1)];
  },
  examples: [
    [L(145), L(98, -1)],
    [L(612), L(302, -1)],
  ],
};

// ─── 7. Как сдача ──────────────────────────────────────────────────────────

/** Ступенька, до которой прыгаем от вычитаемого: ближайшая сотня (для трёхзначных), иначе десяток. */
function changeStop(a: number, b: number): number {
  if (b >= 100 && roundUp(b, 100) < a) return roundUp(b, 100);
  return roundUp(b, 10);
}

const change: Technique = {
  id: "change",
  title: "Как сдача: считай вверх",
  level: 2,
  sign: "Числа близко друг к другу или уменьшаемое круглое: 83 − 47, 500 − 286.",
  idea: "Иди от меньшего к большему, как кассир со сдачей: 47 → 50 (+3) → 83 (+33), ответ 3 + 33.",
  mistake: "Дойти до большего числа и назвать его как ответ. Ответ — это сумма прыжков.",
  why: {
    q: "83 − 47: почему ответ 36, а не 83?",
    options: [
      "Ответ — сколько мы прошли: 3 + 33",
      "Потому что 47 + 36 = 83 — мы просто угадали",
      "Ответ — то число, до которого дошли",
    ],
    correct: 0,
  },
  fits(lines) {
    if (!two(lines) || lines[0].sign !== 1 || lines[1].sign !== -1) return false;
    const [a, b] = [lines[0].n, lines[1].n];
    if (b >= a || b % 10 === 0) return false;
    if (!(a - b <= 60 || a % 100 === 0)) return false;
    return changeStop(a, b) < a; // два прыжка: до круглого и дальше
  },
  solve(lines) {
    if (!change.fits(lines)) return null;
    const [a, b] = [lines[0].n, lines[1].n];
    const R = changeStop(a, b);
    return {
      mode: "up",
      ops: [add(b, R - b, `до круглого ${R}`), add(R, a - R, `от ${R} до ${a}`)],
      answer: a - b,
    };
  },
  blanks(_lines, plan) {
    return plan.ops.map((o) => ({ prompt: `${o.a} + ☐ = ${o.r}`, expect: o.b }));
  },
  draft(tier, rng) {
    if (tier === 1) {
      const b = nonRound(rng, 11, 69);
      return [L(int(rng, roundUp(b, 10) + 1, Math.min(99, b + 40))), L(b, -1)];
    }
    if (tier === 2) {
      const a = int(rng, 100, 200);
      return [L(a), L(nonRound(rng, a - 60, a - 11), -1)];
    }
    const a = int(rng, 3, 10) * 100;
    return [L(a), L(nonRound(rng, 101, a - 11), -1)];
  },
  examples: [
    [L(83), L(47, -1)],
    [L(500), L(286, -1)],
  ],
};

// ─── 8. Столбик разрядами ──────────────────────────────────────────────────

const column: Technique = {
  id: "column",
  title: "Столбик разрядами",
  level: 2,
  sign: "Нужно сложить 4 и больше двузначных чисел подряд.",
  idea: "Сложи все десятки, потом все единицы, потом соедини: 34 + 52 + 17 + 26 → 110 + 19.",
  mistake: "Сложить десятки как единицы: 3 + 5 + 1 + 2 = 11 — это 110, а не 11.",
  why: {
    q: "Почему десятки складываем отдельно от единиц?",
    options: [
      "Маленькие цифры легко держать в голове, а соединить в конце — один шаг",
      "Потому что единицы не важны",
      "Так получается круглый ответ",
    ],
    correct: 0,
  },
  fits: (lines) => lines.length >= 4 && allPlus(lines) && lines.every((l) => l.n >= 10 && l.n <= 99),
  solve(lines) {
    if (!column.fits(lines)) return null;
    const tens = lines.map((l) => l.n - (l.n % 10));
    const units = lines.map((l) => l.n % 10).filter(Boolean);
    const T = tens.reduce((s, x) => s + x, 0);
    const U = units.reduce((s, x) => s + x, 0);
    const ops = [...chain(tens), ...(units.length > 1 ? chain(units) : [])];
    if (units.length) ops.push(add(T, U, "соединили десятки и единицы"));
    return {
      split: lines.map((l, i) => ({ line: i, parts: [l.n - (l.n % 10), l.n % 10].filter(Boolean) })),
      ops,
      answer: T + U,
    };
  },
  blanks(lines) {
    const t = lines.map((l) => Math.floor(l.n / 10));
    const u = lines.map((l) => l.n % 10);
    const out: Blank[] = [
      { prompt: `Десятки: ${t.join(" + ")} = ☐ десятков`, expect: t.reduce((s, x) => s + x, 0) },
    ];
    if (u.some(Boolean)) out.push({ prompt: `Единицы: ${u.join(" + ")} = ☐`, expect: u.reduce((s, x) => s + x, 0) });
    return out;
  },
  draft(tier, rng) {
    const count = tier === 1 ? 4 : tier === 2 ? 5 : 6;
    const hi = tier === 1 ? 49 : 99;
    return plus(...Array.from({ length: count }, () => nonRound(rng, 11, hi)));
  },
  examples: [plus(34, 52, 17, 26), plus(43, 28, 61, 35, 14)],
};

// ─── 9. Плюсы отдельно, минусы отдельно ────────────────────────────────────

const signs: Technique = {
  id: "signs",
  title: "Плюсы отдельно, минусы отдельно",
  level: 2,
  sign: "В цепочке несколько минусов, и вместе они дают круглое: 45 − 17 + 38 − 23.",
  idea: "Сложи всё, что с плюсом, потом всё, что с минусом, и в конце одно вычитание.",
  mistake: "Сложить вычитаемые и потом прибавить их, а не отнять.",
  why: {
    q: "Почему 17 и 23 мы складываем, хотя перед ними минус?",
    options: [
      "Отнять 17 и отнять 23 — то же, что отнять 40 сразу",
      "Минус на минус даёт плюс",
      "Их можно складывать, только если они стоят рядом",
    ],
    correct: 0,
  },
  fits(lines) {
    if (lines[0]?.sign !== 1) return false;
    const P = lines.filter((l) => l.sign === 1).map((l) => l.n);
    const M = lines.filter((l) => l.sign === -1).map((l) => l.n);
    if (M.length < 2 || P.length < 2) return false;
    const sp = P.reduce((s, x) => s + x, 0);
    const sm = M.reduce((s, x) => s + x, 0);
    return sp >= sm && (sm % 10 === 0 || sp % 10 === 0);
  },
  solve(lines) {
    if (!signs.fits(lines)) return null;
    const P = lines.filter((l) => l.sign === 1).map((l) => l.n);
    const M = lines.filter((l) => l.sign === -1).map((l) => l.n);
    const sp = P.reduce((s, x) => s + x, 0);
    const sm = M.reduce((s, x) => s + x, 0);
    return {
      ops: [
        ...chain(P),
        ...chain(M).map((o) => ({ ...o, neg: true, why: "сложили вычитаемые" })),
        sub(sp, sm, "одно вычитание в конце"),
      ],
      answer: sp - sm,
    };
  },
  blanks(lines) {
    const P = lines.filter((l) => l.sign === 1).map((l) => l.n);
    const M = lines.filter((l) => l.sign === -1).map((l) => l.n);
    return [
      { prompt: `Минусы вместе: ${M.join(" + ")} = ☐`, expect: M.reduce((s, x) => s + x, 0) },
      { prompt: `Плюсы вместе: ${P.join(" + ")} = ☐`, expect: P.reduce((s, x) => s + x, 0) },
    ];
  },
  draft(tier, rng) {
    const big = tier === 3;
    const m1 = big ? nonRound(rng, 101, 399) : nonRound(rng, 11, 39);
    const mod = big ? 100 : 10;
    const m2 = big ? int(rng, 1, 3) * 100 + (mod - (m1 % 100)) : int(rng, 1, 3) * 10 + (10 - (m1 % 10));
    const plusCount = tier === 1 ? 2 : 3;
    const lo = big ? 201 : 31;
    const hi = big ? 899 : 89;
    const ps = Array.from({ length: plusCount }, () => nonRound(rng, lo, hi));
    // первый — плюс, остальные вперемешку
    const tail = shuffle(rng, [...ps.slice(1).map((n) => L(n)), L(m1, -1), L(m2, -1)]);
    return [L(ps[0]), ...tail];
  },
  examples: [
    [L(45), L(17, -1), L(38), L(23, -1)],
    [L(84), L(36, -1), L(52), L(44, -1), L(27)],
  ],
};

export const TECHNIQUES: Technique[] = [pairs, bridge, place, nearUp, doubles, nearDown, change, column, signs];

export const byId = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t])) as Record<Technique["id"], Technique>;

