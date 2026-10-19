// Движок «В уме» 2.0: общие типы. Логика без React, чтобы её можно было тестировать в node.

export type Sign = 1 | -1;

/** Строка примера. Инвариант: n — целое 1..9999, первая строка со знаком +, итог ≥ 0. */
export type Line = { n: number; sign: Sign };

/** 1 — двузначные, 2 — двузначные с переходом через сотню, 3 — трёхзначные. */
export type Tier = 1 | 2 | 3;

export type Rng = () => number;

/**
 * Одно устное действие. Обычное действие: «a + b = r» или «a − b = r».
 * neg — действие внутри группы минусов: складываем вычитаемые (17 + 23 = 40),
 * а результат дальше идёт со знаком минус.
 */
export type Op = {
  a: number;
  op: "+" | "−";
  b: number;
  r: number;
  neg?: boolean;
  why?: string;
};

/**
 * Решение примера приёмом.
 * mode "pool" (по умолчанию): строки разбиты на части (split), действия по одному
 *   «съедают» части и прошлые результаты; в конце остаётся ровно ответ.
 * mode "up": вычитание добавлением вверх (как сдача), действия — прыжки от
 *   вычитаемого к уменьшаемому, ответ — сумма прыжков.
 */
export type Plan = {
  mode?: "pool" | "up";
  /** Разбиение строк на части: 98 → [100, −2], 38 → [30, 8]. Индекс — номер строки. */
  split?: Array<{ line: number; parts: number[] }>;
  /** Что «превращаем», для анимации: «98 → 100 − 2». */
  rewrite?: string;
  ops: Op[];
  answer: number;
};

/** Задание «допиши шаг»: одно число, в котором суть приёма. Никогда не итог примера. */
export type Blank = { prompt: string; expect: number };

export type WhyQuestion = { q: string; options: string[]; correct: number };

export type TechniqueId =
  | "pairs"
  | "bridge"
  | "place"
  | "nearUp"
  | "doubles"
  | "nearDown"
  | "change"
  | "column"
  | "signs";

export type Technique = {
  id: TechniqueId;
  /** Название для ребёнка. */
  title: string;
  /** 1 — база, 2 — средний уровень. */
  level: 1 | 2;
  /** Признак: когда приём выгоден. */
  sign: string;
  /** Суть приёма одной фразой. */
  idea: string;
  /** Типичная ошибка. */
  mistake: string;
  why: WhyQuestion;
  fits(lines: Line[]): boolean;
  /** fits ⇒ solve ≠ null. */
  solve(lines: Line[]): Plan | null;
  blanks(lines: Line[], plan: Plan): Blank[];
  /** Черновик примера; generate() в index.ts отбрасывает неподходящие. */
  draft(tier: Tier, rng: Rng): Line[];
  examples: [Line[], Line[]];
};

/** Сколько помощи взял ребёнок: 0 — сам, 1 — приём, 2 — первый шаг, 3 — показал решение / сдался. */
export type Help = 0 | 1 | 2 | 3;
