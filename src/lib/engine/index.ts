import { checkPlan } from "./plan.ts";
import { TECHNIQUES, byId } from "./techniques.ts";
import type { Line, Plan, Rng, Technique, TechniqueId, Tier } from "./types.ts";
import { total } from "./util.ts";

export { checkPlan, TECHNIQUES, byId };
export * from "./types.ts";

export type Task = { technique: TechniqueId; tier: Tier; lines: Line[]; plan: Plan; answer: number };

/** Подходит ли пример: приём применим, решение честное, «допиши» не выдаёт итог. */
export function usable(t: Technique, lines: Line[]): Plan | null {
  if (lines[0]?.sign !== 1 || total(lines) < 0) return null;
  if (lines.some((l) => !Number.isInteger(l.n) || l.n < 1 || l.n > 9999)) return null;
  if (!t.fits(lines)) return null;
  const plan = t.solve(lines);
  if (!plan || checkPlan(lines, plan).length) return null;
  const ans = plan.answer;
  if (t.blanks(lines, plan).some((b) => b.expect === ans)) return null;
  return plan;
}

/** Пример на приём. Бросает ошибку, если генератор не справился (ловится тестами). */
export function generate(id: TechniqueId, tier: Tier, rng: Rng = Math.random): Task {
  const t = byId[id];
  for (let i = 0; i < 500; i++) {
    const lines = t.draft(tier, rng);
    const plan = usable(t, lines);
    if (plan) return { technique: id, tier, lines, plan, answer: plan.answer };
  }
  throw new Error(`генератор ${id}/${tier} не нашёл пример`);
}

/** Приёмы, которыми можно решить пример. Порядок — по ступени и списку, без «рейтинга выгоды». */
export function ways(lines: Line[]): Array<{ technique: Technique; plan: Plan }> {
  return TECHNIQUES.flatMap((t) => {
    const plan = usable(t, lines);
    return plan ? [{ technique: t, plan }] : [];
  }).sort((x, y) => x.technique.level - y.technique.level);
}

/** «Реши по-другому» показываем, только если есть хотя бы один другой подходящий приём. */
export function otherWays(lines: Line[], used: TechniqueId) {
  return ways(lines).filter((w) => w.technique.id !== used);
}
