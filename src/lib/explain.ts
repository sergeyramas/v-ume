import { fmt } from "@/lib/ru";

export type Line = { n: number; sign: 1 | -1 };
export type Kind = "run" | "pairs";

function lift(n: number): { round: number; back: number } | null {
  if (n < 15) return null;
  const rounds: number[] = [];
  for (let x = 20; x <= 100; x += 10) rounds.push(x);
  for (let x = 200; x <= 5000; x += 100) rounds.push(x);
  for (const round of rounds) {
    const back = round - n;
    if (back > 0 && back <= 3) return { round, back };
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
