// «Поток»: числа по одному на табло, сумма — в уме. Полоска под табло — сколько ещё стоит число.
// Каждый третий подход посередине спрашивает «Сколько сейчас?», чтобы найти, где сбился.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  checkpointAt,
  firstSlip,
  flowNumbers,
  hasCheckpoint,
  HUNDREDS_UNLOCK,
  LADDER,
  nextStep,
  runningSums,
  showMs,
  startSession,
  type Branch,
  type FlowStep,
  type Session,
} from "@/lib/engine/flow.ts";
import { Board, CHECK, reducedMotion } from "@/components/v2/board";
import { digits, pad2, plural, Top } from "@/components/v2/ui";
import { bestStep, useHydrated, useStore } from "@/lib/v2/store";

export const Route = createFileRoute("/flow")({ component: FlowPage });

const TRACK_MS = 4000;
const NB = " ";
const sec = (ms: number) => `${(ms / 1000).toLocaleString("ru")}${NB}с`;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DIG = ["", "однозначные", "двузначные", "трёхзначные"];
const minusText = (m: FlowStep["minus"]) => (m === "any" ? ", минусы" : m ? ", 2 минуса" : "");
const fmtN = (n: number) => (n < 0 ? `−${-n}` : String(n));

function FlowPage() {
  const ok = useHydrated();
  return (
    <>
      <Top />
      <main className="wrap">
        <div className="page-head">
          <h1>Поток</h1>
          <p>Числа идут по одному, сумму держишь в уме. Длина полоски — сколько стоит число. На каждом третьем подходе посередине спрошу: «Сколько сейчас?»</p>
        </div>
        {ok ? (
          <Flow />
        ) : (
          <div className="app" aria-busy="true">
            <div className="hero">
              <p>Готовлю табло…</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

type Phase = "idle" | "run" | "ask" | "done";

function Flow() {
  const flow = useStore((s) => s.flow);
  const age = useStore((s) => s.age);
  const slower = useStore((s) => s.slower);
  const setSlower = useStore((s) => s.setSlower);
  const unlocked = bestStep(flow.best, "tens") >= HUNDREDS_UNLOCK;

  const [branch, setBranch] = useState<Branch>("tens");
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState("");
  const [pos, setPos] = useState("Готов?");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [res, setRes] = useState("");
  const [sums, setSums] = useState<{ list: number[]; bad?: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [sessStep, setSessStep] = useState<number | null>(null);

  const run = useRef(0);
  const sess = useRef<Session | null>(null);
  const replay = useRef<number[] | null>(null);
  const askRes = useRef<((n: number) => void) | null>(null);
  const barEl = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("idle");
  const startBtn = useRef<HTMLButtonElement>(null);
  const askIn = useRef<HTMLInputElement>(null);
  phaseRef.current = phase;

  const step = sessStep ?? flow.step[branch];
  const L = LADDER[branch][step - 1];
  const ms = showMs(L, slower);
  const best = bestStep(flow.best, branch);

  const bar = (f: number) => {
    const b = barEl.current;
    if (!b) return;
    b.getAnimations().forEach((a) => a.cancel());
    b.style.transform = `scaleX(${f})`;
  };
  const drain = (d: number) => {
    const b = barEl.current;
    if (!b || reducedMotion() || typeof b.animate !== "function") {
      bar(1);
      return wait(d);
    }
    b.getAnimations().forEach((a) => a.cancel());
    b.style.transform = "";
    return b
      .animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: d, easing: "linear", fill: "forwards" })
      .finished.then(
        () => {},
        () => {},
      );
  };
  const ask = (q: string) =>
    new Promise<number>((resolve) => {
      setQuestion(q);
      setAnswer("");
      setPhase("ask");
      askRes.current = resolve;
    });

  useEffect(() => {
    if (phase === "ask") askIn.current?.focus();
    if (phase === "done" || (phase === "idle" && paused)) startBtn.current?.focus();
  }, [phase, paused]);

  // скрыл вкладку посреди показа — подход останавливается, при возврате пойдут те же числа
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden || phaseRef.current !== "run") return;
      run.current++;
      bar(0);
      setShown("");
      setPos("Пауза");
      setPaused(true);
      setPhase("idle");
      setRes("Вкладка была скрыта — подход остановлен. Нажми, и пойдут те же числа.");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      run.current++;
    };
  }, []);

  const start = async () => {
    const id = ++run.current;
    const alive = () => id === run.current;
    const s = sess.current?.branch === branch ? sess.current : startSession(branch, flow.step[branch]);
    sess.current = s;
    setSessStep(s.step);
    const st = LADDER[branch][s.step - 1];
    const ns = replay.current ?? flowNumbers(branch, s.step, Math.random);
    replay.current = ns;
    const all = runningSums(ns);
    const d = showMs(st, useStore.getState().slower);
    const cp = hasCheckpoint(s.tasks + 1, st.count) ? checkpointAt(st.count) : null;
    let cpSaid: number | null = null;
    setPaused(false);
    setRes("");
    setSums(null);
    setPhase("run");

    for (let i = 0; i < ns.length; i++) {
      setShown("");
      await wait(240);
      if (!alive()) return;
      setPos(`Число ${i + 1} из ${ns.length}`);
      setShown(fmtN(ns[i]));
      await drain(d);
      if (!alive()) return;
      if (i === cp) {
        setShown("");
        bar(0);
        cpSaid = await ask("Сколько сейчас?");
        if (!alive()) return;
        setPhase("run");
        setRes(cpSaid === all[i] ? `Да, ${all[i]}. Держи и дальше.` : `Сейчас ${all[i]}. Продолжай от этого числа.`);
        await wait(1400);
        if (!alive()) return;
        setRes("");
      }
    }
    setShown("");
    bar(0);
    setPos(`Все ${ns.length} ${plural(ns.length, ["число", "числа", "чисел"])}`);
    const said = await ask("Сколько всего?");
    if (!alive()) return;
    replay.current = null;

    const tot = all.at(-1)!;
    const ok = said === tot;
    const nxt = nextStep(s, ok, useStore.getState().age);
    sess.current = nxt;
    useStore.getState().flowResult(branch, s.step, ok, nxt.step);
    const top = LADDER[branch].length;
    const need = useStore.getState().age === "9-11" ? 3 : 2;
    let msg: string;
    if (ok) {
      msg = `Верно: ${tot}.`;
      if (nxt.step > s.step) msg += ` Ступень вверх — ${nxt.step}.`;
      else if (s.step >= Math.min(top, nxt.startStep + 2)) msg += " На сегодня ступеней хватит — закрепляй.";
      else {
        const left = need - nxt.upStreak;
        msg += ` Ещё ${left} ${plural(left, ["верный", "верных", "верных"])} подряд — и ступень ${s.step + 1}.`;
      }
    } else {
      const diff = said - tot;
      msg = `Итог ${tot}, у тебя ${said}: разница ${diff > 0 ? "+" : "−"}${Math.abs(diff)}. `;
      msg += Math.abs(diff) % 10 === 0 ? "Потерялся десяток — проверь переходы через десяток." : "Сбились единицы — суммы по ходу ниже.";
      if (nxt.step < s.step) msg += ` Ступень ${nxt.step} — закрепим.`;
      const slip = cp != null && cpSaid != null ? firstSlip(ns, cp, cpSaid) : null;
      setSums({ list: all, bad: slip?.index });
    }
    setSessStep(nxt.step);
    setShown(String(tot));
    setRes(msg);
    setPhase("done");
  };

  const submitAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer) return;
    const r = askRes.current;
    askRes.current = null;
    r?.(Number(answer));
  };

  const pick = (b: Branch) => {
    if (b === branch) return;
    run.current++;
    sess.current = null;
    replay.current = null;
    setBranch(b);
    setSessStep(null);
    setShown("");
    setPos("Готов?");
    setRes("");
    setSums(null);
    setPaused(false);
    setPhase("idle");
  };

  const busy = phase === "run" || phase === "ask";
  const n = branch === "tens" ? 3 : 4;

  return (
    <div className="app">
      <div className="bar">
        <h3>Поток · {branch === "tens" ? "десятки" : "сотни"}</h3>
        <span className="meta">
          Ступень {step} из {LADDER[branch].length} · {L.count} {plural(L.count, ["число", "числа", "чисел"])} по {sec(ms)}
          {minusText(L.minus)}
        </span>
        <div className="end">
          {best > 0 && <span className="meta">Лучшее: ступень {best}</span>}
          <div className="seg" role="group" aria-label="Ветка">
            <button type="button" aria-pressed={branch === "tens"} disabled={busy} onClick={() => pick("tens")}>
              Десятки
            </button>
            <button
              type="button"
              aria-pressed={branch === "hundreds"}
              disabled={busy || !unlocked}
              title={unlocked ? undefined : `Откроется после ступени ${HUNDREDS_UNLOCK} в десятках`}
              onClick={() => pick("hundreds")}
            >
              Сотни{!unlocked && " · закрыто"}
            </button>
          </div>
        </div>
      </div>
      <div className="grid2">
        <div className="stage flow-stage">
          <p className="pos" aria-live="polite">
            {pos}
          </p>
          <Board text={shown} n={n} max={210} right center label={shown ? shown : "пусто"} />
          <div className="track" aria-hidden="true">
            <div className="rail" />
            {Array.from({ length: TRACK_MS / 500 + 1 }, (_, k) => k * 500).map((t) => (
              <span key={t} className="tick" style={{ left: `${(t / TRACK_MS) * 100}%` }}>
                {t % 1000 === 0 && (
                  <b>
                    {t / 1000}
                    {NB}с
                  </b>
                )}
              </span>
            ))}
            <span className="span" style={{ width: `${(ms / TRACK_MS) * 100}%` }} />
            <div className="bar-t" ref={barEl} style={{ width: `${(ms / TRACK_MS) * 100}%`, transform: "scaleX(0)" }} />
          </div>
          {phase === "ask" && (
            <form className="ask" onSubmit={submitAsk} autoComplete="off">
              <label htmlFor="f-in">{question}</label>
              <input
                id="f-in"
                ref={askIn}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                value={answer}
                onChange={(e) => setAnswer(digits(e.target.value))}
              />
              <button className="btn go" disabled={!answer}>
                Ответить <kbd>Enter</kbd>
              </button>
            </form>
          )}
          <p className="result" aria-live="polite">
            {res}
          </p>
          {sums && (
            <p className="sums" aria-label="Суммы по ходу">
              {sums.list.map((v, i) => (
                <span key={i} className={i === sums.bad ? "bad" : undefined}>
                  {v}
                </span>
              ))}
            </p>
          )}
          <div className="ctrl">
            <label className="toggle">
              <input type="checkbox" checked={slower} disabled={busy} onChange={(e) => setSlower(e.target.checked)} />
              помедленнее
            </label>
            {!busy && (
              <button ref={startBtn} type="button" className="btn go" onClick={start}>
                {paused ? "Повторить подход" : phase === "done" ? "Ещё подход" : "Начать подход"}
              </button>
            )}
          </div>
        </div>
        <aside className="side" aria-label="Лестница ступеней">
          <div className="side-h">
            Лестница <span>полоска = время показа</span>
          </div>
          <ol className="dep ladder">
            {LADDER[branch].map((x, i) => {
              const k = i + 1;
              const s = k < step ? "past" : k === step ? "cur" : "ahead";
              return (
                <li key={k} className={s}>
                  <span className="no">{pad2(k)}</span>
                  <span className="spec txt">
                    <span>
                      {x.count}
                      {NB}× {DIG[x.digits]}
                      {minusText(x.minus)} · {sec(showMs(x, slower))}
                    </span>
                    <span className="len" style={{ width: `${(showMs(x, slower) / TRACK_MS) * 100}%` }} />
                  </span>
                  {s === "cur" ? (
                    <span className="stamp now">сейчас</span>
                  ) : branch === "tens" && k === HUNDREDS_UNLOCK && !unlocked ? (
                    <span className="stamp off">откроет сотни</span>
                  ) : s === "past" ? (
                    CHECK
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}
