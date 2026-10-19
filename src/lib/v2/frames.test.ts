import { test } from "node:test";
import assert from "node:assert/strict";
import { generate, TECHNIQUES } from "../engine/index.ts";
import { story, FOUNDATIONS, type FoundationId } from "../engine/story.ts";
import { seeded } from "../engine/util.ts";
import { boardWidth, foundationFrames, frames } from "./frames.ts";
import { cellsOf, groups, pack } from "./cells.ts";

test("кадры: на каждый beat свой кадр, рамка внутри строки, итог — ответ", () => {
  for (const t of TECHNIQUES)
    for (const tier of [1, 2, 3] as const)
      for (let seed = 1; seed <= 40; seed++) {
        const k = generate(t.id, tier, seeded(seed * 31 + tier));
        const fs = frames(t.id, k.lines, k.plan);
        const where = `${t.id}/${tier}/${seed}`;
        assert.equal(fs.length, story(t.id, k.lines, k.plan).length, where);
        for (const f of fs) {
          const n = [...f.board].length;
          assert.ok(n > 0, where);
          for (const [a, b] of f.lit) assert.ok(a >= 0 && b <= n && a < b, `${where}: ${f.board} [${a},${b}]`);
        }
        const last = fs.at(-1)!;
        assert.ok(last.board.endsWith(`=${k.answer}`), `${where}: ${last.board}`);
        assert.equal(last.board.slice(...last.lit[0]), String(k.answer), where);
        assert.ok(boardWidth(fs) <= 24, `${where}: ширина ${boardWidth(fs)}`);
      }
});

test("кадры почти круглого — как в утверждённом макете", () => {
  const lines = [{ n: 87, sign: 1 as const }, { n: 98, sign: 1 as const }];
  const plan = TECHNIQUES.find((t) => t.id === "nearUp")!.solve(lines)!;
  const fs = frames("nearUp", lines, plan);
  assert.deepEqual(
    fs.map((f) => f.board),
    ["87+98", "87+98", "87+100−2", "187−2", "185", "87+98=185"],
  );
  assert.deepEqual(fs[1].lit, [[3, 5]]);
  assert.deepEqual(fs[2].lit, [[3, 8]]);
  assert.deepEqual(fs[3].lit, [[0, 3]]);
  assert.equal(fs[0].pic.kind, "near");
});

test("основы: кадры строятся", () => {
  for (const id of Object.keys(FOUNDATIONS) as FoundationId[]) {
    const fs = foundationFrames(id);
    assert.equal(fs.length, FOUNDATIONS[id].beats.length);
    for (const f of fs) assert.ok([...f.board].length <= 12, f.board);
  }
});

test("табло: группы и раскладка по рядам", () => {
  assert.deepEqual(groups("64+98=   "), [[0, 2], [2, 5], [5, 9]]);
  const p = pack("49+36+45+53", 6, 1);
  assert.equal(p.rows, 2);
  assert.equal(p.cells.slice(0, 6).map((c) => c.ch).join(""), "49+36");
  assert.equal(p.pos[5], 6); // «+45» переехал целиком во второй ряд
  assert.deepEqual(cellsOf("185").map((c) => c.cls), ["c-h", "c-t", "c-u"]);
  const r = pack("−23", 4, 1, true);
  assert.equal(r.cells.map((c) => c.ch).join("|"), "|−|2|3");
});
