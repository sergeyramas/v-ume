import { explain, sumLines, type Kind, type Line } from "@/lib/explain";
import { numberToRu } from "@/lib/ru";
import type { Difficulty } from "@/lib/store";

export type Problem = {
  lines: Line[];
  answer: number;
  steps: string[];
  speech: string;
};

export type Lesson = {
  id: string;
  chapter: string;
  title: string;
  remind: string;
  about: string;
  mark: boolean;
  kind: Kind;
  example: Line[];
  make: (d: Difficulty) => Problem;
};

function ri(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(items: T[]): T {
  return items[ri(0, items.length - 1)] as T;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = ri(0, i);
    const a = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = a;
  }
  return copy;
}

function two(min = 14, max = 97) {
  return ri(min, max);
}

function three(min: number, max: number) {
  return ri(min, max);
}

function speech(lines: Line[]) {
  return lines
    .map((line, index) => {
      const word = numberToRu(line.n);
      if (index === 0) return word;
      return line.sign < 0 ? `минус ${word}` : `плюс ${word}`;
    })
    .join(", ");
}

function finish(kind: Kind, lines: Line[]): Problem {
  const answer = sumLines(lines);
  return { lines, answer, steps: explain(kind, lines), speech: speech(lines) };
}

function splitSum(target: number): [number, number] {
  if (target === 100) {
    const a = ri(16, 84);
    return [a, target - a];
  }
  if (target === 200) {
    const a = ri(110, 170);
    return [a, target - a];
  }
  if (target === 500) {
    const a = ri(160, 340);
    return [a, target - a];
  }
  const a = ri(280, 720);
  return [a, target - a];
}

function makeRun(d: Difficulty, counts: [number, number, number], mixed: boolean): Problem {
  const count = d === "easy" ? counts[0] : d === "mid" ? counts[1] : counts[2];
  const lines: Line[] = [];
  for (let i = 0; i < count; i++) {
    const useThree = mixed && (d === "easy" ? i === 0 : d === "mid" ? i % 2 === 0 : true);
    lines.push({
      n: useThree ? three(110, d === "hard" ? 680 : 320) : two(),
      sign: 1,
    });
  }
  return finish("run", lines);
}

function makePairs(d: Difficulty): Problem {
  const targets = d === "easy" ? [100, 100] : d === "mid" ? [100, 200] : [500, 1000];
  const lines: Line[] = [];
  for (const target of targets) {
    const [a, b] = splitSum(target);
    lines.push({ n: a, sign: 1 }, { n: b, sign: 1 });
  }
  if (d !== "easy") lines.push({ n: d === "mid" ? two(18, 70) : three(120, 240), sign: 1 });
  return finish("pairs", shuffle(lines));
}

function makeRound(d: Difficulty): Problem {
  const bases = d === "easy" ? [50, 100] : d === "mid" ? [100, 200, 300] : [400, 500, 1000];
  const near = pick(bases) - ri(1, 3);
  const extras = d === "easy" ? 2 : d === "mid" ? 3 : 3;
  const lines: Line[] = [{ n: two(), sign: 1 }, { n: near, sign: 1 }];
  for (let i = 0; i < extras; i++) {
    lines.push({
      n: d === "hard" && i === 0 ? three(120, 460) : two(),
      sign: 1,
    });
  }
  return finish("run", lines);
}

function makeRefund(d: Difficulty, returns: number): Problem {
  const adds = d === "easy" ? 3 : d === "mid" ? 4 : 5;
  const lines: Line[] = [];
  for (let i = 0; i < adds; i++) {
    const useThree = d === "easy" ? i === 0 : d === "mid" ? i < 2 : i < 4;
    lines.push({
      n: useThree ? three(120, d === "hard" ? 540 : 280) : two(),
      sign: 1,
    });
  }
  let left = sumLines(lines);
  for (let r = 0; r < returns; r++) {
    if (left <= 24) break;
    const cap = Math.min(d === "hard" ? 160 : 70, left - 12);
    if (cap < 12) break;
    const n = ri(12, cap);
    lines.push({ n, sign: -1 });
    left -= n;
  }
  return finish("run", lines);
}

function makeBoss(d: Difficulty): Problem {
  const roll = ri(0, 2);
  if (roll === 0) return makePairs(d);
  if (roll === 1) return makeRound(d);
  return makeRefund(d, d === "easy" ? 1 : 2);
}

export const ROUND = 5;

export function passNeed(d: Difficulty) {
  return d === "easy" ? 3 : 4;
}

export function starsFor(correct: number, d: Difficulty) {
  const errors = ROUND - correct;
  if (correct < passNeed(d)) return 0;
  if (errors <= 0) return 3;
  if (errors === 1) return 2;
  return 1;
}

export function secondsFor(d: Difficulty, lines: number, streak: number) {
  const base = d === "easy" ? 14 : d === "mid" ? 9 : 6;
  const per = d === "easy" ? 4 : d === "mid" ? 3 : 2;
  return base + per * lines + (streak >= 3 ? 4 : 0);
}

export const LESSONS: Lesson[] = [
  {
    id: "two",
    chapter: "Одна сумма",
    title: "Два числа",
    remind: "Сначала десятки, потом единицы. Не столбик справа.",
    about: "Так начинают, когда в тетради всего две строки. Десятки складывают отдельно от единиц.",
    mark: false,
    kind: "run",
    example: [
      { n: 47, sign: 1 },
      { n: 38, sign: 1 },
    ],
    make: (d) => makeRun(d, [2, 3, 4], false),
  },
  {
    id: "running",
    chapter: "Одна сумма",
    title: "Текущая сумма",
    remind: "Держи в голове только одно число — то, что уже набрал.",
    about: "Продавец не начинает список заново. Прибавил строку — забыл её, помнит только итог.",
    mark: false,
    kind: "run",
    example: [
      { n: 26, sign: 1 },
      { n: 45, sign: 1 },
      { n: 18, sign: 1 },
    ],
    make: (d) => makeRun(d, [3, 4, 5], false),
  },
  {
    id: "pairs",
    chapter: "Пары и круглое",
    title: "Пары до ста",
    remind: "Сначала найди два числа, которые вместе дают 100, 200 или 500.",
    about: "В куче ящиков глаз цепляется за пару. 47 и 53 — это уже сотня, остальные короче.",
    mark: false,
    kind: "pairs",
    example: [
      { n: 47, sign: 1 },
      { n: 28, sign: 1 },
      { n: 53, sign: 1 },
      { n: 22, sign: 1 },
    ],
    make: makePairs,
  },
  {
    id: "round",
    chapter: "Пары и круглое",
    title: "Почти круглое",
    remind: "98 — это 100 минус 2. Прибавь круглое и верни мелочь.",
    about: "Рядом с круглым считать легче, чем честно. Лишнее потом вычитается.",
    mark: false,
    kind: "run",
    example: [
      { n: 64, sign: 1 },
      { n: 98, sign: 1 },
      { n: 27, sign: 1 },
    ],
    make: makeRound,
  },
  {
    id: "mark",
    chapter: "Накладная",
    title: "Одна черта",
    remind: "На середине списка можно записать одну пометку. Не столбик — одну сумму.",
    about: "Оптовик иногда ставит черту и пишет промежуточный итог на полях. Дальше считает уже от него.",
    mark: true,
    kind: "run",
    example: [
      { n: 36, sign: 1 },
      { n: 48, sign: 1 },
      { n: 27, sign: 1 },
      { n: 15, sign: 1 },
    ],
    make: (d) => makeRun(d, [4, 5, 6], false),
  },
  {
    id: "mixed",
    chapter: "Накладная",
    title: "Сотни в списке",
    remind: "Трёхзначное прибавляй сотнями, потом остаток. Текущая сумма одна.",
    about: "Двузначные и трёхзначные в одной накладной. Сотни — отдельным шагом, не все цифры сразу.",
    mark: true,
    kind: "run",
    example: [
      { n: 86, sign: 1 },
      { n: 140, sign: 1 },
      { n: 35, sign: 1 },
    ],
    make: (d) => makeRun(d, [3, 4, 5], true),
  },
  {
    id: "long",
    chapter: "Накладная",
    title: "Длинный список",
    remind: "Не перечитывай верх. Идёшь вниз от последней пометки.",
    about: "Шесть-семь строк — обычная сдача ящиков. Калькулятор тут чаще врёт от спешки, чем голова с одной суммой.",
    mark: true,
    kind: "run",
    example: [
      { n: 64, sign: 1 },
      { n: 120, sign: 1 },
      { n: 47, sign: 1 },
      { n: 210, sign: 1 },
      { n: 28, sign: 1 },
    ],
    make: (d) => makeRun(d, [5, 6, 7], true),
  },
  {
    id: "back",
    chapter: "Возврат",
    title: "Один возврат",
    remind: "Сначала сложи приход. Возврат вычти в конце, лучше через круглое.",
    about: "Покупатель сдал ящик назад. Это минус внизу листа, не повод считать всё сначала.",
    mark: true,
    kind: "run",
    example: [
      { n: 120, sign: 1 },
      { n: 85, sign: 1 },
      { n: 64, sign: 1 },
      { n: 36, sign: -1 },
    ],
    make: (d) => makeRefund(d, 1),
  },
  {
    id: "backs",
    chapter: "Возврат",
    title: "Два возврата",
    remind: "Два минуса можно вычесть по очереди из уже готовой суммы.",
    about: "Две правки в накладной. Приход закрыт, дальше только вычитание.",
    mark: true,
    kind: "run",
    example: [
      { n: 250, sign: 1 },
      { n: 86, sign: 1 },
      { n: 140, sign: 1 },
      { n: 25, sign: -1 },
      { n: 18, sign: -1 },
    ],
    make: (d) => makeRefund(d, 2),
  },
  {
    id: "dock",
    chapter: "Возврат",
    title: "Ящик оптовика",
    remind: "Пары, круглое или возврат — что увидишь в листе. Плита здесь короткая.",
    about: "Смешанная накладная, как у человека, который пересчитывает мандарины быстрее калькулятора.",
    mark: true,
    kind: "pairs",
    example: [
      { n: 47, sign: 1 },
      { n: 53, sign: 1 },
      { n: 198, sign: 1 },
      { n: 76, sign: 1 },
      { n: 20, sign: -1 },
    ],
    make: makeBoss,
  },
];

export function getLesson(id: string) {
  return LESSONS.find((lesson) => lesson.id === id) ?? null;
}

export function lessonNo(id: string) {
  return LESSONS.findIndex((lesson) => lesson.id === id) + 1;
}

export function listLabel(lines: Line[]) {
  return lines.map((line) => `${line.sign < 0 ? "−" : ""}${line.n}`).join(", ");
}
