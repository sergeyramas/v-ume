// Урок приёма: основы (если не пройдены) → разбор кадрами → «почему так» → второй разбор → «допиши» → шесть задач → итог.
// Задачи случайные, поэтому урок рисуется только на клиенте, после гидрации стора.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { byId, generate, usable, type Blank, type Line, type Task, type Technique, type TechniqueId, type Tier } from "@/lib/engine/index.ts";
import { credited, skipGuided, stars, TWIN_GAP } from "@/lib/engine/review.ts";
import { FOUNDATIONS, foundationTask, NEEDS, tokens, type FoundationId } from "@/lib/engine/story.ts";
import { fmtLines } from "@/lib/engine/util.ts";
import { foundationFrames, frames } from "@/lib/v2/frames";
import { useHydrated, useStore, type Twin } from "@/lib/v2/store";
import { Board, MiniBoard } from "@/components/v2/board";
import { Player } from "@/components/v2/player";
import { TaskCard, type TaskResult } from "@/components/v2/task";
import { digits, HELP_LABEL, pad2, Top } from "@/components/v2/ui";

export const Route = createFileRoute("/t/$id")({ component: LessonPage });

type Step =
  | { kind: "foundShow"; fid: FoundationId }
  | { kind: "foundTask"; fid: FoundationId; q: Blank; n: number }
  | { kind: "show"; ex: 0 | 1 }
  | { kind: "why" }
  | { kind: "blank"; b: Blank; n: number }
  | { kind: "tasks" }
  | { kind: "sum" };

const PHASES = [
  { key: "found", label: "Основа" },
  { key: "show", label: "Разбор" },
  { key: "why", label: "Почему" },
  { key: "blank", label: "Допиши" },
  { key: "tasks", label: "Задачи" },
  { key: "sum", label: "Итог" },
] as const;
const phaseOf = (s: Step) => (s.kind.startsWith("found") ? "found" : s.kind);

function LessonPage() {
  const { id } = Route.useParams();
  const ok = useHydrated();
  const t = (byId as Record<string, Technique | undefined>)[id];
  const [round, setRound] = useState(0);

  if (!t)
    return (
      <Shell>
        <div className="app">
          <div className="hero">
            <p>Такого приёма нет.</p>
            <div>
              <Link to="/" className="btn go">
                На путь
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="page-head">
        <h1>{t.title}</h1>
        <p>{t.idea}</p>
      </div>
      {ok ? (
        <Lesson key={`${id}:${round}`} t={t} onAgain={() => setRound((r) => r + 1)} />
      ) : (
        <div className="app" aria-busy="true">
          <div className="hero">
            <p>Готовлю урок…</p>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <Top
        end={
          <Link to="/" className="meta">
            ← Путь
          </Link>
        }
      />
      <main className="wrap">{children}</main>
    </>
  );
}

const TIERS: Record<"9-11" | "12-15", Tier[]> = { "9-11": [1, 1, 1, 2, 2, 2], "12-15": [1, 2, 2, 2, 3, 3] };

type Slot = { task: Task; twin: boolean };
type Done = Slot & TaskResult;

function Lesson({ t, onAgain }: { t: Technique; onAgain: () => void }) {
  const store = useStore.getState();
  const id = t.id as TechniqueId;

  // план урока собирается один раз на входе
  const init = useMemo(() => {
    const need = NEEDS[id].filter((f) => !store.foundations[f]);
    const guided = !skipGuided(store.recent[id] ?? []);
    const steps: Step[] = [];
    for (const fid of need) {
      steps.push({ kind: "foundShow", fid });
      steps.push({ kind: "foundTask", fid, q: foundationTask(fid, Math.random), n: 1 });
      steps.push({ kind: "foundTask", fid, q: foundationTask(fid, Math.random), n: 2 });
    }
    if (guided) {
      steps.push({ kind: "show", ex: 0 }, { kind: "why" }, { kind: "show", ex: 1 });
      for (let n = 1; n <= 2; n++) {
        const g = generate(id, 1);
        steps.push({ kind: "blank", b: t.blanks(g.lines, g.plan)[0], n });
      }
    }
    steps.push({ kind: "tasks" }, { kind: "sum" });
    const bump = store.techniques[id]?.mastered ? 1 : 0;
    const queue: Slot[] = TIERS[store.age].map((tier) => ({ task: generate(id, Math.min(3, tier + bump) as Tier), twin: false }));
    return { steps, queue, guided };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [steps, setSteps] = useState(init.steps);
  const [at, setAt] = useState(0);
  const [queue, setQueue] = useState(init.queue);
  const [qi, setQi] = useState(0);
  const [results, setResults] = useState<Done[]>([]);
  const leftovers = useRef<Twin[]>([]);
  const step = steps[at];
  const next = () => setAt((a) => Math.min(steps.length - 1, a + 1));

  const replay = () => {
    // «Посмотреть разбор» — вставить разбор перед задачами
    setSteps((s) => [...s.slice(0, at), { kind: "show", ex: 0 }, { kind: "why" }, { kind: "show", ex: 1 }, ...s.slice(at)]);
  };

  const onTask = (r: TaskResult) => {
    const slot = queue[qi];
    useStore.getState().answer(id, slot.task.tier, r.correct, r.help);
    const all = [...results, { ...slot, ...r }];
    setResults(all);
    let q = queue;
    if (!credited(r.correct, r.help) && !slot.twin) {
      const twin = { task: generate(id, slot.task.tier), twin: true };
      const pos = qi + 1 + TWIN_GAP;
      if (pos <= queue.length) q = [...queue.slice(0, pos), twin, ...queue.slice(pos)];
      else leftovers.current.push({ technique: id, tier: slot.task.tier });
      setQueue(q);
    }
    if (qi + 1 < q.length) setQi(qi + 1);
    else {
      const main = all.filter((x) => !x.twin);
      useStore.getState().finishLesson(
        id,
        { credited: main.filter((x) => credited(x.correct, x.help)).length, total: main.length, shown: main.filter((x) => x.help === 3).length },
        leftovers.current,
      );
      next();
    }
  };

  const cur = phaseOf(step);
  const present = new Set(steps.map(phaseOf));
  const order = PHASES.filter((p) => present.has(p.key));
  const curIdx = order.findIndex((p) => p.key === cur);

  return (
    <>
      <ol className="phases" aria-label="Этапы урока">
        {order.map((p, i) => (
          <li key={p.key}>
            <span className={`stamp ${i < curIdx ? "fill" : i === curIdx ? "now" : "off"}`} aria-current={i === curIdx ? "step" : undefined}>
              {p.label}
            </span>
          </li>
        ))}
      </ol>
      {step.kind === "foundShow" && (
        <Player
          key={`f-${step.fid}`}
          title={`Основа: ${FOUNDATIONS[step.fid].title}`}
          frames={foundationFrames(step.fid)}
          doneLabel="К заданию"
          onDone={next}
        />
      )}
      {step.kind === "foundTask" && (
        <BlankCard
          key={`ft-${step.fid}-${step.n}`}
          title={`Основа: ${FOUNDATIONS[step.fid].title}`}
          meta={`Задание ${step.n} из 2`}
          b={step.q}
          onDone={() => {
            if (step.n === 2) useStore.getState().passFoundation(step.fid);
            next();
          }}
        />
      )}
      {step.kind === "show" && <Example key={`s-${at}`} t={t} ex={step.ex} onDone={next} />}
      {step.kind === "why" && <Why key={`w-${at}`} t={t} onDone={next} />}
      {step.kind === "blank" && (
        <BlankCard key={`b-${step.n}`} title="Допиши шаг" meta={`Задание ${step.n} из 2`} b={step.b} onDone={next} />
      )}
      {step.kind === "tasks" && (
        <>
          {!init.guided && qi === 0 && results.length === 0 && (
            <div className="app note-app">
              <p className="note">
                Два последних ответа засчитаны — разбор пропускаем.
                <button type="button" className="btn quiet sm" onClick={replay}>
                  Посмотреть разбор
                </button>
              </p>
            </div>
          )}
          <TaskCard
            key={qi}
            task={queue[qi].task}
            technique={t}
            meta={`Задача ${Math.min(qi + 1, queue.length)} из ${queue.length}${queue[qi].twin ? " · похожая" : ""}`}
            nextLabel={qi + 1 < queue.length ? "Следующая" : "К итогу"}
            onNext={onTask}
          />
        </>
      )}
      {step.kind === "sum" && <Summary t={t} results={results} onAgain={onAgain} />}
    </>
  );
}

function Example({ t, ex, onDone }: { t: Technique; ex: 0 | 1; onDone: () => void }) {
  const lines: Line[] = t.examples[ex];
  const fs = useMemo(() => frames(t.id, lines, usable(t, lines) ?? t.solve(lines)!), [t, lines]);
  return (
    <Player
      title={`Разбор · пример ${ex + 1}`}
      meta={fmtLines(lines)}
      caption={fmtLines(lines)}
      frames={fs}
      doneLabel={ex === 0 ? "К вопросу" : "К заданиям"}
      onDone={onDone}
    />
  );
}

function Why({ t, onDone }: { t: Technique; onDone: () => void }) {
  const [wrong, setWrong] = useState<number[]>([]);
  const [right, setRight] = useState(false);
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (right) next.current?.focus();
  }, [right]);
  return (
    <div className="app">
      <div className="bar">
        <h3>Почему так</h3>
        <span className="meta">Один вопрос</span>
      </div>
      <div className="stage">
        <p className="say">{t.why.q}</p>
        <div className="choices" role="group" aria-label="Варианты ответа">
          {t.why.options.map((o, i) => {
            const isRight = right && i === t.why.correct;
            const isWrong = wrong.includes(i);
            return (
              <button
                key={i}
                type="button"
                className={`choice${isRight ? " right" : ""}${isWrong ? " wrong" : ""}`}
                disabled={right || isWrong}
                onClick={() => (i === t.why.correct ? setRight(true) : setWrong((w) => [...w, i]))}
              >
                <span>{o}</span>
                {isRight && <span className="stamp fill">верно</span>}
                {isWrong && <span className="stamp off">мимо</span>}
              </button>
            );
          })}
        </div>
        <p className="result" aria-live="polite">
          {right ? "Точно. Дальше — второй пример." : wrong.length ? "Не то. Посмотри ещё раз на первый пример." : ""}
        </p>
        <div className="ctrl">
          <button ref={next} type="button" className="btn go" disabled={!right} onClick={onDone}>
            Дальше <kbd>Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Одно пропущенное число: «19 + 11 = 20 + 11 − ☐». */
function BlankCard({ title, meta, b, onDone }: { title: string; meta: string; b: Blank; onDone: () => void }) {
  const [v, setV] = useState("");
  const [given, setGiven] = useState<string | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (given != null) btn.current?.focus();
  }, [given]);
  const [before, after = ""] = b.prompt.split("☐");
  const ok = given != null && Number(given) === b.expect;
  const max = Math.max(3, String(b.expect).length + 1);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (given != null) return onDone();
    if (v) setGiven(v);
  };
  return (
    <div className="app">
      <div className="bar">
        <h3>{title}</h3>
        <span className="meta">{meta}</span>
      </div>
      <form className="stage" onSubmit={submit} autoComplete="off">
        <div className="blank-q">
          <span>{before.trim()}</span>
          {given == null ? (
            <input
              className="mini"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={max}
              value={v}
              autoFocus
              aria-label={b.prompt.replace("☐", "пропуск")}
              onChange={(e) => setV(digits(e.target.value, max))}
            />
          ) : (
            <MiniBoard text={given} struck={!ok} />
          )}
          {after.trim() && <span>{after.trim()}</span>}
        </div>
        <p className="result" aria-live="polite">
          {given == null ? "" : ok ? "Верно." : `Здесь ${b.expect}: ${b.prompt.replace("☐", String(b.expect))}.`}
        </p>
        <div className="ctrl">
          <button ref={btn} className="btn go" disabled={given == null && !v}>
            {given == null ? "Проверить" : "Дальше"} <kbd>Enter</kbd>
          </button>
        </div>
      </form>
    </div>
  );
}

function Summary({ t, results, onAgain }: { t: Technique; results: Done[]; onAgain: () => void }) {
  const main = results.filter((r) => !r.twin);
  const got = main.filter((r) => credited(r.correct, r.help)).length;
  const s = stars(got);
  const tech = useStore((st) => st.techniques[t.id]);
  const line =
    s === 3
      ? "Все шесть сам. Чистый урок."
      : s > 0
        ? "Хороший урок. Где брал шаг или ответ — похожие примеры придут позже."
        : "Приём пока не встал. Пройди урок ещё раз — разбор поможет.";
  return (
    <div className="app">
      <div className="bar">
        <h3>Итог урока</h3>
        <span className="meta">Зачёт — сам или только с приёмом</span>
        {tech?.mastered && (
          <div className="end">
            <span className="stamp fill">приём освоен</span>
          </div>
        )}
      </div>
      <div className="stage">
        <Board text={`${got} ИЗ ${main.length}`} n={6} max={88} label={`Засчитано ${got} из ${main.length}`} lit={[[0, String(got).length]]} />
        <p className="say">
          <span className="big-stars" aria-label={`Звёзд: ${s} из 3`}>
            {[0, 1, 2].map((i) => (
              <span key={i} aria-hidden="true" style={{ color: i < s ? "var(--ink)" : "var(--line)" }}>
                ★
              </span>
            ))}
          </span>
          {line}
        </p>
        <div className="ctrl">
          <Link to="/" className="btn">
            На путь
          </Link>
          <button type="button" className="btn go" onClick={onAgain}>
            Ещё урок
          </button>
        </div>
      </div>
      <div className="sec-h">
        Задачи <span>как решал</span>
      </div>
      <ol className="dep sum-rows">
        {results.map((r, i) => (
          <li key={i} className="past">
            <span className="no">{pad2(i + 1)}</span>
            <span className="val">
              <span className="nw">
                {tokens(r.task.lines).join(" ")} = {r.task.answer}
              </span>
              {r.twin && <small className="meta">похожая</small>}
            </span>
            <span className={`stamp${credited(r.correct, r.help) ? " fill" : r.correct ? "" : " off"}`}>
              {HELP_LABEL[r.help]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
