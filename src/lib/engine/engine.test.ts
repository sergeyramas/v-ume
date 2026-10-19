import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TECHNIQUES, byId, checkPlan, generate, otherWays, usable, ways } from "./index.ts";
import type { Line, Plan, TechniqueId, Tier } from "./types.ts";
import { L, plus, seeded, total } from "./util.ts";

const RUNS = 2000;
const TIERS: Tier[] = [1, 2, 3];

/** Приём действительно упрощает: появляется круглое число или шагов немного. */
function benefit(id: TechniqueId, plan: Plan): boolean {
  const o = plan.ops;
  switch (id) {
    case "pairs":
    case "bridge":
    case "change":
      return o[0].r % 10 === 0;
    case "nearUp":
      return o[0].b % 10 === 0;
    case "nearDown":
      return o[0].b % 10 === 0;
    case "doubles":
      return o[0].a === o[0].b;
    case "place":
      return o.length <= 6 && o.slice(0, -1).every((x) => x.b % 10 === 0 || x.b < 10 || x.b % 100 === 0 || x.a % 100 === 0);
    case "column":
      // до последнего шага: либо круглые десятки, либо однозначные единицы
      return o.slice(0, -1).every((x) => (x.a % 10 === 0 && x.b % 10 === 0) || x.b < 10);
    case "signs":
      return o.some((x) => x.neg) && o[o.length - 1].op === "−";
  }
}

describe("генерация: fits ⇒ solve, честное решение, выгода", () => {
  for (const t of TECHNIQUES) {
    for (const tier of TIERS) {
      it(`${t.id} / ступень ${tier}: ${RUNS} примеров`, () => {
        const rng = seeded(t.id.length * 1000 + tier);
        for (let i = 0; i < RUNS; i++) {
          const task = generate(t.id, tier, rng);
          const { lines, plan } = task;
          assert.ok(t.fits(lines), `fits: ${JSON.stringify(lines)}`);
          assert.deepEqual(checkPlan(lines, plan), [], JSON.stringify({ lines, plan }));
          assert.equal(plan.answer, total(lines));
          assert.ok(plan.answer >= 0);
          assert.ok(benefit(t.id, plan), `нет выгоды: ${JSON.stringify({ lines, plan })}`);
          for (const b of t.blanks(lines, plan)) {
            assert.notEqual(b.expect, plan.answer, `«допиши» выдаёт итог: ${b.prompt}`);
            assert.ok(b.prompt.includes("☐"));
            assert.ok(Number.isInteger(b.expect) && b.expect > 0, b.prompt);
          }
          assert.ok(t.blanks(lines, plan).length >= 1);
        }
      });
    }
  }
});

describe("примеры в карточках приёмов", () => {
  for (const t of TECHNIQUES) {
    it(`${t.id}: оба примера подходят`, () => {
      for (const ex of t.examples) assert.ok(usable(t, ex), JSON.stringify(ex));
    });
    it(`${t.id}: вопрос «почему» корректен`, () => {
      assert.ok(t.why.options.length >= 3);
      assert.ok(t.why.correct >= 0 && t.why.correct < t.why.options.length);
    });
  }
});

describe("checkPlan ловит нечестные решения", () => {
  const lines = plus(98, 47);
  const good = byId.nearUp.solve(lines)!;

  it("честное решение проходит", () => assert.deepEqual(checkPlan(lines, good), []));
  it("ошибка в шаге", () => {
    const bad = { ...good, ops: [good.ops[0], { ...good.ops[1], r: 146 }] };
    assert.ok(checkPlan(lines, bad).length);
  });
  it("поправка не в ту сторону (147 + 2)", () => {
    const bad: Plan = { ...good, ops: [good.ops[0], { a: 147, op: "+", b: 2, r: 149 }], answer: 145 };
    assert.ok(checkPlan(lines, bad).length);
  });
  it("часть строки забыта", () => {
    const bad: Plan = { ...good, ops: [good.ops[0]], answer: 145 };
    assert.ok(checkPlan(lines, bad).length);
  });
  it("части не дают строку", () => {
    const bad: Plan = { ...good, split: [{ line: 0, parts: [100, -3] }] };
    assert.ok(checkPlan(lines, bad).length);
  });
  it("отрицательный промежуточный результат", () => {
    const l2 = [L(30), L(50, -1), L(40)];
    const bad: Plan = { ops: [{ a: 30, op: "−", b: 50, r: -20 }, { a: -20, op: "+", b: 40, r: 20 }], answer: 20 };
    assert.ok(checkPlan(l2, bad).length);
  });
  it("сдача: ответ — сумма прыжков, а не конечная точка", () => {
    const l = [L(83), L(47, -1)];
    const p = byId.change.solve(l)!;
    assert.deepEqual(checkPlan(l, p), []);
    assert.ok(checkPlan(l, { ...p, answer: 83 }).length);
  });
});

describe("граничные случаи", () => {
  const sees = (lines: Line[]) => ways(lines).map((w) => w.technique.id);

  it("98 → 100 − 2, 102 → 100 + 2", () => {
    const a = byId.nearUp.solve(plus(98, 47))!;
    assert.deepEqual(a.ops.map((o) => [o.a, o.op, o.b, o.r]), [[47, "+", 100, 147], [147, "−", 2, 145]]);
    const b = byId.nearUp.solve(plus(47, 102))!;
    assert.deepEqual(b.ops.map((o) => [o.a, o.op, o.b, o.r]), [[47, "+", 100, 147], [147, "+", 2, 149]]);
  });
  it("вычитание почти круглого: − 98 → − 100 + 2, − 102 → − 100 − 2", () => {
    const a = byId.nearDown.solve([L(145), L(98, -1)])!;
    assert.deepEqual(a.ops.map((o) => [o.op, o.b]), [["−", 100], ["+", 2]]);
    const b = byId.nearDown.solve([L(245), L(102, -1)])!;
    assert.deepEqual(b.ops.map((o) => [o.op, o.b]), [["−", 100], ["−", 2]]);
  });
  it("− 98 из числа меньше 100 не берём (ушли бы в минус)", () => {
    assert.equal(byId.nearDown.fits([L(99), L(98, -1)]), false);
  });
  it("ноль в единицах: круглое слагаемое не «почти круглое» и не мост", () => {
    assert.equal(byId.bridge.fits(plus(40, 38)), false);
    assert.equal(byId.nearUp.fits(plus(98, 40)), false);
    assert.equal(byId.place.fits(plus(47, 30)), false);
  });
  it("равные числа — не «почти двойняшки»", () => {
    assert.equal(byId.doubles.fits(plus(38, 38)), false);
    assert.ok(byId.doubles.fits(plus(38, 39)));
  });
  it("переход через 100 и через 1000", () => {
    assert.deepEqual(byId.bridge.solve(plus(87, 45))!.ops[0].r, 100);
    assert.deepEqual(checkPlan(plus(987, 45), byId.bridge.solve(plus(987, 45))!), []);
    assert.equal(byId.bridge.solve(plus(987, 45))!.ops[0].r, 1000);
    assert.deepEqual(checkPlan(plus(678, 456), byId.place.solve(plus(678, 456))!), []);
  });
  it("повторы чисел", () => {
    const l = plus(25, 25, 75, 75);
    assert.ok(sees(l).includes("pairs"));
    assert.deepEqual(checkPlan(l, byId.pairs.solve(l)!), []);
  });
  it("пара минусов не идёт в «друзей», для смешанной цепочки — «плюсы отдельно»", () => {
    const l = [L(45), L(17, -1), L(38), L(23, -1)];
    assert.equal(byId.pairs.fits(l), false);
    assert.ok(sees(l).includes("signs"));
  });
  it("сдача: только когда два прыжка", () => {
    assert.equal(byId.change.fits([L(50), L(47, -1)]), false);
    assert.equal(byId.change.fits([L(83), L(40, -1)]), false);
    assert.ok(byId.change.fits([L(500), L(286, -1)]));
    assert.equal(byId.change.solve([L(500), L(286, -1)])!.ops[0].r, 300);
  });
  it("столбик: все единицы нули", () => {
    const l = plus(30, 40, 50, 20);
    const p = byId.column.solve(l)!;
    assert.deepEqual(checkPlan(l, p), []);
    assert.equal(byId.column.blanks(l, p).length, 1);
  });
  it("плюсы меньше минусов — не подходит", () => {
    assert.equal(byId.signs.fits([L(20), L(17, -1), L(10), L(23, -1)]), false);
  });
  it("«Реши по-другому» только при реальной альтернативе", () => {
    assert.ok(otherWays(plus(98, 47), "nearUp").length >= 1); // ещё «по частям»
    assert.equal(otherWays([L(45), L(17, -1), L(38), L(23, -1)], "signs").length, 0);
  });
  it("все строки ≥ 1 и первая с плюсом", () => {
    assert.equal(usable(byId.place, [L(47, -1), L(38)]), null);
    assert.equal(usable(byId.place, [L(0), L(38)]), null);
  });
});
