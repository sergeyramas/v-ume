import { fmt } from "@/lib/ru";

export type Line = { n: number; sign: 1 | -1 };
export type Kind = "run" | "pairs";

export type VisualStep = {
  label: string;
  formula: string;
  note?: string;
  type: "prep" | "add" | "sub" | "result" | "pair";
  highlight?: string;
};

export type VisualExplanation = {
  strategy: "round_hundred" | "round_ten" | "pairs" | "place_value" | "chain" | "refund";
  title: string;
  badge: string;
  tagline: string;
  summary: string;
  steps: VisualStep[];
  finalResult: number;
  alternative?: {
    title: string;
    summary: string;
    steps: VisualStep[];
  };
};

/**
 * Ищет ближайшее круглое число для округления:
 * - До сотни (100, 200, 300...) при разнице до 15 единиц (например 92 -> 100, 88 -> 100, 195 -> 200)
 * - До десятка (20, 30, 40...) при разнице до 3 единиц (для 28, 29, 38, 39, 47, 48...)
 */
export function lift(n: number): { round: number; back: number; isHundred: boolean } | null {
  if (n < 15) return null;
  // Проверяем сотни в первую очередь (приоритет для детей: через 100 считать проще всего)
  for (let x = 100; x <= 5000; x += 100) {
    const back = x - n;
    if (back > 0 && back <= 15) {
      return { round: x, back, isHundred: true };
    }
  }
  // Проверяем круглые десятки
  for (let x = 20; x <= 100; x += 10) {
    const back = x - n;
    if (back > 0 && back <= 3) {
      return { round: x, back, isHundred: false };
    }
  }
  return null;
}

function addOnto(run: number, n: number): { next: number; text: string } {
  const next = run + n;
  if (run === 0) return { next, text: `Старт ${fmt(n)}` };
  const near = lift(n);
  if (near) {
    return {
      next,
      text: `${fmt(n)} — это ${fmt(near.round)} минус ${near.back}. ${fmt(run)} + ${fmt(near.round)} − ${near.back} = ${fmt(next)}`,
    };
  }
  if (n >= 100) {
    const hundreds = Math.floor(n / 100) * 100;
    const rest = n - hundreds;
    if (rest === 0) return { next, text: `${fmt(run)} + ${fmt(n)} = ${fmt(next)}` };
    return {
      next,
      text: `${fmt(run)} + ${fmt(hundreds)} = ${fmt(run + hundreds)}, затем + ${fmt(rest)} = ${fmt(next)}`,
    };
  }
  const tens = Math.floor(n / 10) * 10;
  const ones = n % 10;
  if (ones === 0 || tens === 0) return { next, text: `${fmt(run)} + ${fmt(n)} = ${fmt(next)}` };
  return {
    next,
    text: `${fmt(run)} + ${fmt(tens)} = ${fmt(run + tens)}, затем + ${ones} = ${fmt(next)}`,
  };
}

function subFrom(run: number, n: number): { next: number; text: string } {
  const next = run - n;
  const near = lift(n);
  if (near && run >= near.round) {
    return {
      next,
      text: `${fmt(run)} − ${fmt(n)}: вычитаем ${fmt(near.round)} и возвращаем ${near.back}. ${fmt(run - near.round)} + ${near.back} = ${fmt(next)}`,
    };
  }
  if (n >= 100) {
    const hundreds = Math.floor(n / 100) * 100;
    const rest = n - hundreds;
    if (rest === 0) return { next, text: `${fmt(run)} − ${fmt(n)} = ${fmt(next)}` };
    return {
      next,
      text: `${fmt(run)} − ${fmt(hundreds)} = ${fmt(run - hundreds)}, затем − ${fmt(rest)} = ${fmt(next)}`,
    };
  }
  const tens = Math.floor(n / 10) * 10;
  const ones = n % 10;
  if (ones === 0 || tens === 0) return { next, text: `${fmt(run)} − ${fmt(n)} = ${fmt(next)}` };
  return {
    next,
    text: `${fmt(run)} − ${tens} = ${fmt(run - tens)}, затем − ${ones} = ${fmt(next)}`,
  };
}

export function sumLines(lines: Line[]): number {
  return lines.reduce((s, line) => s + line.sign * line.n, 0);
}

function explainRun(lines: Line[]): string[] {
  const ordered = [...lines.filter((l) => l.sign > 0), ...lines.filter((l) => l.sign < 0)];
  const steps: string[] = [];
  let run = 0;
  for (const line of ordered) {
    const step = line.sign > 0 ? addOnto(run, line.n) : subFrom(run, line.n);
    steps.push(step.text);
    run = step.next;
  }
  steps.push(`Итого ${fmt(run)}`);
  return steps;
}

function explainPairs(lines: Line[]): string[] | null {
  const nums = lines.filter((l) => l.sign > 0).map((l) => l.n);
  const refunds = lines.filter((l) => l.sign < 0);
  const used = new Set<number>();
  const groups: number[] = [];
  const found: string[] = [];
  const targets = [1000, 500, 200, 100, 50];
  for (let i = 0; i < nums.length; i++) {
    if (used.has(i)) continue;
    let hit = false;
    for (let j = i + 1; j < nums.length && !hit; j++) {
      if (used.has(j)) continue;
      const pair = (nums[i] ?? 0) + (nums[j] ?? 0);
      if (targets.includes(pair)) {
        used.add(i);
        used.add(j);
        groups.push(pair);
        found.push(`${fmt(nums[i] ?? 0)} + ${fmt(nums[j] ?? 0)} = ${fmt(pair)}`);
        hit = true;
      }
    }
  }
  if (found.length === 0) return null;
  for (let i = 0; i < nums.length; i++) {
    if (!used.has(i)) groups.push(nums[i] ?? 0);
  }
  const steps = [...found];
  let run = groups[0] ?? 0;
  for (let i = 1; i < groups.length; i++) {
    const step = addOnto(run, groups[i] ?? 0);
    steps.push(step.text);
    run = step.next;
  }
  for (const line of refunds) {
    const step = subFrom(run, line.n);
    steps.push(step.text);
    run = step.next;
  }
  steps.push(`Итого ${fmt(run)}`);
  return steps;
}

export function explain(kind: Kind, lines: Line[]): string[] {
  const answer = sumLines(lines);
  const tagged = `Итого ${fmt(answer)}`;
  if (kind === "pairs") {
    const paired = explainPairs(lines);
    if (paired && paired[paired.length - 1] === tagged) return paired;
  }
  const running = explainRun(lines);
  if (running[running.length - 1] === tagged) return running;
  return [`Сложи строки по одной, возврат вычти в конце`, tagged];
}

/**
 * Создаёт структурированное визуальное объяснение лучшего приёма устного счёта.
 */
export function buildVisualExplanation(lines: Line[], kind: Kind): VisualExplanation {
  const answer = sumLines(lines);
  const refunds = lines.filter((l) => l.sign < 0);
  const positives = lines.filter((l) => l.sign > 0);

  // 1. Если есть возврат — стратегия «Возврат в конце»
  if (refunds.length > 0) {
    const posSum = sumLines(positives);
    const steps: VisualStep[] = [
      {
        label: "Сложи приходы",
        formula: positives.map((p) => fmt(p.n)).join(" + ") + ` = ${fmt(posSum)}`,
        note: "сначала собираем всю сумму без возвратов",
        type: "add",
      },
    ];
    let cur = posSum;
    for (const r of refunds) {
      const next = cur - r.n;
      steps.push({
        label: `Вычти возврат ${fmt(r.n)}`,
        formula: `${fmt(cur)} − ${fmt(r.n)} = ${fmt(next)}`,
        note: "вычитаем возврат из набранного итога",
        type: "sub",
      });
      cur = next;
    }
    steps.push({
      label: "Итог",
      formula: `= ${fmt(cur)}`,
      note: "окончательный расчёт накладной",
      type: "result",
    });

    return {
      strategy: "refund",
      title: "Возврат в конце",
      badge: "Сначала +, потом −",
      tagline: "Сложи все приходы в одну сумму, а возврат вычти в самом конце.",
      summary: `${fmt(posSum)} − ${refunds.map((r) => fmt(r.n)).join(" − ")} = ${fmt(cur)}`,
      steps,
      finalResult: cur,
    };
  }

  // 2. Если вид «пары» или в списке есть круглая пара до 100/200/500/1000
  if (kind === "pairs" || lines.length >= 4) {
    const nums = positives.map((l) => l.n);
    const used = new Set<number>();
    const targets = [1000, 500, 200, 100];
    const pairSteps: VisualStep[] = [];
    const pairTotals: number[] = [];

    for (let i = 0; i < nums.length; i++) {
      if (used.has(i)) continue;
      for (let j = i + 1; j < nums.length; j++) {
        if (used.has(j)) continue;
        const sum = (nums[i] ?? 0) + (nums[j] ?? 0);
        if (targets.includes(sum)) {
          used.add(i);
          used.add(j);
          pairTotals.push(sum);
          pairSteps.push({
            label: "Круглая пара",
            formula: `${fmt(nums[i] ?? 0)} + ${fmt(nums[j] ?? 0)} = ${fmt(sum)}`,
            note: "эти два числа дают круглую сумму",
            type: "pair",
          });
          break;
        }
      }
    }

    if (pairSteps.length > 0) {
      const remaining: number[] = [];
      for (let i = 0; i < nums.length; i++) {
        if (!used.has(i)) remaining.push(nums[i] ?? 0);
      }
      let acc = pairTotals[0] ?? 0;
      for (let i = 1; i < pairTotals.length; i++) {
        const next = acc + (pairTotals[i] ?? 0);
        pairSteps.push({
          label: "Сложи круглые пары",
          formula: `${fmt(acc)} + ${fmt(pairTotals[i] ?? 0)} = ${fmt(next)}`,
          note: "круглые сотни складываются мгновенно",
          type: "add",
        });
        acc = next;
      }
      for (const rem of remaining) {
        const next = acc + rem;
        pairSteps.push({
          label: `Прибавь ${fmt(rem)}`,
          formula: `${fmt(acc)} + ${fmt(rem)} = ${fmt(next)}`,
          note: "добавляем оставшееся число",
          type: "add",
        });
        acc = next;
      }
      pairSteps.push({
        label: "Итог",
        formula: `= ${fmt(acc)}`,
        note: "быстрый подсчёт через пары",
        type: "result",
      });

      return {
        strategy: "pairs",
        title: "Пары до круглого",
        badge: "Ищи 100 или 200",
        tagline: "Глазами найди числа, которые вместе дают круглую сумму.",
        summary: pairSteps.map((s) => s.formula).join(" → "),
        steps: pairSteps,
        finalResult: acc,
      };
    }
  }

  // 3. Два числа (самый частый и ключевой базовый случай: например 92 + 65, 47 + 38)
  if (positives.length === 2) {
    const a = positives[0]!.n;
    const b = positives[1]!.n;

    // Проверяем, есть ли число, близкое к 100 или 200
    const liftA = lift(a);
    const liftB = lift(b);

    const hundredCandidate =
      liftA && liftA.isHundred
        ? { near: a, other: b, lift: liftA }
        : liftB && liftB.isHundred
          ? { near: b, other: a, lift: liftB }
          : null;

    if (hundredCandidate) {
      const { near, other, lift: hLift } = hundredCandidate;
      const intermediate = other + hLift.round;
      const final = intermediate - hLift.back;

      const steps: VisualStep[] = [
        {
          label: "1. Округляем до сотни",
          formula: `${fmt(near)} → ${fmt(hLift.round)} (+${hLift.back})`,
          note: `добавили ${hLift.back}, чтобы получить лёгкое число ${fmt(hLift.round)}`,
          type: "prep",
        },
        {
          label: "2. Прибавляем круглое",
          formula: `${fmt(other)} + ${fmt(hLift.round)} = ${fmt(intermediate)}`,
          note: `с круглыми сотнями считать в разы проще`,
          type: "add",
        },
        {
          label: "3. Вычитаем добавку",
          formula: `${fmt(intermediate)} − ${hLift.back} = ${fmt(final)}`,
          note: `возвращаем добавленные ${hLift.back}`,
          type: "sub",
        },
        {
          label: "Готово",
          formula: `= ${fmt(final)}`,
          note: "ответ получен без столбика",
          type: "result",
        },
      ];

      // Альтернативный способ для сравнения: сложение десятков и единиц
      const tensNear = Math.floor(near / 10) * 10;
      const onesNear = near % 10;
      const tensOther = Math.floor(other / 10) * 10;
      const onesOther = other % 10;
      const tensSum = tensNear + tensOther;
      const onesSum = onesNear + onesOther;

      const altSteps: VisualStep[] = [
        {
          label: "Десятки",
          formula: `${fmt(tensNear)} + ${fmt(tensOther)} = ${fmt(tensSum)}`,
          note: "складываем только десятки",
          type: "add",
        },
        {
          label: "Единицы",
          formula: `${onesNear} + ${onesOther} = ${onesSum}`,
          note: "складываем единицы",
          type: "add",
        },
        {
          label: "Собираем",
          formula: `${fmt(tensSum)} + ${onesSum} = ${fmt(final)}`,
          note: "соединяем десятки и единицы",
          type: "result",
        },
      ];

      return {
        strategy: "round_hundred",
        title: `Округление до сотни (${fmt(near)} → ${fmt(hLift.round)})`,
        badge: `Трюк: +${hLift.back} и −${hLift.back}`,
        tagline: `${fmt(near)} почти ${fmt(hLift.round)}. Прибавь ${fmt(hLift.round)} к ${fmt(other)} и вычти ${hLift.back}.`,
        summary: `${fmt(hLift.round)} + ${fmt(other)} = ${fmt(intermediate)} → ${fmt(intermediate)} − ${hLift.back} = ${fmt(final)}`,
        steps,
        finalResult: final,
        alternative: {
          title: "Способ 2: Сначала десятки, потом единицы",
          summary: `${fmt(tensSum)} + ${onesSum} = ${fmt(final)}`,
          steps: altSteps,
        },
      };
    }

    // Проверяем округление до круглого десятка (для чисел, оканчивающихся на 7, 8, 9, напр. 38, 49)
    const tenCandidate =
      liftA
        ? { near: a, other: b, lift: liftA }
        : liftB
          ? { near: b, other: a, lift: liftB }
          : null;

    if (tenCandidate) {
      const { near, other, lift: tLift } = tenCandidate;
      const intermediate = other + tLift.round;
      const final = intermediate - tLift.back;

      const steps: VisualStep[] = [
        {
          label: "1. Округляем до десятка",
          formula: `${fmt(near)} → ${fmt(tLift.round)} (+${tLift.back})`,
          note: `добавили ${tLift.back} до круглого ${fmt(tLift.round)}`,
          type: "prep",
        },
        {
          label: "2. Прибавляем круглое",
          formula: `${fmt(other)} + ${fmt(tLift.round)} = ${fmt(intermediate)}`,
          note: "прибавлять круглое число легко",
          type: "add",
        },
        {
          label: "3. Вычитаем добавку",
          formula: `${fmt(intermediate)} − ${tLift.back} = ${fmt(final)}`,
          note: `забираем добавленные ${tLift.back}`,
          type: "sub",
        },
        {
          label: "Готово",
          formula: `= ${fmt(final)}`,
          note: "быстрый и точный счёт",
          type: "result",
        },
      ];

      return {
        strategy: "round_ten",
        title: `Округление до десятка (${fmt(near)} → ${fmt(tLift.round)})`,
        badge: `Трюк: +${tLift.back} и −${tLift.back}`,
        tagline: `${fmt(near)} почти ${fmt(tLift.round)}. Прибавь ${fmt(tLift.round)} и вычти ${tLift.back}.`,
        summary: `${fmt(other)} + ${fmt(tLift.round)} = ${fmt(intermediate)} → ${fmt(intermediate)} − ${tLift.back} = ${fmt(final)}`,
        steps,
        finalResult: final,
      };
    }

    // Если оба числа стандартные (напр. 43 + 35) — поразрядное сложение слева направо
    const tensA = Math.floor(a / 10) * 10;
    const onesA = a % 10;
    const tensB = Math.floor(b / 10) * 10;
    const onesB = b % 10;
    const tensSum = tensA + tensB;
    const onesSum = onesA + onesB;
    const final = tensSum + onesSum;

    const steps: VisualStep[] = [
      {
        label: "1. Десятки (слева)",
        formula: `${fmt(tensA)} + ${fmt(tensB)} = ${fmt(tensSum)}`,
        note: "считаем десятки отдельно",
        type: "add",
      },
      {
        label: "2. Единицы",
        formula: `${onesA} + ${onesB} = ${onesSum}`,
        note: "считаем единицы отдельно",
        type: "add",
      },
      {
        label: "3. Соединяем",
        formula: `${fmt(tensSum)} + ${onesSum} = ${fmt(final)}`,
        note: "собираем общую сумму",
        type: "result",
      },
    ];

    const altSteps: VisualStep[] = [
      {
        label: "Прибавь десятки",
        formula: `${fmt(a)} + ${fmt(tensB)} = ${fmt(a + tensB)}`,
        note: "шаг 1: добавляем круглые десятки",
        type: "add",
      },
      {
        label: "Прибавь единицы",
        formula: `${fmt(a + tensB)} + ${onesB} = ${fmt(final)}`,
        note: "шаг 2: добавляем единицы",
        type: "add",
      },
    ];

    return {
      strategy: "place_value",
      title: "Сначала десятки, потом единицы",
      badge: "Слева направо",
      tagline: "Сложи десятки, потом сложи единицы и соедини.",
      summary: `(${fmt(tensA)} + ${fmt(tensB)}) + (${onesA} + ${onesB}) = ${fmt(tensSum)} + ${onesSum} = ${fmt(final)}`,
      steps,
      finalResult: final,
      alternative: {
        title: "Способ 2: Накопительно к первому числу",
        summary: `${fmt(a)} + ${fmt(tensB)} = ${fmt(a + tensB)} → + ${onesB} = ${fmt(final)}`,
        steps: altSteps,
      },
    };
  }

  // 4. Список из 3 и более чисел — пошаговая цепочка текущей суммы
  const chainSteps: VisualStep[] = [];
  let current = positives[0]!.n;
  chainSteps.push({
    label: "Старт",
    formula: `Помним ${fmt(current)}`,
    note: "первая сумма в голове",
    type: "prep",
  });

  for (let i = 1; i < positives.length; i++) {
    const nextNum = positives[i]!.n;
    const near = lift(nextNum);
    if (near) {
      const intermediate = current + near.round;
      const nextSum = intermediate - near.back;
      chainSteps.push({
        label: `+ ${fmt(nextNum)} (через ${fmt(near.round)})`,
        formula: `${fmt(current)} + ${fmt(near.round)} − ${near.back} = ${fmt(nextSum)}`,
        note: `округлили ${fmt(nextNum)} до ${fmt(near.round)} и вычли ${near.back}`,
        type: "add",
      });
      current = nextSum;
    } else {
      const tens = Math.floor(nextNum / 10) * 10;
      const ones = nextNum % 10;
      const nextSum = current + nextNum;
      chainSteps.push({
        label: `+ ${fmt(nextNum)}`,
        formula: `${fmt(current)} + ${fmt(tens)} + ${ones} = ${fmt(nextSum)}`,
        note: "прибавили десятки, затем единицы",
        type: "add",
      });
      current = nextSum;
    }
  }

  chainSteps.push({
    label: "Итоговая сумма",
    formula: `= ${fmt(current)}`,
    note: "держим только последнее число",
    type: "result",
  });

  return {
    strategy: "chain",
    title: "Текущая сумма в голове",
    badge: "Одна сумма в памяти",
    tagline: "Не пересчитывай список заново — держи в голове только текущий итог.",
    summary: chainSteps.map((s) => s.formula).join(" → "),
    steps: chainSteps,
    finalResult: current,
  };
}
