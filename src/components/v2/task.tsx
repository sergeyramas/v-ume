// Задача с подсказками: ответ набирается прямо на табло, ошибки остаются зачёркнутыми в журнале,
// помощь берётся ступенями — приём, первый шаг, ответ.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { otherWays, type Help, type Plan, type Task, type Technique } from "@/lib/engine/index.ts";
import { tokens } from "@/lib/engine/story.ts";
import { Board, MiniBoard } from "./board";
import { digits, Levels } from "./ui";

export type TaskResult = { correct: boolean; help: Help };

type Entry =
  | { kind: "try"; no: number; value: string; ok: boolean; note: string }
  | { kind: "trick" }
  | { kind: "step"; given?: string }
  | { kind: "answer" };

export const opText = (o: Plan["ops"][number]) => (o.neg ? `${o.a} + ${o.b} = ${o.r} — столько отнимем` : `${o.a} ${o.op} ${o.b} = ${o.r}`);
export const solution = (plan: Plan) => [...(plan.rewrite ? plan.rewrite.split("; ") : []), ...plan.ops.map(opText)];

/** Первый шаг: первое действие решения; если оно уже даёт ответ или это счёт вверх — задание «допиши». */
function firstStep(technique: Technique, task: Task) {
  const o = task.plan.ops[0];
  if (task.plan.mode !== "up" && o.r !== task.answer && !o.neg) {
    const done = `${o.a} ${o.op} ${o.b} = ${o.r}`;
    return { before: `${o.a} ${o.op} ${o.b} =`, after: "", expect: o.r, why: task.plan.rewrite ? `Сначала ${task.plan.rewrite}, потом ${done}.` : `${done}.` };
  }
  const b = technique.blanks(task.lines, task.plan)[0];
  const [before, after = ""] = b.prompt.split("☐");
  return { before: before.trim(), after: after.trim(), expect: b.expect, why: `${b.prompt.replace("☐", String(b.expect))}.` };
}

/** Подсказка после ошибки, которая не выдаёт ответ. */
function slipNote(guess: number, answer: number, technique: Technique) {
  const u = (x: number) => x % 10;
  const t = (x: number) => Math.floor(x / 10) % 10;
  if (u(guess) === u(answer) && t(guess) === t(answer)) return "Единицы и десятки верные — проверь сотни.";
  if (u(guess) === u(answer)) return "Единицы верные — проверь десятки.";
  if (Math.floor(guess / 10) === Math.floor(answer / 10)) return "Десятки сошлись — проверь единицы.";
  return technique.mistake;
}

type Props = {
  task: Task;
  technique: Technique;
  meta: string;
  nextLabel: string;
  onNext: (r: TaskResult) => void;
};

export function TaskCard({ task, technique, meta, nextLabel, onNext }: Props) {
  const expr = tokens(task.lines).join("");
  const slot = Math.max(3, String(task.answer).length);
  const [value, setValue] = useState("");
  const [help, setHelp] = useState<Help>(0);
  const [log, setLog] = useState<Entry[]>([]);
  const [solved, setSolved] = useState(false);
  const [shown, setShown] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const stepIn = useRef<HTMLInputElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const tries = log.filter((e) => e.kind === "try").length;
  const over = solved || shown;
  const step = firstStep(technique, task);
  const stepTaken = log.some((e) => e.kind === "step");
  const stepOpen = log.some((e) => e.kind === "step" && e.given == null);

  useEffect(() => {
    if (window.matchMedia("(hover: hover)").matches) input.current?.focus();
  }, []);
  useEffect(() => {
    if (over) nextBtn.current?.focus();
  }, [over]);
  useEffect(() => {
    if (stepOpen) stepIn.current?.focus();
  }, [stepOpen]);

  const text = `${expr}=${(shown ? String(task.answer) : value).padEnd(slot, " ")}`;
  const lit: [number, number][] = [[expr.length + 1, expr.length + 1 + slot]];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (over) return;
    if (!value) {
      input.current?.focus();
      return;
    }
    const g = Number(value);
    const ok = g === task.answer;
    const note = ok
      ? help === 0
        ? "Зачёт. Сам."
        : help === 1
          ? "Зачёт. Приём сработал."
          : "Верно. Зачёта нет — похожий пример придёт позже."
      : slipNote(g, task.answer, technique);
    setLog((l) => [...l, { kind: "try", no: tries + 1, value, ok, note }]);
    if (ok) setSolved(true);
    else {
      setValue("");
      input.current?.focus();
    }
  };

  const takeTrick = () => {
    setHelp((h) => (Math.max(h, 1) as Help));
    setLog((l) => [...l, { kind: "trick" }]);
    input.current?.focus();
  };
  const takeStep = () => {
    setHelp((h) => (Math.max(h, 2) as Help));
    setLog((l) => (l.some((e) => e.kind === "trick") ? l : [...l, { kind: "trick" as const }]).concat({ kind: "step" }));
  };
  const answerStep = (v: string) => {
    setLog((l) => l.map((e) => (e.kind === "step" ? { ...e, given: v } : e)));
    input.current?.focus();
  };
  const takeAnswer = () => {
    setHelp(3);
    setShown(true);
    setLog((l) => [...l, { kind: "answer" }]);
  };

  const ways = over ? otherWays(task.lines, technique.id) : [];
  const trickTaken = help >= 1;

  return (
    <div className="app">
      <div className="bar">
        <h3>{technique.title}</h3>
        <span className="meta">{meta}</span>
        <Levels help={help} />
      </div>
      <div className="grid2">
        <div className="stage">
          <form onSubmit={submit} autoComplete="off" id="task-form">
            <Board text={text} lit={over ? [] : lit} label={`${expr} = ${value || "?"}`}>
              <input
                ref={input}
                className="catch"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={slot}
                value={value}
                disabled={over}
                onChange={(e) => setValue(digits(e.target.value, slot))}
                aria-label={`Ответ: ${expr.replace(/([+−])/g, " $1 ")} равно`}
              />
            </Board>
          </form>
          <div className="ctrl">
            {!over && (
              <span className="hint">
                <span className="t-mouse">Набери ответ — он встанет на табло</span>
                <span className="t-touch">Нажми на табло и набери ответ</span>
              </span>
            )}
            {over ? (
              <button ref={nextBtn} type="button" className="btn go" onClick={() => onNext({ correct: solved, help })}>
                {nextLabel} <kbd>Enter</kbd>
              </button>
            ) : (
              <button className="btn go" form="task-form">
                Проверить <kbd>Enter</kbd>
              </button>
            )}
          </div>
          {log.length > 0 && (
            <ol className="dep log" aria-live="polite">
              {log.map((e, k) => (
                <LogRow key={k} e={e} technique={technique} task={task} step={step} stepIn={stepIn} onStep={answerStep} />
              ))}
            </ol>
          )}
        </div>
        <aside className="side" aria-label="Подсказки">
          <div className="side-h">
            Подсказки <span>по ступеням</span>
          </div>
          <div className="helps">
            <button type="button" className="help" onClick={takeTrick} disabled={trickTaken || over}>
              <strong>Приём</strong>
              <span className={`stamp ${trickTaken ? "fill" : "off"}`}>{trickTaken ? "взята" : "открыть"}</span>
              <small>{trickTaken ? `${technique.title}: ${task.plan.rewrite ?? technique.idea}` : "Напомню, каким приёмом решать. Зачёт останется."}</small>
            </button>
            <button type="button" className="help" onClick={takeStep} disabled={stepTaken || over}>
              <strong>Первый шаг</strong>
              <span className={`stamp ${stepTaken ? "fill" : "off"}`}>{stepTaken ? "взят" : "открыть"}</span>
              <small>Покажу, с чего начать. Зачёта не будет, похожий пример придёт позже.</small>
            </button>
            <button type="button" className="help" onClick={takeAnswer} disabled={tries === 0 || over}>
              <strong>Ответ</strong>
              <span className={`stamp ${shown ? "fill" : "off"}`}>{shown ? "взят" : "открыть"}</span>
              <small>{tries === 0 && !over ? "Откроется после первой попытки. Без зачёта." : "Покажу решение целиком. Без зачёта."}</small>
            </button>
          </div>
          <p className="rule">Зачёт — если решил сам или только с приёмом.</p>
          {ways.length > 0 && (
            <div className="other">
              <h4>Реши по-другому</h4>
              <ol className="dep">
                {ways.map((w) => (
                  <li key={w.technique.id} className="past">
                    <span className="txt">
                      <strong>{w.technique.title}</strong>
                      <span className="steps">{solution(w.plan).join(" · ")}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function LogRow({
  e,
  technique,
  task,
  step,
  stepIn,
  onStep,
}: {
  e: Entry;
  technique: Technique;
  task: Task;
  step: ReturnType<typeof firstStep>;
  stepIn: React.RefObject<HTMLInputElement | null>;
  onStep: (v: string) => void;
}) {
  const row = (what: string, val: ReactNode, stamp?: ReactNode) => (
    <li className="past">
      <span className="what">{what}</span>
      <span className="val">{val}</span>
      {stamp}
    </li>
  );
  if (e.kind === "try")
    return row(
      `Попытка ${e.no}`,
      <span className="pair">
        <MiniBoard text={e.value} struck={!e.ok} />
        <span className="why">{e.note}</span>
      </span>,
      <span className={`stamp${e.ok ? " fill" : ""}`}>{e.ok ? "верно" : "мимо"}</span>,
    );
  if (e.kind === "trick")
    return row(
      "Подсказка",
      <>
        Приём: {technique.title}
        <span className="why">{technique.idea}</span>
      </>,
      <span className="stamp fill">взята</span>,
    );
  if (e.kind === "answer")
    return row(
      "Ответ",
      <span className="sol">
        {solution(task.plan).map((s) => (
          <span key={s} className="nw" style={{ display: "block" }}>
            {s}
          </span>
        ))}
      </span>,
      <span className="stamp">без зачёта</span>,
    );
  const ok = e.given != null && Number(e.given) === step.expect;
  return row(
    "Шаг",
    <span className="pair">
      {step.before}
      {e.given == null ? (
        <StepInput inputRef={stepIn} label={`${step.before} ? ${step.after}`} onDone={onStep} />
      ) : (
        <MiniBoard text={e.given} struck={!ok} />
      )}
      {step.after}
      {e.given != null && !ok && <MiniBoard text={String(step.expect)} />}
      {e.given != null && !ok && <span className="why">{step.why}</span>}
    </span>,
    e.given != null ? <span className={`stamp${ok ? " fill" : ""}`}>{ok ? "верно" : "мимо"}</span> : undefined,
  );
}

function StepInput({ inputRef, label, onDone }: { inputRef: React.RefObject<HTMLInputElement | null>; label: string; onDone: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <>
      <input
        ref={inputRef}
        className="mini"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={5}
        value={v}
        aria-label={label}
        onChange={(e) => setV(digits(e.target.value))}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (v) onDone(v);
        }}
      />
      <button type="button" className="btn quiet sm" onClick={() => v && onDone(v)}>
        Готово
      </button>
    </>
  );
}
