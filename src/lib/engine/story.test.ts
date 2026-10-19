import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TECHNIQUES, generate } from "./index.ts";
import { FOUNDATIONS, HOOK, MAX_WORDS, NEEDS, foundationTask, story, words, type FoundationId } from "./story.ts";
import { seeded } from "./util.ts";

describe("простые объяснения", () => {
  for (const t of TECHNIQUES) {
    it(`${t.id}: кадры на 500 примерах — коротко, итог с галочкой, акцент по делу`, () => {
      const rng = seeded(42);
      for (let i = 0; i < 500; i++) {
        const task = generate(t.id, ((i % 3) + 1) as 1 | 2 | 3, rng);
        const beats = story(t.id, task.lines, task.plan);
        assert.ok(beats.length >= 4 && beats.length <= 14, `${beats.length} кадров`);
        for (const b of beats) {
          assert.ok(words(b.say) <= MAX_WORDS, `длинно (${words(b.say)}): ${b.say}`);
          const sh = b.show;
          if (b.focus && (sh.kind === "expr" || sh.kind === "done"))
            assert.ok(b.focus.every((k) => k >= 0 && k < sh.tokens.length), JSON.stringify(b));
        }
        const last = beats.at(-1)!;
        assert.equal(last.show.kind, "done");
        assert.ok(last.say.includes(String(task.answer)));
        if (last.show.kind === "done") assert.equal(last.show.tokens.at(-1), "✓");
      }
    });
    it(`${t.id}: есть жизненная рамка и основы`, () => {
      assert.ok(HOOK[t.id] && words(HOOK[t.id]) <= MAX_WORDS);
      assert.ok(NEEDS[t.id].length >= 1);
    });
  }

  for (const [id, f] of Object.entries(FOUNDATIONS)) {
    it(`основа «${f.title}»: короткие кадры и задания`, () => {
      assert.ok(f.beats.every((b) => words(b.say) <= MAX_WORDS));
      const rng = seeded(1);
      for (let i = 0; i < 300; i++) {
        const q = foundationTask(id as FoundationId, rng);
        assert.ok(q.prompt.includes("☐") && Number.isInteger(q.expect) && q.expect > 0, q.prompt);
      }
    });
  }
});
