import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LADDER,
  checkpointAt,
  classOf,
  firstSlip,
  flowNumbers,
  nextStep,
  recordBest,
  runningSums,
  startSession,
  type Branch,
  type FlowStep,
} from "./flow.ts";
import { addDays, credited, dueToday, mastered, review, skipGuided, stars } from "./review.ts";
import { seeded } from "./util.ts";

const changed = (a: FlowStep, b: FlowStep) =>
  (["count", "digits", "showMs", "minus"] as const).filter((k) => a[k] !== b[k]).length;

describe("лестница Потока", () => {
  for (const branch of ["tens", "hundreds"] as Branch[]) {
    it(`${branch}: соседние ступени отличаются одним параметром`, () => {
      const l = LADDER[branch];
      for (let i = 1; i < l.length; i++) assert.equal(changed(l[i - 1], l[i]), 1, `ступень ${i + 1}`);
    });
    it(`${branch}: числа по ступеням — разрядность, количество, сумма не уходит в минус`, () => {
      const rng = seeded(7);
      LADDER[branch].forEach((s, i) => {
        for (let k = 0; k < 500; k++) {
          const ns = flowNumbers(branch, i + 1, rng);
          assert.equal(ns.length, s.count);
          assert.ok(ns[0] > 0);
          assert.ok(runningSums(ns).every((x) => x >= 0), JSON.stringify(ns));
          const lo = s.digits === 1 ? 1 : 10 ** (s.digits - 1);
          assert.ok(ns.every((n) => Math.abs(n) >= Math.min(lo, 1) && Math.abs(n) < 10 ** s.digits), JSON.stringify(ns));
          const minus = ns.filter((n) => n < 0).length;
          if (s.minus === 0) assert.equal(minus, 0);
          if (s.minus === 2) assert.ok(minus <= 2);
        }
      });
    });
  }
  it("переход 2 класса не меняет рекорд другого", () => {
    assert.notEqual(classOf(LADDER.tens[5]), classOf(LADDER.tens[6]));
  });
});

describe("правило вверх/вниз", () => {
  it("12–15: 2 верных — вверх", () => {
    let s = startSession("tens", 3);
    s = nextStep(s, true, "12-15");
    assert.equal(s.step, 3);
    s = nextStep(s, true, "12-15");
    assert.equal(s.step, 4);
  });
  it("9–11: нужно 3 верных", () => {
    let s = startSession("tens", 3);
    for (let i = 0; i < 2; i++) s = nextStep(s, true, "9-11");
    assert.equal(s.step, 3);
    s = nextStep(s, true, "9-11");
    assert.equal(s.step, 4);
  });
  it("первые 3 задачи сессии не понижают", () => {
    let s = startSession("tens", 5);
    for (let i = 0; i < 3; i++) s = nextStep(s, false, "12-15");
    assert.equal(s.step, 5);
    s = nextStep(s, false, "12-15");
    assert.equal(s.step, 4);
  });
  it("за сессию не выше старта + 2", () => {
    let s = startSession("tens", 2);
    for (let i = 0; i < 20; i++) s = nextStep(s, true, "12-15");
    assert.equal(s.step, 4);
  });
  it("не ниже 1 и не выше последней", () => {
    let s = startSession("tens", 1);
    for (let i = 0; i < 10; i++) s = nextStep(s, false, "12-15");
    assert.equal(s.step, 1);
    s = startSession("tens", LADDER.tens.length);
    for (let i = 0; i < 10; i++) s = nextStep(s, true, "12-15");
    assert.equal(s.step, LADDER.tens.length);
  });
  it("рекорд по классу — только верные и только выше", () => {
    let best: Record<string, number> = {};
    best = recordBest(best, "tens", 7, false);
    assert.deepEqual(best, {});
    best = recordBest(best, "tens", 7, true);
    assert.equal(Object.values(best)[0], 7);
    assert.equal(recordBest(best, "tens", 7, true), best);
  });
});

describe("контрольная точка", () => {
  it("только для 5+ чисел", () => {
    assert.equal(checkpointAt(4), null);
    assert.equal(checkpointAt(8), 3);
  });
  it("находит, где сбился", () => {
    const ns = [34, 52, 17, 26, 45];
    assert.equal(firstSlip(ns, 2, 103), null);
    assert.deepEqual(firstSlip(ns, 2, 93), { index: 2, expected: 103, said: 93, diff: -10 });
  });
});

describe("повторение и зачёт", () => {
  const today = "2026-10-19";
  it("засчитано: сам или с приёмом", () => {
    assert.ok(credited(true, 0) && credited(true, 1));
    assert.ok(!credited(true, 2) && !credited(true, 3) && !credited(false, 0));
  });
  it("ошибка/решение → коробка 1, шаг → та же, сам → дальше, после 4 — снята", () => {
    assert.deepEqual(review({ box: 3, due: today }, false, 0, today), { box: 1, due: today });
    assert.deepEqual(review({ box: 3, due: today }, true, 3, today), { box: 1, due: today });
    assert.deepEqual(review({ box: 3, due: today }, true, 2, today), { box: 3, due: addDays(today, 3) });
    assert.deepEqual(review({ box: 2, due: today }, true, 0, today), { box: 3, due: addDays(today, 3) });
    assert.equal(review({ box: 4, due: today }, true, 1, today), null);
    assert.deepEqual(review(undefined, true, 0, today), { box: 2, due: "2026-10-20" });
  });
  it("пропуск дней: просроченные по старшинству, не больше 6", () => {
    const cards = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`t${i}`, { box: 2 as const, due: addDays("2026-10-01", i) }]),
    );
    cards.future = { box: 2, due: "2026-10-25" };
    const due = dueToday(cards, today);
    assert.equal(due.length, 6);
    assert.deepEqual(due.slice(0, 2), ["t0", "t1"]);
    assert.ok(!due.includes("future"));
  });
  it("переход через месяц", () => assert.equal(addDays("2026-10-30", 3), "2026-11-02"));
  it("звёзды и освоение", () => {
    assert.deepEqual([6, 5, 4, 3].map(stars), [3, 2, 1, 0]);
    assert.ok(mastered([{ credited: 3 }, { credited: 5 }, { credited: 6 }]));
    assert.ok(!mastered([{ credited: 6 }, { credited: 4 }]));
    assert.ok(!mastered([{ credited: 6 }]));
  });
  it("пропуск разбора после двух засчитанных", () => {
    assert.ok(skipGuided([{ correct: true, help: 0 }, { correct: true, help: 1 }]));
    assert.ok(!skipGuided([{ correct: true, help: 0 }, { correct: true, help: 2 }]));
  });
});
