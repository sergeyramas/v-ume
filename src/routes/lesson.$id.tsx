import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Delete } from "lucide-react";
import { Slab } from "@/components/slab";
import { VisualExplainer } from "@/components/visual-explainer";
import { playCue, unlockAudio } from "@/lib/audio";
import { explain, buildVisualExplanation } from "@/lib/explain";
import {
  LESSONS,
  ROUND,
  getLesson,
  lessonNo,
  listLabel,
  passNeed,
  secondsFor,
  starsFor,
  type Lesson,
  type Problem,
} from "@/lib/lessons";
import { fmt } from "@/lib/ru";
import { useProgress, type Difficulty, type SlipMiss } from "@/lib/store";

export const Route = createFileRoute("/lesson/$id")({ component: LessonScreen });

type Phase = "intro" | "play" | "ok" | "drop" | "reveal" | "done";

type Run = {
  problems: Problem[];
  index: number;
  correct: number;
  timeouts: number;
  streak: number;
  bestStreak: number;
  misses: SlipMiss[];
  input: string;
  note: string;
  phase: Phase;
  fell: boolean;
  difficulty: Difficulty;
  limit: number;
  left: number;
  shake: boolean;
};

function LessonScreen() {
  const { id } = Route.useParams();
  const lesson = getLesson(id);
  const [attempt, setAttempt] = useState(0);
  if (!lesson) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-4xl">Такого урока нет</h1>
        <Link to="/" className="mt-4 inline-block font-semibold text-sage">
          К пути
        </Link>
      </main>
    );
  }
  return <Drill key={`${lesson.id}-${attempt}`} lesson={lesson} onRetry={() => setAttempt((n) => n + 1)} />;
}

function Drill({ lesson, onRetry }: { lesson: Lesson; onRetry: () => void }) {
  const voice = useProgress((s) => s.voice);
  const record = useProgress((s) => s.record);
  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  const lock = useRef(false);
  const saved = useRef(false);
  const later = useRef<number | null>(null);

  function commit(next: Run | null) {
    runRef.current = next;
    setRun(next);
  }

  useEffect(() => {
    let cancel = false;
    const start = () => {
      if (cancel) return;
      const difficulty = useProgress.getState().difficulty;
      const problems = Array.from({ length: ROUND }, () => lesson.make(difficulty));
      const sec = secondsFor(difficulty, problems[0]?.lines.length ?? 2, 0);
      commit({
        problems,
        index: 0,
        correct: 0,
        timeouts: 0,
        streak: 0,
        bestStreak: 0,
        misses: [],
        input: "",
        note: "",
        phase: "intro",
        fell: false,
        difficulty,
        limit: sec,
        left: sec,
        shake: false,
      });
    };
    const un = useProgress.persist.onFinishHydration(start);
    if (useProgress.persist.hasHydrated()) start();
    return () => {
      cancel = true;
      un();
      if (later.current) window.clearTimeout(later.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [lesson]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  function silence() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function arm(index: number, streak: number, prev: Run): Run {
    const sec = secondsFor(prev.difficulty, prev.problems[index]?.lines.length ?? 2, streak);
    lock.current = false;
    return {
      ...prev,
      index,
      streak,
      input: "",
      note: "",
      phase: "play",
      fell: false,
      limit: sec,
      left: sec,
      shake: false,
    };
  }

  function advance(ok: boolean, timedOut: boolean) {
    const prev = runRef.current;
    if (!prev) return;
    const problem = prev.problems[prev.index];
    if (!problem) return;
    const miss: SlipMiss | null = ok
      ? null
      : {
          lessonId: lesson.id,
          list: listLabel(problem.lines),
          given: timedOut ? "" : prev.input.trim(),
          answer: problem.answer,
          timedOut,
          steps: problem.steps,
          at: Date.now() + prev.index,
        };
    const correct = prev.correct + (ok ? 1 : 0);
    const streak = ok ? prev.streak + 1 : 0;
    const misses = miss ? [...prev.misses, miss] : prev.misses;
    const timeouts = prev.timeouts + (timedOut ? 1 : 0);
    const bestStreak = Math.max(prev.bestStreak, streak);
    const index = prev.index + 1;
    if (index >= prev.problems.length) {
      const stars = starsFor(correct, prev.difficulty);
      if (!saved.current) {
        saved.current = true;
        record({
          lessonId: lesson.id,
          correct,
          total: ROUND,
          passed: stars > 0,
          stars,
          misses,
        });
      }
      commit({
        ...prev,
        correct,
        streak,
        bestStreak,
        misses,
        timeouts,
        index,
        phase: "done",
        shake: false,
        fell: timedOut,
      });
      return;
    }
    commit(
      arm(index, streak, {
        ...prev,
        correct,
        bestStreak,
        misses,
        timeouts,
      }),
    );
  }

  function submit() {
    const prev = runRef.current;
    if (!prev || prev.phase !== "play" || lock.current) return;
    const problem = prev.problems[prev.index];
    if (!problem || prev.input.trim() === "") return;
    lock.current = true;
    silence();
    const ok = Number(prev.input.trim()) === problem.answer;
    playCue(ok ? "ok" : "bad", useProgress.getState().sound);
    if (ok) {
      commit({ ...prev, phase: "ok", shake: false });
      later.current = window.setTimeout(() => advance(true, false), 420);
      return;
    }
    commit({ ...prev, phase: "reveal", fell: false, shake: true });
    later.current = window.setTimeout(() => advance(false, false), 1700);
  }

  function timeout() {
    const prev = runRef.current;
    if (!prev || prev.phase !== "play" || lock.current) return;
    lock.current = true;
    silence();
    playCue("drop", useProgress.getState().sound);
    commit({ ...prev, phase: "drop", fell: true, shake: true, left: 0 });
    later.current = window.setTimeout(() => {
      const mid = runRef.current;
      if (!mid) return;
      commit({ ...mid, phase: "reveal", fell: true, shake: false });
      later.current = window.setTimeout(() => advance(false, true), 1500);
    }, 640);
  }

  useEffect(() => {
    if (!run || run.phase !== "play") return;
    lock.current = false;
    const limitMs = run.limit * 1000;
    const t0 = performance.now();
    let fired = false;
    const id = window.setInterval(() => {
      const remain = Math.max(0, limitMs - (performance.now() - t0));
      if (remain <= 0) {
        if (!fired) {
          fired = true;
          window.clearInterval(id);
          timeout();
        }
        return;
      }
      setRun((prev) => {
        if (!prev || prev.phase !== "play") return prev;
        if (Math.abs(prev.left - remain / 1000) < 0.05) return prev;
        return { ...prev, left: remain / 1000 };
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [run?.phase, run?.index, run?.limit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const live = runRef.current;
      if (!live || live.phase !== "play") return;
      const target = event.target as HTMLElement | null;
      if (target?.dataset.note === "1") return;
      if (event.key >= "0" && event.key <= "9") {
        event.preventDefault();
        commit({ ...live, input: (live.input + event.key).slice(0, 6) });
      } else if (event.key === "Backspace") {
        event.preventDefault();
        commit({ ...live, input: live.input.slice(0, -1) });
      } else if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!run || run.phase !== "play" || !voice) return;
    const problem = run.problems[run.index];
    if (!problem || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(problem.speech);
    utter.lang = "ru-RU";
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
    return () => window.speechSynthesis.cancel();
  }, [voice, run?.phase, run?.index]);

  if (!run) {
    return <main className="mx-auto max-w-lg px-4 py-10 text-muted">Собираем накладную…</main>;
  }

  const problem = run.problems[run.index] ?? null;
  const danger = run.phase === "play" ? 1 - run.left / Math.max(run.limit, 0.1) : run.fell ? 1 : 0;
  const mode = run.phase === "drop" || (run.phase === "reveal" && run.fell) ? "drop" : run.phase === "ok" ? "safe" : "hang";
  const exampleSteps = explain(lesson.kind, lesson.example);
  const nextLesson = LESSONS[lessonNo(lesson.id)] ?? null;
  const stars = starsFor(run.correct, run.difficulty);
  const passed = stars > 0;
  const playing = run.phase === "play" || run.phase === "ok" || run.phase === "drop" || run.phase === "reveal";

  return (
    <main className={`mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-4 ${run.shake ? "shake" : ""}`}>
      <header className="flex items-center justify-between gap-3">
        <Link to="/" className="flex size-11 items-center justify-center rounded-full border border-line" aria-label="К пути">
          <ChevronLeft />
        </Link>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Урок {lessonNo(lesson.id)}</p>
          <h1 className="font-display text-2xl leading-tight">{lesson.title}</h1>
        </div>
        <p className="min-w-14 text-right text-sm tabular-nums text-muted">
          {run.phase === "done" ? ROUND : run.index + 1}/{ROUND}
        </p>
      </header>

      {run.phase === "intro" ? (
        <section className="mt-5">
          <p className="text-pretty text-muted">{lesson.about}</p>
          <VisualExplainer
            explanation={buildVisualExplanation(lesson.example, lesson.kind)}
            variant="intro"
          />
          <div className="mt-4">
            <Slip lines={lesson.example} mark={lesson.mark} />
          </div>
          <button
            type="button"
            className="mt-6 h-14 w-full rounded-2xl bg-sage font-semibold text-paper"
            onClick={() => {
              unlockAudio();
              commit(arm(0, 0, run));
            }}
          >
            К спискам
          </button>
          <p className="mt-3 text-sm text-muted">
            Плита висит над ящиком. Долго складываешь — трос не держит, плита падает. Три верных подряд
            дают ещё несколько секунд. Зачёт: {passNeed(run.difficulty)} из {ROUND}. Пометка на полях не
            проверяется, это твоя черта в тетради.
          </p>
        </section>
      ) : null}

      {playing && problem ? (
        <section className="mt-4">
          <Slab danger={danger} mode={mode} left={run.left} streak={run.streak} />
          <p className="mt-3 text-sm text-muted">{lesson.remind}</p>
          <Slip lines={problem.lines} mark={lesson.mark} />

          {/* Подсказка как упростить: на уроках 1-4 открыта сразу, на старших свернута */}
          {run.phase === "play" && problem.visual ? (
            <VisualExplainer
              key={`hint-${run.index}`}
              explanation={problem.visual}
              variant="hint"
              initialOpen={lessonNo(lesson.id) <= 4}
            />
          ) : null}

          <label className="mt-3 block text-xs uppercase tracking-wide text-muted">
            Пометка
            <input
              data-note="1"
              value={run.note}
              onChange={(event) => {
                const live = runRef.current;
                if (!live) return;
                commit({ ...live, note: event.target.value.slice(0, 8) });
              }}
              inputMode="numeric"
              className="mt-1 h-12 w-full rounded-xl border border-line bg-transparent px-3 font-display text-xl"
              placeholder="промежуточная сумма"
            />
          </label>
          <p className="mt-4 text-center font-display text-5xl tabular-nums">{run.input || "·"}</p>
          {run.phase === "reveal" ? (
            <div className="mt-3">
              <div className="rounded-2xl bg-clay-soft px-3 py-2 text-sm font-semibold text-clay">
                {run.fell ? "Плита закрыла ящик. " : ""}Нужно {fmt(problem.answer)}
              </div>
              {problem.visual ? (
                <VisualExplainer explanation={problem.visual} variant="reveal" />
              ) : (
                <div className="mt-2 rounded-2xl bg-clay-soft px-3 py-3 text-sm">
                  <ul className="space-y-1">
                    {problem.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
              <button
                key={key}
                type="button"
                className="key"
                disabled={run.phase !== "play"}
                onClick={() => {
                  unlockAudio();
                  const live = runRef.current;
                  if (!live || live.phase !== "play") return;
                  commit({ ...live, input: (live.input + key).slice(0, 6) });
                }}
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              className="key"
              disabled={run.phase !== "play"}
              onClick={() => {
                const live = runRef.current;
                if (!live) return;
                commit({ ...live, input: "" });
              }}
            >
              C
            </button>
            <button
              type="button"
              className="key"
              disabled={run.phase !== "play"}
              onClick={() => {
                unlockAudio();
                const live = runRef.current;
                if (!live || live.phase !== "play") return;
                commit({ ...live, input: `${live.input}0`.slice(0, 6) });
              }}
            >
              0
            </button>
            <button
              type="button"
              className="key"
              disabled={run.phase !== "play"}
              aria-label="Стереть цифру"
              onClick={() => {
                const live = runRef.current;
                if (!live) return;
                commit({ ...live, input: live.input.slice(0, -1) });
              }}
            >
              <Delete className="mx-auto size-5" />
            </button>
          </div>
          <button
            type="button"
            className="mt-2 h-14 w-full rounded-2xl bg-sage font-semibold text-paper disabled:opacity-40"
            disabled={run.phase !== "play" || run.input.trim() === ""}
            onClick={() => {
              unlockAudio();
              submit();
            }}
          >
            Итого
          </button>
        </section>
      ) : null}

      {run.phase === "done" ? (
        <section className="mt-6">
          <p className="text-sm uppercase tracking-wide text-muted">{passed ? "Зачёт" : "Ещё разок"}</p>
          <h2 className="font-display text-5xl tabular-nums">
            {run.correct} из {ROUND}
          </h2>
          <p className="mt-2 text-muted">
            Ошибки {ROUND - run.correct}
            {run.timeouts ? `, плита падала ${run.timeouts}` : ""}. Лучшая серия {run.bestStreak}.
          </p>
          <p className="mt-2 text-gold">{stars > 0 ? `${stars} из 3 звёзд` : "Звёзд нет — слишком много промахов"}</p>
          {run.misses.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {run.misses.map((miss) => (
                <li key={`${miss.at}-${miss.list}`} className="rounded-2xl border border-line px-3 py-3 text-sm">
                  <p className="font-semibold tabular-nums">{miss.list}</p>
                  <p>
                    {miss.timedOut ? "Не успел. " : `Было ${miss.given || "—"}. `}
                    Нужно {fmt(miss.answer)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4">Чистый лист. Так и держат ящик.</p>
          )}
          <div className="mt-6 grid gap-2">
            <button type="button" className="h-14 rounded-2xl bg-sage font-semibold text-paper" onClick={onRetry}>
              Ещё эту накладную
            </button>
            {passed && nextLesson ? (
              <Link
                to="/lesson/$id"
                params={{ id: nextLesson.id }}
                className="flex h-14 items-center justify-center rounded-2xl border border-line font-semibold"
              >
                Дальше: {nextLesson.title}
              </Link>
            ) : (
              <Link to="/" className="flex h-14 items-center justify-center rounded-2xl border border-line font-semibold">
                К пути
              </Link>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Slip({ lines, mark }: { lines: { n: number; sign: 1 | -1 }[]; mark: boolean }) {
  const cut = Math.floor(lines.length / 2) - 1;
  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">Накладная</p>
      <ul className="mt-2">
        {lines.map((line, index) => (
          <li key={`${line.sign}-${line.n}-${index}`}>
            <p className="flex items-baseline justify-between font-display text-3xl tabular-nums">
              <span>{line.sign < 0 ? "−" : ""}{fmt(line.n)}</span>
              {line.sign < 0 ? <span className="font-sans text-xs uppercase tracking-wide text-clay">возврат</span> : null}
            </p>
            {mark && index === cut ? (
              <p className="my-1 flex items-center gap-2 text-xs text-gold">
                <span className="h-px flex-1 bg-gold" />
                черта
                <span className="h-px flex-1 bg-gold" />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
